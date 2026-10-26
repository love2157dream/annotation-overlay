/**
 * @file 画布引擎：本包的核心实现
 *
 * 负责一次完整标注会话的生命周期：
 * 截图目标元素 → 创建 Fabric 画布并铺背景 → 注册并分派绘图工具 →
 * 维护撤销/重做历史 → 同步选中对象样式给 UI → 导出 PNG。
 *
 * 设计要点：
 * - 全部状态封装在 createCanvasEngine 的闭包内，不依赖 class 与框架；
 * - 引擎不直接操作 UI，通过 CanvasEngineCallbacks 通知适配层（Vue/React/Angular）；
 * - 工具只负责「怎么画」，历史点、文字收尾、右键转发统一在此处理。
 *
 * 注意（Fabric 7.x 关键事实，修改本文件前务必确认）：
 * 1. `new fabric.Canvas()` 会生成 .canvas-container（wrapperEl），内部包含
 *    lowerCanvasEl（绘制层）与 upperCanvasEl（事件层 + 实时预览）。交互事件
 *    绑在 upper 层，挂载必须用 wrapperEl，只挂 getElement() 会「可见但画不了」。
 * 2. 默认 enableRetinaScaling: true，按 devicePixelRatio 放大位图；手写
 *    canvasEl.width/height 会把位图锁死 1x，高 DPI 屏上表现为画面发虚。
 * 3. 默认 enablePointerEvents: false，Fabric 监听的是 mouse 事件而非 pointer 事件，
 *    因此右键需要在原生 contextmenu 的捕获阶段处理。
 * 4. `fabric.util.enlivenObjects()` 是异步的，恢复历史期间画布可能已被销毁，
 *    必须判空后再 add。
 *
 * @see src/tools/createBaseTool.ts
 * @see src/utils/fabricHelper.ts
 */

import * as fabric from 'fabric';
import type { ToolId, ConfirmPayload, SelectionStyleInfo, HistoryInfo } from '../types';
import { defaults } from '../config/defaults';
import { domCapture } from '../capture/domCapture';
import { ensureMinBoundingBox } from '../utils';
import {
  createPenTool,
  createRectTool,
  createEllipseTool,
  createArrowTool,
  createPolylineTool,
  createTextTool,
} from '../tools';
import type { BaseToolInstance, ToolContext } from '../tools/createBaseTool';
import { applyControlConfig } from '../controls/objectControls';

/** 引擎回调：由各框架适配层订阅，驱动响应式 UI */
export type CanvasEngineCallbacks = {
  /** 历史状态变化（撤销/重做按钮可用性） */
  onHistoryChanged?: (info: HistoryInfo) => void;
  /** 选中对象变化：obj 为 null 表示取消选中（含选中时回读的颜色/粗细/字号） */
  onSelectionChanged?: (info: SelectionStyleInfo | null) => void;
  /** 文字进入/退出编辑 */
  onTextEditingChanged?: (editing: boolean) => void;
};

/**
 * 引擎实例契约
 * 适配层只依赖本类型，不接触 Fabric 细节，便于替换底层或做单测替身。
 */
export type CanvasEngineInstance = {
  /** 截图目标元素并创建 Fabric 画布（首次选中工具时调用） */
  init: (targetEl: HTMLElement) => Promise<void>;
  /** 画布是否已初始化 */
  isReady: () => boolean;
  /** 切换工具（内部处理折线收尾 / 文字退出） */
  selectTool: (toolId: ToolId) => void;
  getCurrentTool: () => ToolId;
  /** 是否正在编辑文字 */
  isTextEditing: () => boolean;
  /** 退出文字编辑（空文字自动删除，非空则保存历史） */
  exitTextEditing: () => void;
  /** 结束进行中的折线（如有） */
  finalizePolyline: () => void;
  /** 确认/导出前的收尾：退出文字编辑 + 结束折线 */
  prepareForExport: () => void;
  /** 实时应用样式（不写历史，供滑块拖动等高频调用） */
  setStyle: (color: string, lineWidth: number, fontSize: number) => void;
  /** 提交一次样式变更到历史（有选中对象时才产生撤销点） */
  commitStyle: () => void;
  undo: () => void;
  redo: () => void;
  getHistoryState: () => HistoryInfo;
  /** 导出标注结果（base64 + blob） */
  exportImage: () => Promise<{ base64: string; blob: Blob | null }>;
  /** 无画布时直接截图目标元素（未做任何标注时的确认） */
  captureOnly: (targetEl: HTMLElement) => Promise<ConfirmPayload | null>;
  /** Fabric 画布 DOM 容器（.canvas-container，含下层绘制画布与上层事件画布，应整体挂入 DOM） */
  getContainerElement: () => HTMLElement | null;
  getCanvasElement: () => HTMLCanvasElement | null;
  getCanvasInstance: () => fabric.Canvas | null;
  destroy: () => void;
  setCallbacks: (callbacks: CanvasEngineCallbacks) => void;
};

/**
 * Fabric 对象 type → 工具 id 映射（选中已有对象时对齐样式面板）
 * key 为 Fabric 对象的 type 字段（实例与 toJSON 结果一致），value 为对外 ToolId。
 * 注意 arrow 保存为 group（Line + Triangle 的组合），折线保存为 polyline。
 */
const objectTypeToToolId: Partial<Record<string, ToolId>> = {
  rect: 'rect',
  ellipse: 'ellipse',
  // 箭头在 Fabric 中是 Group，且本包没有其它 Group 类型图形，可安全映射
  group: 'arrow',
  // Fabric 的折线类型名为 polyline，对外工具 id 是 'line'
  polyline: 'line',
  // 画笔落笔生成 Path
  path: 'pen',
  // Fabric 7 的 IText 实例 type 为 'i-text'（内部对 'itext' 做了归一化）
  'i-text': 'text',
};

/**
 * 独立截图：不依赖引擎实例（未做任何标注直接确认时使用）
 *
 * 与 init 内部的截图逻辑区别：不建画布、不注册事件，只产出可回传的结果。
 *
 * @param targetEl 待截图元素，需已挂载且有非零尺寸
 * @returns 成功为 { base64, blob }；截图失败或结果为空时返回 null（不抛异常）
 *
 * @example
 * const payload = await captureOnly(document.querySelector('#card')!);
 * if (payload) upload(payload.blob);
 */
export async function captureOnly(targetEl: HTMLElement): Promise<ConfirmPayload | null> {
  try {
    const base64 = await domCapture(targetEl);
    // domCapture 失败时返回空串，这里统一收敛成 null 便于调用方判空
    if (!base64) return null;
    // 与 exportImage 的输出形状对齐：dataURL → Blob，避免适配层写两套分支
    const blob = await fetch(base64).then(r => r.blob());
    return { base64, blob };
  } catch (e) {
    console.warn('截图失败:', e);
    return null;
  }
}

/**
 * 创建画布引擎 (纯函数工厂)
 *
 * 重构说明：与原版 annotation-overlay (Vue SFC) 的行为逐一对齐 ——
 * 工具绘制完成 / 文字编辑退出 / 样式提交 / 对象修改 都会产生撤销点；
 * 撤销恢复覆盖异步 enliven 全程，避免竞态；
 * 选中已有对象时回读其真实样式并同步给 UI。
 *
 * @param cfg 初始样式覆盖项，未传或传空值的字段回退到 defaults
 *        （注意实现用的是 `||`，传 0 会被当作未传，线宽/字号需 >= 1）
 * @returns 引擎实例；init 之前 selectTool 只记录工具 id，历史相关 API 已可用，
 *          依赖画布的操作（setStyle 应用对象、exportImage 等）为空操作或返回空值
 *
 * @example
 * const engine = createCanvasEngine({ color: '#0a84ff', lineWidth: 4 });
 * engine.setCallbacks({
 *   onHistoryChanged: (info) => (canUndo.value = info.canUndo),
 *   onSelectionChanged: (info) => (selection.value = info),
 * });
 * await engine.init(document.querySelector('#app')!);
 * engine.selectTool('rect');
 */
export function createCanvasEngine(cfg?: Partial<{ color: string; lineWidth: number; fontSize: number }>): CanvasEngineInstance {
  // ---- 私有状态 (闭包) ----
  /** Fabric 画布实例；init 前与 destroy 后为 null，所有异步回调都要判空 */
  let canvas: fabric.Canvas | null = null;

  // 实时样式：工具与画笔每次都读这里，保证切换颜色后下一笔立即生效
  const config = {
    color: cfg?.color || defaults.color,
    lineWidth: cfg?.lineWidth || defaults.lineWidth,
    fontSize: cfg?.fontSize || defaults.fontSize,
  };

  // 当前工具
  let currentToolId: ToolId = '';
  // 文字编辑状态
  let isTextEditingFlag = false;
  /** 是否由本引擎主动退出文字编辑：用于让 text:editing:exited 跳过重复保存 */
  let isManualTextExit = false;
  // 历史记录
  /** 快照栈，元素为序列化后的对象数组；索引 0 是初始空画布 */
  let history: { objects: any[] }[] = [];
  /** 当前历史指针，-1 表示尚未写入快照 */
  let historyIndex = -1;
  // 恢复标志：必须覆盖异步 enlivenObjects 全程，防止恢复期间的新操作污染历史
  let isRestoring = false;

  /** 工具注册表：init 前就已注册，实例内部状态与画布无关 */
  const tools = new Map<ToolId, BaseToolInstance>();
  /** 绑定在 upperCanvasEl 上的 contextmenu 处理器，销毁时需按同一引用解绑 */
  let contextmenuHandler: ((e: MouseEvent) => void) | null = null;

  // 回调
  /** 适配层注入的回调集合，默认空对象，全部以可选链调用 */
  let callbacks: CanvasEngineCallbacks = {};

  // ---- 工具上下文 ----
  // 工具不直接持有 canvas 与历史，通过这三个能力与引擎通信
  const toolCtx: ToolContext = {
    // 返回副本：防止工具误改引擎的实时配置
    getConfig: () => ({ ...config }),
    saveState,
    ensureMinBoundingBox: (obj: any) => ensureMinBoundingBox(obj),
  };

  // ---- 内部辅助 ----
  /**
   * 生成当前历史状态快照
   * @returns canUndo/canRedo/index/length，供 UI 控制按钮可用性
   */
  function getHistoryState(): HistoryInfo {
    return {
      // 索引 0 是初始空画布，能撤销的起点是 1，故用 > 0 而非 >= 0
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
      index: historyIndex,
      length: history.length,
    };
  }

  /** 把最新历史状态推给适配层（每次 save/undo/redo 后调用） */
  function notifyHistory(): void {
    callbacks.onHistoryChanged?.(getHistoryState());
  }

  /**
   * 取画布上除背景截图外的全部对象
   * 背景图不参与历史：它是画布自身的 backgroundImage，不随标注对象一起快照，
   * 否则每次撤销都要把整张截图重新 enliven 一遍。
   * @returns 标注对象数组；画布未创建时返回空数组
   */
  function getNonBackgroundObjects(): fabric.FabricObject[] {
    const c = canvas;
    if (!c) return [];
    // 用引用比较而非 type 判断：背景图就是 backgroundImage 这一只对象
    return c.getObjects().filter(obj => obj !== c.backgroundImage);
  }

  /**
   * 保存当前画布状态到历史（撤销点）
   *
   * 副作用：序列化全部标注对象、可能截断重做分支、移动指针并通知 UI。
   * 处于恢复过程中（isRestoring）时直接忽略，避免 enliven 期间写入脏帧。
   */
  function saveState(): void {
    if (!canvas || isRestoring) return;
    try {
      const serialized = getNonBackgroundObjects().map(obj => obj.toJSON());
      // 不在末尾时截断重做分支
      if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
      }
      history.push({ objects: serialized });
      historyIndex = history.length - 1;
      notifyHistory();
    } catch (error) {
      // 序列化失败不应中断交互，最多丢掉这一个撤销点
      console.warn('保存状态失败:', error);
    }
  }

  /**
   * 恢复到指定历史索引（异步安全）
   *
   * 副作用：清空画布上的标注对象、用 enlivenObjects 异步重建、重绘、通知 UI。
   * 注意：isRestoring 覆盖整个 await 过程；await 之后 canvas 可能已被 destroy，
   * 后续操作必须继续判空，不能缓存 await 之前的引用。
   *
   * @param index 目标快照下标，超出 [0, history.length) 时直接返回不做任何事
   */
  async function restoreState(index: number): Promise<void> {
    if (!canvas || index < 0 || index >= history.length || isRestoring) return;
    isRestoring = true;
    try {
      const state = history[index];
      // 移除非背景对象
      getNonBackgroundObjects().forEach(obj => canvas?.remove(obj));
      if (state.objects.length > 0) {
        // enliven 是异步的：需按 JSON 的 type 反查 Fabric 类并重建实例
        const restored = (await fabric.util.enlivenObjects(state.objects)) as fabric.FabricObject[];
        // enliven 期间画布可能已被销毁
        if (!canvas) return;
        restored.forEach(obj => canvas?.add(obj));
      }
      canvas?.requestRenderAll();
    } catch (error) {
      // 单帧恢复失败时保留当前画面，用户可以继续操作或再次撤销
      console.warn('恢复状态失败:', error);
    } finally {
      // 无论成功失败都要解除锁，否则后续 saveState 会被永久跳过
      isRestoring = false;
    }
    // 正常流程在此通知 UI；若 enliven 期间画布被销毁，上面已提前 return，不会走到这里
    notifyHistory();
  }

  /**
   * 选中已有对象时：回读其真实样式并同步给 UI（移植原版 syncPanelFromObject）
   *
   * 副作用：修改对象手柄样式、关闭画笔模式、可能切换 currentToolId、重绘、
   * 触发 onSelectionChanged 回调。
   *
   * @param obj 被选中的对象；undefined 表示取消选中，会回调 null
   */
  function handleSelection(obj: fabric.FabricObject | undefined): void {
    if (!canvas) return;
    if (!obj) {
      callbacks.onSelectionChanged?.(null);
      return;
    }

    // 统一手柄样式：历史恢复出来的对象不会经过工具，需要在这里补样式
    applyControlConfig(obj);

    // 选中已有对象时进入选择/查看模式，而非绘制模式
    canvas.isDrawingMode = false;
    canvas.selection = true;

    // 用对象类型反推工具 id，让样式面板高亮到对应工具；无法识别时沿用当前工具
    const mappedTool = (obj.type && objectTypeToToolId[obj.type]) || currentToolId;
    if (mappedTool && mappedTool !== currentToolId) {
      currentToolId = mappedTool;
    }

    // 默认取当前面板值，再按对象真实属性覆盖
    let color = config.color;
    let lineWidth = config.lineWidth;
    let fontSize = config.fontSize;

    if (obj.type === 'i-text') {
      const textObj = obj as fabric.IText;
      fontSize = textObj.fontSize || 20;
      color = (textObj.fill as string) || color;
      // 光标色必须跟着文字色走，否则下次编辑时光标仍是旧色
      textObj.cursorColor = color;
    } else if (obj.type === 'group') {
      // 箭头：颜色/粗细以内部的 Line 子对象为准
      const group = obj as fabric.Group;
      const line = group.getObjects().find(c => c.type === 'line') as fabric.Line | undefined;
      if (line) {
        color = (line.stroke as string) || color;
        lineWidth = line.strokeWidth || lineWidth;
      }
    } else {
      // 矩形/椭圆/折线/画笔路径：描边属性直接挂在对象上
      const shape = obj as fabric.FabricObject & { stroke?: string; strokeWidth?: number };
      if (shape.stroke) color = shape.stroke as string;
      if (typeof shape.strokeWidth === 'number') lineWidth = shape.strokeWidth;
    }

    canvas.requestRenderAll();
    callbacks.onSelectionChanged?.({ objectType: obj.type ?? '', toolId: mappedTool, color, lineWidth, fontSize });
  }

  /**
   * 将样式应用到选中对象（移植原版 applyStyleToActiveObject）
   *
   * 副作用：修改对象及其子对象属性、**不写历史**（由调用方决定何时 commitStyle）、
   * 重绘。箭头需同步改线身与三角，文字需改字号与光标色。
   *
   * @param obj 目标对象，通常是 canvas.getActiveObject() 的返回值
   * @param color 目标颜色，CSS 颜色字符串
   * @param lineWidth 目标线宽，单位 px
   * @param fontSize 目标字号，单位 px（仅文字对象生效）
   */
  function applyStyleToObject(obj: fabric.FabricObject, color: string, lineWidth: number, fontSize: number): void {
    if (obj.type === 'i-text') {
      const textObj = obj as fabric.IText;
      textObj.set({ fontSize, fill: color });
      // 编辑态光标颜色同步，避免改色后光标不可见
      textObj.cursorColor = color;
    } else if (obj.type === 'group') {
      // 箭头 Group：线身走 stroke，箭头三角走 fill + 尺寸（随粗细同步缩放）
      const group = obj as fabric.Group;
      group.getObjects().forEach((child: any) => {
        if (child.type === 'line') {
          child.set({ stroke: color, strokeWidth: lineWidth });
        } else if (child.type === 'triangle') {
          child.set({
            fill: color,
            // 与 createArrow 的尺寸公式保持一致，改粗细后箭头比例不变形
            width: 10 + lineWidth * 2,
            height: 12 + lineWidth * 2,
          });
        }
        // 子对象手动标脏：Group 不会自动感知子属性变化，不标脏会继续画旧缓存
        child.dirty = true;
      });
      (group as any).dirty = true;
    } else {
      obj.set({ stroke: color, strokeWidth: lineWidth });
      // 标记对象脏：即使缓存被重新打开，下一次渲染也会使用新的描边与线宽
      obj.dirty = true;
    }
    // 线宽/字号改变会改变包围盒，必须重算才能正确命中
    obj.setCoords();
    canvas?.requestRenderAll();
  }

  /**
   * 清除 IText 的光标和编辑状态（移植原版 clearTextCursor）
   *
   * 副作用：blur 并移除 Fabric 动态创建的隐藏 textarea、复位选区、关闭编辑标记。
   * 注意：Fabric 在部分异常路径下会把 textarea 留在 DOM 中，这里主动移除，
   * 否则页面上会残留一个可聚焦但不可见的输入框，导致键盘事件被吞。
   *
   * @param textObj 正在编辑的文字对象
   */
  function clearTextCursor(textObj: fabric.IText): void {
    try {
      const obj = textObj as any;
      if (obj.hiddenTextarea) {
        const textarea = obj.hiddenTextarea as HTMLTextAreaElement;
        textarea.blur();
        textarea.style.display = 'none';
        // 从 DOM 摘除，避免不可见输入框继续接收焦点
        if (textarea.parentNode) textarea.parentNode.removeChild(textarea);
        obj.hiddenTextarea = null;
      }
      textObj.set({
        // 复位选区，防止下次进入编辑时默认全选旧内容
        selectionStart: 0,
        selectionEnd: 0,
        cursorWidth: 0,
      });
      // 光标设为透明，退出编辑后不会再残留一条竖线
      textObj.cursorColor = 'transparent';
      textObj.isEditing = false;
      textObj.canvas?.renderAll();
    } catch (error) {
      // 清理失败不影响退出流程，最多残留光标
      console.warn('清除文字光标时出错:', error);
    }
  }

  /**
   * 统一的"退出文字编辑"入口（移植原版 exitTextEditing）
   *
   * 副作用：清除光标、删除空文字、取消选中、重绘、写一个撤销点并通知 UI。
   * 空文字直接删除且不写历史：用户点了文字工具却没输入，不应产生撤销点。
   * 通过 isManualTextExit 让 text:editing:exited 的兜底逻辑跳过一次，
   * 避免同一次退出写入两个历史快照。
   */
  function exitTextEditingInternal(): void {
    if (!canvas) return;
    isManualTextExit = true;
    try {
      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.type === 'i-text') {
        const textObj = activeObj as fabric.IText;
        clearTextCursor(textObj);
        // 空文字自动删除，不产生历史记录
        if (textObj.text === '') {
          canvas.remove(textObj);
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          isTextEditingFlag = false;
          callbacks.onTextEditingChanged?.(false);
          // finally 仍会执行，用于复位 isManualTextExit
          return;
        }
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      isTextEditingFlag = false;
      callbacks.onTextEditingChanged?.(false);
      // 显式同步保存，不依赖 text:editing:exited 事件
      saveState();
    } finally {
      isManualTextExit = false;
    }
  }

  /** 结束进行中的折线（如有） */
  function finalizePolylineInternal(): void {
    const tool = tools.get('line');
    if (tool?.isDrawing?.() && canvas) {
      // 右键 / 双击 / 切换工具三种路径统一收敛到这里
      tool.onContextMenu?.(canvas);
    }
  }

  /**
   * 注册全部工具
   * 每个工具持有自己的草稿状态，因此每个引擎实例必须独立创建一份，
   * 不能跨画布复用工具实例，否则会互相覆盖 startPoint/shape。
   */
  function registerTools(): void {
    tools.set('pen', createPenTool(toolCtx));
    tools.set('rect', createRectTool(toolCtx));
    tools.set('ellipse', createEllipseTool(toolCtx));
    tools.set('arrow', createArrowTool(toolCtx));
    tools.set('line', createPolylineTool(toolCtx));
    tools.set('text', createTextTool(toolCtx));
  }

  /**
   * 绑定 Fabric 画布事件（移植原版 bindDrawingEvents，按工具职责重新分派）
   *
   * 副作用：在画布上注册 mouse:down/move/up、dblclick、path:created、
   * object:modified、文字编辑与选中相关事件。Fabric 7 默认监听鼠标事件
   * （enablePointerEvents: false），所以这里全部按 MouseEvent 处理。
   */
  function bindCanvasEvents(): void {
    if (!canvas) return;

    // 按下：决定「开始绘制」还是「交给 Fabric 选择/拖拽」
    canvas.on('mouse:down', (opt: fabric.TPointerEventInfo) => {
      // 画笔模式由 Fabric 内部处理；无工具（选择模式）时不拦截
      if (!canvas || canvas.isDrawingMode || !currentToolId) return;
      const nativeEvt = opt.e as MouseEvent;
      // 右键只用于结束折线，不触发新绘制
      if (nativeEvt.button === 2) return;

      const tool = tools.get(currentToolId);
      if (!tool) return;

      // 折线进行中：点击任何位置都继续加点（优先于对象选择，与原版一致）
      if (currentToolId === 'line' && tool.isDrawing?.()) {
        tool.onMouseDown(opt, canvas);
        return;
      }

      // 点击已有对象时不绘制（交给 Fabric 处理选择/拖拽）
      if (opt.target) return;

      // 点击空白区域取消选中
      canvas.discardActiveObject();
      canvas.renderAll();

      // 正在编辑文字时，先退出编辑
      if (isTextEditingFlag) {
        exitTextEditingInternal();
        return;
      }

      tool.onMouseDown(opt, canvas);
      // 立即绘制首帧（requestRenderAll 走 rAF，可能在收尾前不刷新）
      canvas.renderAll();
    });

    // 移动：仅转发给当前工具，用于草稿尺寸/折线末点预览
    canvas.on('mouse:move', (opt: fabric.TPointerEventInfo) => {
      if (!canvas || canvas.isDrawingMode) return;
      const tool = tools.get(currentToolId);
      tool?.onMouseMove(opt, canvas);
    });

    // 抬起：定稿（工具内部写历史），并同步重绘一次
    canvas.on('mouse:up', (opt: fabric.TPointerEventInfo) => {
      if (!canvas || canvas.isDrawingMode) return;
      const tool = tools.get(currentToolId);
      tool?.onMouseUp(opt, canvas);
      // 收尾同步重绘，保证最终图形立即落到底层画布（导出/截图不会丢最后一笔）
      if (!canvas.isDrawingMode) canvas.renderAll();
    });

    // 双击：目前仅折线用于结束绘制
    canvas.on('mouse:dblclick', (opt: fabric.TPointerEventInfo) => {
      if (!canvas || canvas.isDrawingMode) return;
      const tool = tools.get(currentToolId);
      tool?.onDblClick?.(opt, canvas);
    });

    // 画笔路径完成
    canvas.on('path:created', (e: any) => {
      const path = e.path as fabric.Path;
      // 快速点一下会生成极小路径，修正后才能选中
      if (path) ensureMinBoundingBox(path);
      saveState();
    });

    // 对象修改完成（拖拽/缩放/旋转）
    canvas.on('object:modified', () => {
      saveState();
    });

    // 文字进入编辑
    canvas.on('text:editing:entered', () => {
      isTextEditingFlag = true;
      callbacks.onTextEditingChanged?.(true);
    });

    /**
     * 文字退出编辑（兜底）
     * 手动退出已在 exitTextEditingInternal 中同步保存（isManualTextExit 跳过）；
     * 这里覆盖 Fabric 内部自行退出（如点击画布外导致原生 blur）的场景。
     */
    canvas.on('text:editing:exited', () => {
      // 主动退出路径已经处理过状态与历史，这里直接返回防止重复写快照
      if (isManualTextExit) return;
      isTextEditingFlag = false;
      callbacks.onTextEditingChanged?.(false);
      if (!canvas) return;

      const activeObj = canvas.getActiveObject();
      // 用 duck-typing 判断：不同 Fabric 版本文字类的 type 名可能不同
      if (activeObj && 'text' in activeObj && typeof activeObj.text === 'string') {
        const textObj = activeObj as fabric.IText;
        if (textObj.text === '') {
          // 未输入任何字符：删除对象，不产生撤销点
          canvas.remove(textObj);
          canvas.discardActiveObject();
        } else {
          // 正常输入结束：取消选中并写入一个撤销点
          canvas.discardActiveObject();
          saveState();
        }
      }
      canvas.requestRenderAll();
    });

    // 选中对象：回读样式并同步 UI
    canvas.on('selection:created', (e: any) => handleSelection(e.selected?.[0]));
    canvas.on('selection:updated', (e: any) => handleSelection(e.selected?.[0]));
    // 取消选中只需通知 UI 复位面板，无需重读样式
    canvas.on('selection:cleared', () => callbacks.onSelectionChanged?.(null));
  }

  registerTools();

  // ---- 公开 API ----
  return {
    /**
     * 初始化：截图目标元素并建立画布
     *
     * 副作用：创建 Fabric 画布并插入 DOM（由适配层挂载 wrapperEl 完成）、
     * 注册全部画布事件与右键监听、写入初始历史快照。
     * 注意：重复调用会创建第二个画布，销毁前不要再次 init。
     *
     * @param target 截图目标元素；其 getBoundingClientRect 决定画布逻辑尺寸
     */
    async init(target: HTMLElement) {
      const rect = target.getBoundingClientRect();

      // 截图目标元素
      const bgDataURL = await domCapture(target);

      /**
       * enableRetinaScaling 保持默认开启（按 devicePixelRatio 渲染）。
       * 注意：不能手动改写 canvasEl.width/height —— 那会把位图拉回 1x，
       * 在高 DPI 屏（Windows 125%/150%、macOS Retina）上浏览器需要把 1x 位图放大，
       * 表现为"打开标注后画布内容整体发虚，关掉又清晰"。
       * 逻辑坐标仍是 CSS 像素（getWidth/getHeight），工具取点不受影响。
       */
      canvas = new fabric.Canvas(document.createElement('canvas'), {
        // 绘制阶段禁止框选，避免与拖拽绘制冲突；selectTool('') 时才打开
        selection: false,
        width: rect.width,
        height: rect.height,
      });

      // 只设 CSS 尺寸，位图尺寸交给 Fabric 按 dpr 计算（见上方说明）
      const el = canvas.getElement();
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';

      // 画笔
      // 必须在 init 时创建：selectTool 里只在已存在时同步颜色
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = config.color;
      canvas.freeDrawingBrush.width = config.lineWidth;

      // 背景截图
      if (bgDataURL) {
        try {
          const img = await fabric.FabricImage.fromURL(bgDataURL);
          // 铺满整个画布：截图尺寸与元素 CSS 尺寸可能不一致（含 dpr 缩放）
          img.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            scaleX: rect.width / (img.width || rect.width),
            scaleY: rect.height / (img.height || rect.height),
          });
          // 作为 backgroundImage 而非普通对象：自动绘制在最底层且不参与交互
          canvas.backgroundImage = img;
        } catch (e) {
          // 背景失败仍可继续标注，只是画布为空白底
          console.warn('背景加载失败', e);
        }
      }

      canvas.renderAll();
      bindCanvasEvents();

      // 右键结束折线（Fabric 默认不响应右键，需在原生 contextmenu 捕获阶段处理）
      const upperCanvasEl = canvas.upperCanvasEl;
      contextmenuHandler = (e: MouseEvent) => {
        // 必须阻止默认菜单，否则右键会弹出浏览器菜单并打断交互
        e.preventDefault();
        e.stopPropagation();
        if (currentToolId === 'line') {
          finalizePolylineInternal();
        }
      };
      // 捕获阶段绑定：保证先于页面其它 contextmenu 监听执行
      upperCanvasEl?.addEventListener('contextmenu', contextmenuHandler, { capture: true });

      // 初始状态
      // 空画布也写入一帧，作为撤销栈的基线（canUndo 从 index > 0 开始）
      saveState();
    },

    /** 画布是否已创建；注意 init 是异步的，截图期间仍返回 false */
    isReady: () => !!canvas,

    /**
     * 切换工具
     *
     * 副作用：可能退出文字编辑、结束折线、开关画笔模式与框选、切换 currentToolId。
     * 顺序很重要：先收尾旧状态再切 id，否则收尾逻辑会按新工具判断而漏掉。
     *
     * @param toolId 目标工具；'' 表示选择模式（允许框选）
     */
    selectTool(toolId: ToolId) {
      if (canvas) {
        // 正在编辑文字先退出（保证历史被保存）
        if (isTextEditingFlag) {
          exitTextEditingInternal();
        }
        // 离开折线工具时结束当前折线
        if (currentToolId === 'line' && toolId !== 'line') {
          finalizePolylineInternal();
        }
        // 只有画笔走 Fabric 的自由绘制模式
        canvas.isDrawingMode = toolId === 'pen';
        if (toolId === 'pen' && canvas.freeDrawingBrush) {
          // 每次切入画笔都同步一次，防止面板改色后笔刷仍是旧值
          canvas.freeDrawingBrush.color = config.color;
          canvas.freeDrawingBrush.width = config.lineWidth;
        }
        // 只有"无工具"（普通选择模式）时才允许框选
        canvas.selection = toolId === '';
      }
      // 画布未就绪也记录 id，init 后即可按该工具工作
      currentToolId = toolId;
    },

    /** 当前工具 id，'' 表示选择模式 */
    getCurrentTool: () => currentToolId,

    /** 是否处于文字编辑中（适配层据此隐藏工具栏或暂停快捷键） */
    isTextEditing: () => isTextEditingFlag,

    /** 退出文字编辑；空文字会被删除且不写历史 */
    exitTextEditing: exitTextEditingInternal,

    /** 结束进行中的折线（无进行中时为空操作） */
    finalizePolyline: finalizePolylineInternal,

    /**
     * 导出前收尾
     * 副作用：退出文字编辑（可能删除空文字）、结束折线，均会写历史。
     * 必须在 exportImage 之前调用，否则正在编辑的空文字或未闭合折线
     * 可能以残缺形态进入导出图。
     */
    prepareForExport() {
      if (isTextEditingFlag) exitTextEditingInternal();
      if (currentToolId === 'line') finalizePolylineInternal();
    },

    /**
     * 实时应用样式（不写历史）
     *
     * 副作用：改写引擎实时配置、同步画笔笔刷、立即应用到选中对象并重绘。
     * 供颜色/粗细/字号滑块的高频 input 使用，历史由 commitStyle 统一提交。
     *
     * @param color 颜色，CSS 颜色字符串
     * @param lineWidth 线宽，单位 px
     * @param fontSize 字号，单位 px（仅文字对象生效）
     */
    setStyle(color: string, lineWidth: number, fontSize: number) {
      config.color = color;
      config.lineWidth = lineWidth;
      config.fontSize = fontSize;
      if (canvas?.freeDrawingBrush) {
        // 画笔颜色是快照值，不跟随 config 自动变化，必须手动同步
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = lineWidth;
      }
      const active = canvas?.getActiveObject();
      if (active) {
        applyStyleToObject(active, color, lineWidth, fontSize);
      }
      canvas?.requestRenderAll();
    },

    /**
     * 提交一次样式变更到历史
     * 副作用：仅当存在选中对象时写一个撤销点；仅调整默认样式（无选中）不产生历史。
     */
    commitStyle() {
      // 只有存在选中对象时才写历史（调整画笔默认值本身不产生可撤销变化）
      if (canvas?.getActiveObject()) {
        saveState();
      }
    },

    /**
     * 撤销一步
     * 副作用：指针减一后异步恢复快照（清空并重建画布对象）。
     * 恢复中或已到栈底时为空操作，避免连续点击造成竞态。
     */
    undo() {
      if (isRestoring || historyIndex <= 0) return;
      historyIndex--;
      // 不 await：调用方是同步的 UI 事件，恢复完成由内部通知
      restoreState(historyIndex);
    },

    /**
     * 重做一步
     * 副作用：指针加一后异步恢复快照；已到栈顶或恢复中时为空操作。
     */
    redo() {
      if (isRestoring || historyIndex >= history.length - 1) return;
      historyIndex++;
      restoreState(historyIndex);
    },

    /** 当前历史状态快照（只读，每次调用返回新对象） */
    getHistoryState,

    /**
     * 导出标注结果
     *
     * 注意：导出前建议先调用 prepareForExport。
     * @returns base64 为 PNG dataURL，blob 为同内容二进制；
     *          画布未创建时返回 { base64: '', blob: null }，两者都需判空
     */
    async exportImage() {
      if (!canvas) return { base64: '', blob: null };
      /**
       * 直接从下层画布位图导出（已按 dpr 渲染），不再传 multiplier：
       * 传 multiplier 会让 Fabric 重新按逻辑尺寸合成，等于丢掉高 DPI 采样，导出图发虚。
       */
      const el = canvas.lowerCanvasEl;
      const base64 = el.toDataURL('image/png');
      // toBlob 为回调式 API，这里包一层 Promise 便于 await；失败时 resolve(null)
      const blob = await new Promise<Blob | null>((resolve) => {
        el.toBlob(resolve, 'image/png');
      });
      return { base64, blob };
    },

    /**
     * 无画布时直接截图目标元素
     * @param target 待截图元素
     * @returns 成功为 { base64, blob }，失败为 null
     */
    async captureOnly(target: HTMLElement) {
      return captureOnly(target);
    },

    /**
     * 返回 Fabric 的 .canvas-container 容器（含 lowerCanvasEl + upperCanvasEl）。
     * 注意：交互事件绑定在 upperCanvasEl 上，只把 getElement()（下层画布）插入 DOM
     * 会导致画布可见但完全无法绘制 —— 必须整体挂载容器。
     */
    getContainerElement: () => canvas?.wrapperEl ?? canvas?.getElement() ?? null,
    /** 下层绘制画布元素，仅用于尺寸/样式读取，不要单独挂载 */
    getCanvasElement: () => canvas?.getElement() || null,
    /** 原始 Fabric 实例，供高级用法（自定义事件、直接操作对象） */
    getCanvasInstance: () => canvas,

    /**
     * 销毁引擎
     *
     * 副作用：解绑 contextmenu、调用各工具 destroy、dispose 画布（移除 DOM 与事件）、
     * 清空历史与全部状态。销毁后引擎不可再用，需要重新 createCanvasEngine。
     * 注意：解绑必须放在 dispose 之前 —— dispose 后画布元素与内部引用失效，
     * 再解绑会静默失败并留下指向已销毁画布的闭包。
     */
    destroy() {
      if (canvas && contextmenuHandler) {
        // 与 addEventListener 时的 capture 选项保持一致，否则解绑无效
        canvas.upperCanvasEl?.removeEventListener('contextmenu', contextmenuHandler, { capture: true });
      }
      contextmenuHandler = null;
      for (const tool of tools.values()) tool.destroy?.();
      tools.clear();
      // dispose 会移除 canvas-container 并解绑 Fabric 自身监听
      canvas?.dispose();
      canvas = null;
      currentToolId = '';
      isTextEditingFlag = false;
      isRestoring = false;
      history = [];
      historyIndex = -1;
    },

    /**
     * 设置回调（可多次调用，整体替换而非合并）
     * @param cb 回调集合；传 null/undefined 时复位为空对象
     */
    setCallbacks(cb: CanvasEngineCallbacks) {
      callbacks = cb || {};
    },
  };
}
