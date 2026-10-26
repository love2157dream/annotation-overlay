/**
 * @file React 桥接层：把函数式核心引擎 createCanvasEngine 接入 React 状态
 *
 * 在整体架构中的位置：
 * 核心引擎是纯闭包对象，不感知框架；本 hook 负责三件事：
 * 1. 持有引擎实例（engineRef），提供 init / selectTool / undo 等命令式方法；
 * 2. 通过 engine.setCallbacks() 注入回调，把引擎事件翻译成 React state
 *    （可撤销/可重做、当前工具、选中对象类型、编辑态、回读样式）；
 * 3. 在 dispose 时把全部状态复位，避免下次打开残留上一次的标注样式。
 *
 * 关键设计：
 * - 样式同时存在 state（驱动渲染）与 styleRef（供回调读取）两处。回调闭包在
 *   注入时就固定了，直接读 state 会拿到过期值，因此用 ref 做「最新值镜像」；
 *   写入顺序统一为「先改 ref 再 setState」。
 * - currentToolRef 同理，用于在引擎回调里比较工具是否真的变化，避免无谓 setState。
 *
 * 注意：
 * - init 是幂等的：已有引擎时直接返回，重复选工具不会重复截图。
 * - dispose 会把样式复位为默认值（颜色 #ff3b30、线宽 4、字号 20），
 *   这是「每次打开都是干净状态」的保证，不要删。
 *
 * @see ../components/AnnotationOverlay.tsx 唯一使用方
 * @see ../../core/src/engine/createCanvasEngine.ts 引擎契约
 */
import { useRef, useState, useCallback } from 'react';
import {
  createCanvasEngine,
  captureOnly as captureScreenshot,
  type CanvasEngineInstance,
  type CanvasEngineCallbacks,
  type ToolId,
  type ConfirmPayload,
} from '@laoliangfe/annotation-overlay-core';

/**
 * 标注引擎 hook
 *
 * 返回引擎 ref 与一组派生状态、命令方法；组件卸载前需自行调用 dispose
 * （本 hook 不注册卸载副作用，销毁时机由使用方决定，避免与关闭动画冲突）。
 *
 * @returns 引擎句柄与状态方法集合：
 * - engine：引擎实例 ref，判空用 engine.current；
 * - isInitialized：画布是否已创建；
 * - currentTool / canUndo / canRedo / isTextEditing / activeObjectType：驱动 UI 的状态；
 * - color / lineWidth / fontSize：当前样式（文字工具看 fontSize，其余看 lineWidth）；
 * - init / selectTool / setSize / setColor / commitStyle / undo / redo 等方法。
 *
 * @example
 * const { engine, currentTool, init, selectTool, dispose } = useAnnotationEngine();
 * await init(targetEl);
 * selectTool('rect');
 * // 组件关闭时
 * dispose();
 */
export function useAnnotationEngine() {
  /** 引擎实例；用 ref 保存可变对象，回调中读取始终是最新引用 */
  const engineRef = useRef<CanvasEngineInstance | null>(null);
  /** 画布是否已创建（截图完成且 Fabric 初始化成功） */
  const [isInitialized, setIsInitialized] = useState(false);
  /** 当前工具 id，'' 表示选择模式 */
  const [currentTool, setCurrentTool] = useState<ToolId>('');
  /** 是否可撤销，驱动撤销按钮禁用态 */
  const [canUndo, setCanUndo] = useState(false);
  /** 是否可重做，驱动重做按钮禁用态 */
  const [canRedo, setCanRedo] = useState(false);
  /** 是否正在编辑文字（IText 处于输入态），用于屏蔽部分快捷键等场景 */
  const [isTextEditing, setIsTextEditing] = useState(false);
  /** 当前选中对象的 Fabric 类型（如 'rect' / 'i-text'），null 表示未选中 */
  const [activeObjectType, setActiveObjectType] = useState<string | null>(null);

  // 样式 state + 同步镜像 ref
  /** 当前颜色，默认红 #ff3b30（与 core defaults 一致） */
  const [color, setColorState] = useState('#ff3b30');
  /** 当前线宽，单位 px，默认 4 */
  const [lineWidth, setLineWidthState] = useState(4);
  /** 当前字号，单位 px，默认 20 */
  const [fontSize, setFontSizeState] = useState(20);
  /** 样式镜像：回调闭包读它而不是读 state，避免拿到过期值 */
  const styleRef = useRef({ color: '#ff3b30', lineWidth: 4, fontSize: 20 });
  /** 当前工具镜像：供引擎回调判断工具是否真的变化，减少无效 setState */
  const currentToolRef = useRef<ToolId>('');

  /** 选中对象样式回读后的额外处理（如样式面板重新定位） */
  const selectionSyncedRef = useRef<((info: { toolId: ToolId }) => void) | null>(null);

  /**
   * 重新读取引擎历史状态并同步到 canUndo / canRedo
   *
   * 用于回调未覆盖的时机（初始化完成、选中对象后），保证按钮态与引擎一致。
   * @returns 无；引擎未创建时跳过（s 为空）
   */
  const syncHistory = useCallback(() => {
    const s = engineRef.current?.getHistoryState();
    if (s) {
      setCanUndo(s.canUndo);
      setCanRedo(s.canRedo);
    }
  }, []);

  /**
   * 构造注入引擎的回调集合
   *
   * 每次调用生成新对象，仅在 init 时注入一次；回调内部只通过 ref 与 setState
   * 读写，因此不需要依赖其它 state，依赖数组只有 syncHistory。
   *
   * 各回调职责：
   * - onHistoryChanged：历史变化即刷新撤销/重做可用性；
   * - onSelectionChanged：同步选中类型、反查对应工具、回读对象真实样式；
   * - onTextEditingChanged：同步文字编辑态。
   *
   * @returns CanvasEngineCallbacks，交给 engine.setCallbacks()
   */
  const buildCallbacks = useCallback((): CanvasEngineCallbacks => ({
    onHistoryChanged: (info) => {
      setCanUndo(info.canUndo);
      setCanRedo(info.canRedo);
    },
    onSelectionChanged: (info) => {
      if (!info) {
        // 取消选中：只清空类型，保留当前工具与样式，用户可继续画同类图形
        setActiveObjectType(null);
        return;
      }
      setActiveObjectType(info.objectType);
      // 映射回对应工具（样式面板对齐到对应图标下方）
      if (info.toolId && info.toolId !== currentToolRef.current) {
        currentToolRef.current = info.toolId;
        setCurrentTool(info.toolId);
      }
      // 回读对象真实的颜色/粗细/字号（原版 syncPanelFromObject 行为）
      // 先写 ref 再 setState：保证紧随其后的回调逻辑读到的是新值
      styleRef.current = {
        color: info.color,
        lineWidth: info.lineWidth,
        fontSize: info.fontSize,
      };
      setColorState(info.color);
      setLineWidthState(info.lineWidth);
      setFontSizeState(info.fontSize);
      // 外部钩子（组件用它把样式面板移到对应按钮下方）
      selectionSyncedRef.current?.({ toolId: info.toolId });
      syncHistory();
    },
    onTextEditingChanged: (editing) => {
      setIsTextEditing(editing);
    },
  }), [syncHistory]);

  /**
   * 初始化引擎：截图目标元素并创建 Fabric 画布
   *
   * 幂等：已有引擎时直接返回，重复调用不会重复截图。
   * @param targetEl 待截图元素，需已挂载且有非零尺寸
   * @returns 画布创建完成后 resolve
   * 副作用：注册引擎回调、写入 engineRef、置 isInitialized 并同步历史状态。
   */
  const init = useCallback(async (targetEl: HTMLElement): Promise<void> => {
    if (engineRef.current) return;

    const engine = createCanvasEngine();
    // 必须在 init 之前注入，init 期间的首次截图/历史初始化就会用到回调
    engine.setCallbacks(buildCallbacks());
    await engine.init(targetEl);
    engineRef.current = engine;
    setIsInitialized(true);
    syncHistory();
  }, [buildCallbacks, syncHistory]);

  /**
   * 切换工具
   *
   * @param toolId 目标工具；'' 表示回到选择模式（仅框选/拖动已有对象）
   * @returns 无；引擎未创建时只更新本地状态，不报错
   * 副作用：写入引擎工具、同步 currentToolRef 与 currentTool state
   */
  const selectTool = useCallback((toolId: ToolId): void => {
    engineRef.current?.selectTool(toolId);
    currentToolRef.current = toolId;
    setCurrentTool(toolId);
  }, []);

  /**
   * 实时应用样式（滑块拖动等高频调用，不写历史）
   *
   * @returns 无；以 styleRef 的最新值调用引擎 setStyle，有选中对象时立即改其外观
   */
  const applyStyle = useCallback((): void => {
    const s = styleRef.current;
    engineRef.current?.setStyle(s.color, s.lineWidth, s.fontSize);
  }, []);

  /**
   * 尺寸变化（滑块 onInput）
   *
   * 依据引擎当前工具决定改字号还是线宽：文字工具改 fontSize，其余改 lineWidth。
   * 只应用不提交，历史点由 commitStyle 在松手时统一写入。
   *
   * @param size 新尺寸，单位 px；含义随当前工具变化（字号 8–72 / 线宽 1–20）
   * @returns 无；副作用为更新镜像 ref、对应 state 并调用引擎 setStyle
   */
  const setSize = useCallback((size: number): void => {
    // 以引擎的实际工具为准，而不是 React state，避免切换瞬间的竞态
    const isText = engineRef.current?.getCurrentTool() === 'text';
    const s = styleRef.current;
    if (isText) {
      s.fontSize = size;
      setFontSizeState(size);
    } else {
      s.lineWidth = size;
      setLineWidthState(size);
    }
    engineRef.current?.setStyle(s.color, s.lineWidth, s.fontSize);
  }, []);

  /**
   * 颜色变化（预设色块 / 取色器）
   *
   * 颜色是离散操作：立即应用并提交一次历史；若已有选中对象，引擎会把新颜色
   * 写到该对象上并生成撤销点。
   *
   * @param c CSS 颜色字符串，如 '#ff3b30'
   * @returns 无；副作用为更新镜像 ref、color state、引擎样式并提交历史
   */
  const setColor = useCallback((c: string): void => {
    styleRef.current.color = c;
    setColorState(c);
    const s = styleRef.current;
    engineRef.current?.setStyle(s.color, s.lineWidth, s.fontSize);
    engineRef.current?.commitStyle();
  }, []);

  /**
   * 样式提交（滑块松开等，写一次历史）
   *
   * @returns 无；仅在存在选中对象时真正产生撤销点，否则引擎内部忽略
   */
  const commitStyle = useCallback((): void => {
    engineRef.current?.commitStyle();
  }, []);

  /**
   * 撤销一步
   *
   * @returns 无；无可撤销内容时引擎内部为空操作，按钮禁用态由回调同步
   */
  const undo = useCallback((): void => {
    engineRef.current?.undo();
  }, []);

  /**
   * 重做一步
   *
   * @returns 无；无可重做内容时引擎内部为空操作
   */
  const redo = useCallback((): void => {
    engineRef.current?.redo();
  }, []);

  /**
   * 退出文字编辑
   *
   * @returns 无；空文字会被删除，非空文本落一次历史（由引擎实现）
   */
  const exitTextEditing = useCallback((): void => {
    engineRef.current?.exitTextEditing();
  }, []);

  /**
   * 导出前收尾：退出文字编辑并结束未闭合的折线
   *
   * @returns 无；避免编辑中的文字或半截折线丢失在导出结果之外
   */
  const prepareForExport = useCallback((): void => {
    engineRef.current?.prepareForExport();
  }, []);

  /**
   * 导出当前画布为 PNG
   *
   * @returns { base64, blob }；引擎未创建或 toBlob 失败（blob 为 null）时返回 null，
   *          调用方需要判空后才能使用
   * 注意：导出走引擎的 lowerCanvasEl，已按设备像素比渲染，不额外传 multiplier。
   */
  const exportImage = useCallback(async (): Promise<ConfirmPayload | null> => {
    if (!engineRef.current) return null;
    const { base64, blob } = await engineRef.current.exportImage();
    return blob ? { base64, blob } : null;
  }, []);

  /** 未初始化引擎时直接截图目标元素 */
  const captureOnly = useCallback(async (targetEl: HTMLElement): Promise<ConfirmPayload | null> => {
    // 已有引擎说明用户画过东西，导出画布（含背景与标注）而不是重新截图
    if (engineRef.current) {
      const { base64, blob } = await engineRef.current.exportImage();
      return blob ? { base64, blob } : null;
    }
    return captureScreenshot(targetEl);
  }, []);

  /**
   * 取 Fabric 的 .canvas-container 容器
   *
   * @returns 容器元素（含下层绘制画布 + 上层事件画布）；引擎未创建时为 null
   * 注意：必须整体挂载该容器，只挂下层 canvas 会导致画布可见但无法交互。
   */
  const getContainerElement = useCallback((): HTMLElement | null => {
    return engineRef.current?.getContainerElement() || null;
  }, []);

  /**
   * 注册/注销「选中对象样式同步完成」的钩子
   *
   * @param fn 回调，参数为选中对象映射出的工具 id；传 null 注销
   * @returns 无；只写 ref，不触发渲染
   */
  const setSelectionSyncedHandler = useCallback(
    (fn: ((info: { toolId: ToolId }) => void) | null): void => {
      selectionSyncedRef.current = fn;
    },
    []
  );

  /**
   * 销毁引擎并复位全部状态
   *
   * @returns 无
   * 副作用：调用引擎 destroy（移除画布 DOM、解绑事件、清空历史），
   * 然后清空 ref 与所有 state，把样式恢复为默认值。
   * 注意：复位样式是刻意行为，保证下次打开不继承上一次会话的配色/线宽。
   */
  const dispose = useCallback((): void => {
    engineRef.current?.destroy();
    engineRef.current = null;
    setIsInitialized(false);
    currentToolRef.current = '';
    setCurrentTool('');
    setCanUndo(false);
    setCanRedo(false);
    setIsTextEditing(false);
    setActiveObjectType(null);
    styleRef.current = { color: '#ff3b30', lineWidth: 4, fontSize: 20 };
    setColorState('#ff3b30');
    setLineWidthState(4);
    setFontSizeState(20);
  }, []);

  // 返回对象每次渲染都会新建，但方法均为 useCallback 稳定引用，
  // 使用方可以安全地把它们放进 effect 依赖数组。
  return {
    engine: engineRef,
    isInitialized,
    currentTool,
    canUndo,
    canRedo,
    isTextEditing,
    activeObjectType,
    color,
    lineWidth,
    fontSize,
    init,
    selectTool,
    applyStyle,
    setSize,
    setColor,
    commitStyle,
    undo,
    redo,
    exitTextEditing,
    prepareForExport,
    exportImage,
    captureOnly,
    getContainerElement,
    setSelectionSyncedHandler,
    dispose,
  };
}
