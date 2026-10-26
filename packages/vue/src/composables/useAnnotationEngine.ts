/**
 * @file Vue 组合式函数：把函数式核心引擎包装成响应式状态
 *
 * 架构位置：AnnotationOverlay.vue → 本文件 → @laoliangfe/annotation-overlay-core。
 * 本层不实现任何绘制逻辑，只做三件事：
 *   1. 持有引擎实例与 UI 需要的响应式状态（工具、历史、当前样式、选中类型）；
 *   2. 用 setCallbacks 把引擎回调翻译成 ref 更新（单向：引擎 → UI）；
 *   3. 把 UI 操作（选工具 / 改样式 / 撤销重做 / 导出）转发给引擎（单向：UI → 引擎）。
 * 这样引擎可以脱离 Vue 单独使用，适配层也不依赖 fabric 细节。
 *
 * 注意：引擎回调是「命令式推送」，不是响应式源；销毁时必须 destroy() 并重置全部
 * ref，否则复用组件实例（不重新 mount）时会残留上一轮的撤销栈与样式。
 *
 * @see ../../core/src/engine/createCanvasEngine.ts 引擎实现与回调契约
 * @see ../components/AnnotationOverlay.vue 唯一调用方
 */
import { ref, nextTick, type Ref } from 'vue';
import {
  createCanvasEngine,
  captureOnly as captureScreenshot,
  type CanvasEngineInstance,
  type CanvasEngineCallbacks,
  type ToolId,
  type ConfirmPayload,
} from '@laoliangfe/annotation-overlay-core';

/**
 * 创建标注引擎的 Vue 绑定
 *
 * 每次调用生成一份独立的引擎与状态，可在同一页面并存多个覆盖层实例
 * （每个实例各自持有画布、历史栈与样式，互不干扰）。
 *
 * @returns 引擎实例、响应式状态与操作方法；方法均为「转发 + 同步本地状态」的薄封装
 * @example
 * const { init, selectTool, currentTool, dispose } = useAnnotationEngine();
 * await init(document.querySelector('#target')!); // 截图并建立画布
 * selectTool('rect');                             // 切到矩形工具
 * dispose();                                      // 卸载时释放 fabric 资源
 */
export function useAnnotationEngine() {
  /** 引擎实例；null 表示尚未初始化（此时画布不存在，所有转发方法静默跳过） */
  const engine: Ref<CanvasEngineInstance | null> = ref(null);
  /** 是否已完成 init；用于控制覆盖层的 pointer-events，未就绪时整层不可点 */
  const isInitialized = ref(false);
  /** 当前工具；'' 表示未选工具（此时不拦截鼠标，可单击下方页面） */
  const currentTool = ref<ToolId>('');
  /** 是否存在可撤销步骤，驱动撤销按钮 disabled */
  const canUndo = ref(false);
  /** 是否存在可重做步骤，驱动重做按钮 disabled */
  const canRedo = ref(false);
  /** 是否正处于文字行内编辑；编辑中需要屏蔽部分快捷键与导出收尾逻辑 */
  const isTextEditing = ref(false);
  /** 当前选中对象的类型（rect/ellipse/arrow/...），null 表示无选中 */
  const activeObjectType = ref<string | null>(null);

  /** 选中对象样式回读后的额外处理（如样式面板重新定位） */
  let onSelectionSynced: ((info: { toolId: ToolId }) => void) | null = null;

  /**
   * 构造注入给引擎的回调集合
   *
   * 所有状态同步都走这里，避免组件里散落事件监听。回调由引擎在
   * 历史变化 / 选中变化 / 文字编辑切换时同步调用，因此内部只做赋值，
   * 不做耗时操作（定位面板这类 DOM 读取已用 nextTick 推迟）。
   *
   * @param instance 引擎实例，供回调内部读取历史状态（回调入参不含该字段）
   * @returns 引擎要求的回调集合
   */
  const buildCallbacks = (instance: CanvasEngineInstance): CanvasEngineCallbacks => ({
    /**
     * 历史栈变化：撤销/重做按钮的可用性完全由引擎决定
     * （引擎内部会合并同类操作，UI 不自行推算）。
     *
     * @param info.canUndo 是否可撤销
     * @param info.canRedo 是否可重做
     */
    onHistoryChanged: (info) => {
      canUndo.value = info.canUndo;
      canRedo.value = info.canRedo;
    },
    /**
     * 选中对象变化：把对象的真实样式回读到面板，并把工具切到对应项。
     *
     * 副作用：写入 color / lineWidth / fontSize 与 currentTool，并在下一帧
     * 触发面板重定位（此时 DOM 已按新工具渲染完成）。
     *
     * @param info 选中信息；为 null 表示取消选中（如点击空白）
     */
    onSelectionChanged: (info) => {
      // ---- 取消选中 ----
      if (!info) {
        activeObjectType.value = null;
        return;
      }
      // ---- 记录类型（决定样式面板是否显示） ----
      activeObjectType.value = info.objectType;
      // 映射回对应工具（样式面板对齐到对应图标下方）
      if (info.toolId && info.toolId !== currentTool.value) {
        currentTool.value = info.toolId;
      }
      // 回读对象真实的颜色/粗细/字号（原版 syncPanelFromObject 行为）
      color.value = info.color;
      lineWidth.value = info.lineWidth;
      fontSize.value = info.fontSize;
      // 等一帧再定位：此刻工具按钮可能刚因 currentTool 变化而重新渲染
      nextTick(() => onSelectionSynced?.({ toolId: info.toolId }));
      // 引擎已切换到选择模式，这里同步一次历史状态（discard 不触发历史回调）
      const s = instance.getHistoryState();
      canUndo.value = s.canUndo;
      canRedo.value = s.canRedo;
    },
    /**
     * 文字编辑态切换：编辑中会插入 textarea，需要让父层知道以暂停快捷键等行为。
     *
     * @param editing true 进入编辑，false 退出编辑
     */
    onTextEditingChanged: (editing) => {
      isTextEditing.value = editing;
    },
  });

  // 样式状态（供 UI 与引擎实时双向同步）
  // 说明：这三个 ref 声明在 buildCallbacks 之后，但只在回调闭包里访问，
  // 回调要等 init 之后才会被引擎调用，因此不存在暂时性死区问题。
  /** 当前描边色，初始值与调色板首色一致（红），保证首屏面板有选中态 */
  const color = ref('#ff3b30');
  /** 当前线宽（px），初始 4 为中等粗细，兼顾小图与投影场景 */
  const lineWidth = ref(4);
  /** 当前字号（px），初始 20 接近正文字号 */
  const fontSize = ref(20);

  /**
   * 初始化引擎：截图目标元素、创建 fabric 画布
   *
   * 副作用：创建 fabric 实例、注册回调、在目标元素旁插入 .canvas-container、
   * 并触发一次截图（异步，需等待 DOM 稳定）。
   * 幂等：已初始化时直接返回，避免重复 init 叠加画布。
   *
   * @param targetEl 被标注的目标元素，必须完整位于视口内，否则截图会被裁切
   */
  const init = async (targetEl: HTMLElement): Promise<void> => {
    // 幂等保护：重复调用会让页面出现第二个画布容器
    if (engine.value) return;

    // ---- 创建实例并注入回调 ----
    const instance = createCanvasEngine();
    instance.setCallbacks(buildCallbacks(instance));

    // ---- 截图 + 建立画布（异步：内部等字体/图片就绪） ----
    await instance.init(targetEl);
    engine.value = instance;
    isInitialized.value = true;

    // ---- 同步初始历史状态 ----
    // 历史索引 0 是「初始空画布」快照，此时 canUndo 必为 false，
    // 因此撤销按钮在首次落笔前保持禁用；这里主动读一次避免 UI 与引擎不同步
    const s = instance.getHistoryState();
    canUndo.value = s.canUndo;
    canRedo.value = s.canRedo;
  };

  /**
   * 切换工具
   *
   * 副作用：通知引擎切换交互模式（绑定/解绑鼠标事件）；同时更新本地状态以供
   * 工具按钮高亮。传 '' 表示退出绘制、恢复点击穿透。
   *
   * @param toolId 目标工具 id
   */
  const selectTool = (toolId: ToolId): void => {
    engine.value?.selectTool(toolId);
    currentTool.value = toolId;
  };

  /** 实时应用样式（滑块拖动等高频调用，不写历史） */
  const applyStyle = (): void => {
    engine.value?.setStyle(color.value, lineWidth.value, fontSize.value);
  };

  /**
   * 样式尺寸变化（滑块 @input）
   *
   * 按当前工具决定改字号还是线宽：文字工具调字号，其余工具调描边宽度。
   * 只应用不提交历史——滑块连续触发，逐帧写历史会撑爆撤销栈。
   *
   * @param size 新尺寸（px），取值应落在 SIZE_RANGE 对应区间内
   */
  const setSize = (size: number): void => {
    if (currentTool.value === 'text') fontSize.value = size;
    else lineWidth.value = size;
    applyStyle();
  };

  /** 颜色变化（色块点击 / 自定义颜色） */
  const setColor = (c: string): void => {
    color.value = c;
    applyStyle();
    // 颜色是离散操作（点一次即一次意图），立即请求提交；
    // 引擎只在存在选中对象时真正写历史，纯改画笔默认色不产生撤销点
    engine.value?.commitStyle();
  };

  /** 样式提交（滑块松开等，写一次历史） */
  const commitStyle = (): void => {
    engine.value?.commitStyle();
  };

  /** 撤销一步；无可撤销内容时引擎内部会忽略，UI 无需额外判断 */
  const undo = (): void => {
    engine.value?.undo();
  };

  /** 重做一步；与 undo 对称，可用性由 canRedo 控制按钮禁用 */
  const redo = (): void => {
    engine.value?.redo();
  };

  /**
   * 退出文字行内编辑
   *
   * 用途：按 Esc 或导出前调用，把 textarea 内容提交为 fabric 对象并写入历史，
   * 避免「正在编辑的文字」在导出图里丢失。
   */
  const exitTextEditing = (): void => {
    engine.value?.exitTextEditing();
  };

  /**
   * 导出前收尾
   *
   * 副作用：退出文字编辑（空文字会被删除）、结束未闭合的折线，两者都会写历史。
   * 不清理选中态——选中手柄绘制在 upper 层，而导出只取 lowerCanvasEl 位图，
   * 本来就不会进入导出图。
   */
  const prepareForExport = (): void => {
    engine.value?.prepareForExport();
  };

  /**
   * 导出带标注的图片
   *
   * 引擎内部使用 lowerCanvasEl.toDataURL/toBlob 且不传 multiplier，
   * 保证输出尺寸等于画布逻辑尺寸，不会在高 DPI 屏上出现二次放大发虚。
   *
   * @returns { base64, blob }；引擎未初始化或导出失败（blob 为空）时返回 null
   */
  const exportImage = async (): Promise<ConfirmPayload | null> => {
    if (!engine.value) return null;
    const { base64, blob } = await engine.value.exportImage();
    return blob ? { base64, blob } : null;
  };

  /** 未初始化引擎时直接截图目标元素 */
  const captureOnly = async (targetEl: HTMLElement): Promise<ConfirmPayload | null> => {
    // 已初始化则等同正常导出：此时画布上可能已有标注，走引擎才能保住内容
    if (engine.value) return exportImage();
    return captureScreenshot(targetEl);
  };

  /**
   * 注册「选中对象样式已回读」的后续处理
   *
   * 由组件注入，典型用途是等一帧后把样式面板移到对应工具图标下方。
   * 传 null 可解除，避免组件卸载后回调仍持有已销毁的 DOM 引用。
   *
   * @param fn 回调；入参 toolId 为选中对象映射到的工具
   */
  const setSelectionSyncedHandler = (fn: ((info: { toolId: ToolId }) => void) | null): void => {
    onSelectionSynced = fn;
  };

  /**
   * 销毁引擎并复位全部状态
   *
   * 副作用：destroy 会解绑 fabric 事件、移除 .canvas-container、释放画布内存。
   * 必须把 ref 恢复成初始值，否则组件实例被复用（keep-alive / 再次 open）时
   * 会带着上一轮的撤销栈与颜色进入下一轮标注。
   *
   * 幂等：engine 为 null 时各字段仍会复位，可安全重复调用。
   */
  const dispose = (): void => {
    engine.value?.destroy();
    // ---- 引用与初始化标记 ----
    engine.value = null;
    isInitialized.value = false;
    // ---- 交互状态 ----
    currentTool.value = '';
    canUndo.value = false;
    canRedo.value = false;
    isTextEditing.value = false;
    activeObjectType.value = null;
    // ---- 样式复位到与初始声明一致的值 ----
    color.value = '#ff3b30';
    lineWidth.value = 4;
    fontSize.value = 20;
  };

  return {
    engine,
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
    setSelectionSyncedHandler,
    dispose,
  };
}
