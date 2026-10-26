/**
 * @file React 版标注覆盖层：串联 UI、引擎与导出流程的唯一容器组件
 *
 * 在整体架构中的位置：
 * `@laoliangfe/annotation-overlay-core` 提供与框架无关的画布引擎（截图、工具分派、
 * 历史、导出），本文件只负责「把引擎能力接到 React 状态与 DOM 上」：
 * 1. 用 ref 暴露命令式 open/close，显隐由调用方控制；
 * 2. 用 useAnnotationEngine 持有引擎实例与派生状态；
 * 3. 渲染 Toolbar / StylePanel，并把用户操作翻译成引擎调用；
 * 4. 确认时导出 PNG 并通过 onConfirm 回传。
 *
 * 实现约束（改动前务必确认）：
 * - Fabric 7 的 `new fabric.Canvas()` 会生成 .canvas-container（wrapperEl），
 *   内含 lower（绘制）与 upper（事件）两层；事件绑在 upper 层，因此必须把
 *   整个容器替换进 DOM，只挂 getElement() 会出现「画布可见但画不了」。
 * - 覆盖层是 position: fixed 的视口层，尺寸取自目标元素 getBoundingClientRect()，
 *   目标元素需完整在视口内，否则超出部分会被 overflow 隐藏。
 * - 必须挂到 document.body：祖先元素的 transform / filter 会创建包含块，
 *   使 fixed 相对该祖先而非视口定位。
 * - 导出走引擎的 lowerCanvasEl.toDataURL()/toBlob()，不传 multiplier，
 *   否则高 DPI 屏会按逻辑尺寸重采样，导出图发虚。
 *
 * @see ../hooks/useAnnotationEngine.ts 引擎实例与 React 状态的桥接
 * @see ./Toolbar.tsx 顶部工具栏
 * @see ./StylePanel.tsx 颜色 / 粗细面板
 * @see ../../core/src/engine/createCanvasEngine.ts 引擎实现
 */
import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { type ToolId, type ConfirmPayload } from '@laoliangfe/annotation-overlay-core';
import { useAnnotationEngine } from '../hooks/useAnnotationEngine';
import { Toolbar } from './Toolbar';
import { StylePanel } from './StylePanel';

// ============================================================
// 类型
// ============================================================
/**
 * 覆盖层对外暴露的命令式句柄（通过 ref 获取）
 *
 * 组件自身不渲染触发按钮，何时打开、对哪个元素标注完全由调用方决定。
 */
export interface AnnotationOverlayRef {
  /** 打开覆盖层并截取该元素；resolve 时占位 canvas 已挂载，可继续初始化引擎 */
  open: (targetEl: HTMLElement) => Promise<void>;
  /** 关闭覆盖层并销毁引擎；未确认的标注直接丢弃，不会触发 onConfirm */
  close: () => void;
}

/**
 * 覆盖层属性：全部为可选回调，组件内部不保存标注结果
 */
export interface AnnotationOverlayProps {
  /** 点击「确认」后回调；payload 为 null 表示截图/导出失败，调用方必须判空 */
  onConfirm?: (payload: ConfirmPayload | null) => void;
  /** 点击「取消」或按 Esc 时回调；此时不会回传任何图片 */
  onCancel?: () => void;
  /**
   * 截图前回调（open 之后、真正截图之前触发）
   * 用于临时隐藏不应出现在截图中的辅助元素（loading、tooltip、遮罩等）
   */
  onBeforeCapture?: (targetEl: HTMLElement) => void;
  /** 截图与画布挂载完成后回调，用于恢复 onBeforeCapture 中隐藏的元素 */
  onAfterCapture?: (targetEl: HTMLElement) => void;
}

// ============================================================
// 组件
// ============================================================
/**
 * 标注覆盖层组件
 *
 * 打开后以目标元素的截图作为画布背景，支持画笔 / 折线 / 箭头 / 矩形 / 椭圆 / 文字
 * 六种标注，并提供撤销、重做、样式调整与导出。
 *
 * 生命周期：
 * open() → 记录目标矩形并渲染覆盖层 → 用户首次选工具时截图建画布 →
 * 绘制过程中由引擎回调驱动 UI → 确认导出或取消销毁。
 *
 * @example
 * const overlayRef = useRef<AnnotationOverlayRef>(null);
 * const cardRef = useRef<HTMLDivElement>(null);
 *
 * <div ref={cardRef}>待标注内容</div>
 * <button onClick={() => overlayRef.current?.open(cardRef.current!)}>标注</button>
 * <AnnotationOverlay
 *   ref={overlayRef}
 *   onConfirm={(payload) => payload && upload(payload.blob)}
 *   onCancel={() => console.log('已取消')}
 * />
 */
export const AnnotationOverlay = forwardRef<AnnotationOverlayRef, AnnotationOverlayProps>(
  (props, ref) => {
    const {
      onConfirm,
      onCancel,
      onBeforeCapture,
      onAfterCapture,
    } = props;

    // 状态
    /** 是否渲染覆盖层；false 时直接 return null，引擎已在 close 中销毁 */
    const [visible, setVisible] = useState(false);
    /** 覆盖层的定位与尺寸（视口坐标，单位 px），与目标元素矩形一致 */
    const [overlayRect, setOverlayRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
    /** 工具栏被拖动后的左上角坐标（fixed 定位，单位 px） */
    const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
    /** 是否已被用户拖动过：false 时工具栏相对覆盖层居中吸顶，true 时改为 fixed 自由定位 */
    const [isCustomPosition, setIsCustomPosition] = useState(false);
    /** 样式面板相对 .anno-topbar-group 的横向偏移（px），用于对齐当前工具按钮 */
    const [panelLeft, setPanelLeft] = useState(0);
    /** 样式面板相对 .anno-topbar-group 的纵向偏移（px），默认落在工具栏下方 54px */
    const [panelTop, setPanelTop] = useState(54);

    // Refs
    /** 模板中的 canvas 占位；引擎初始化后会被 Fabric 的 .canvas-container 整体替换 */
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    /** 工具栏组容器：拖拽时取矩形、样式面板定位时取基准 */
    const toolbarGroupRef = useRef<HTMLDivElement>(null);
    /** open 时记录的目标元素；引擎惰性初始化（首次选工具）时才真正截图 */
    const pendingTargetRef = useRef<HTMLElement>(document.body);
    /** 是否处于拖拽中；用 ref 避免 mousemove 回调闭包拿到过期的 state */
    const isDraggingRef = useRef(false);
    /** 按下点相对工具栏左上角的偏移，拖动时保持手感不跳 */
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // 引擎
    // engine 是 ref 对象：判空必须用 engine.current，不能直接对 engine 取反
    const {
      engine,
      isInitialized,
      currentTool,
      canUndo,
      canRedo,
      activeObjectType,
      color,
      lineWidth,
      fontSize,
      init,
      selectTool,
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
    } = useAnnotationEngine();

    // ============================================================
    // 计算属性
    // ============================================================
    /** 文字工具下样式面板显示字号，其余工具显示线宽 */
    const isTextTool = currentTool === 'text';

    /**
     * 是否显示样式面板
     * 绘图工具激活时显示；选中已有对象时也显示，便于直接修改该对象的样式。
     */
    const showStylePanel =
      (['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'] as ToolId[]).includes(currentTool) ||
      activeObjectType !== null;

    /**
     * 覆盖层内联样式
     * 尺寸跟随目标元素矩形；引擎就绪前禁用指针事件，避免空画布容器挡住工具栏点击。
     */
    const overlayStyle: React.CSSProperties = {
      left: overlayRect.left + 'px',
      top: overlayRect.top + 'px',
      width: overlayRect.width + 'px',
      height: overlayRect.height + 'px',
      pointerEvents: isInitialized ? 'auto' : 'none',
    };

    /**
     * 工具栏组定位
     * 默认绝对定位、水平居中（translateX(-50%)）；拖动后改 fixed，
     * 必须把 transform 置为 none，否则居中位移会把坐标再偏移半个宽度。
     */
    const toolbarGroupStyle: React.CSSProperties = isCustomPosition
      ? { position: 'fixed', left: toolbarPosition.x + 'px', top: toolbarPosition.y + 'px', transform: 'none', zIndex: 3 }
      : { position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 3 };

    // ============================================================
    // 样式面板定位（对齐当前工具按钮，移植原版 updatePanelPosition）
    // ============================================================
    /**
     * 把样式面板对齐到当前工具按钮正下方
     *
     * 面板是 .anno-topbar-group 的子元素，因此这里算的是「按钮相对组容器」的偏移。
     * 注意：必须用 getBoundingClientRect() 相减，不能读 offsetLeft —— 工具栏拖动后
     * 改用 fixed 定位，offsetParent 会随之变化，offsetLeft 不再等于视觉偏移量。
     *
     * @param toolId 目标工具 id；空串（选择模式）时无从对齐，直接返回
     * @returns 无返回值；副作用为写入 panelLeft / panelTop 触发面板重排
     */
    const updatePanelPosition = useCallback((toolId: ToolId): void => {
      const group = toolbarGroupRef.current;
      if (!toolId || !group) return;
      const btn = group.querySelector<HTMLElement>(`.anno-tool-btn[data-tool="${toolId}"]`);
      if (!btn) return;
      // 用 rect 差值而非 offsetLeft：工具栏拖动后 offsetParent 会变，offsetLeft 不再等价
      const groupRect = group.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      // 横向对齐按钮左边缘；纵向落在按钮下沿再留 6px 间距
      setPanelLeft(btnRect.left - groupRect.left);
      setPanelTop(btnRect.bottom - groupRect.top + 6);
    }, []);

    /**
     * 注册「选中对象后重新定位面板」的钩子
     *
     * 选中已有对象时，引擎会先回读样式并切换工具，再由本钩子把面板移到对应按钮下方。
     * 依赖数组只包含两个 useCallback 稳定引用，effect 只会在挂载/卸载时执行；
     * 清理函数传 null 注销，防止引擎在组件卸载后仍持有旧闭包。
     */
    useEffect(() => {
      setSelectionSyncedHandler((info) => updatePanelPosition(info.toolId));
      return () => setSelectionSyncedHandler(null);
    }, [setSelectionSyncedHandler, updatePanelPosition]);

    // ============================================================
    // 核心方法
    // ============================================================
    /**
     * 打开覆盖层
     *
     * 先记录目标矩形并渲染覆盖层，再让出一个宏任务等 React 提交 DOM，
     * 使调用方 await 之后能立即拿到占位 canvas。
     * 这里刻意不初始化引擎：用户可能不画任何东西直接确认，此时应返回原图，
     * 无需承担截图与建画布的开销。
     *
     * @param targetEl 待标注元素，需已挂载且完整位于视口内
     * @returns 覆盖层 DOM 提交后 resolve
     */
    const open = useCallback(async (targetEl: HTMLElement) => {
      pendingTargetRef.current = targetEl;
      // 用视口坐标而非文档坐标：覆盖层是 fixed 定位，rect 可直接复用
      const rect = targetEl.getBoundingClientRect();
      setOverlayRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      setVisible(true);
      // 等一次宏任务，确保 React 已把带 canvas 占位的覆盖层提交到 DOM
      await new Promise(resolve => setTimeout(resolve, 0));
    }, []);

    /**
     * 关闭覆盖层
     *
     * @returns 无
     * 副作用：销毁 Fabric 画布（移除容器 DOM 与全部事件监听）并卸载覆盖层；
     * 未确认的标注不会保留，也不会触发 onConfirm。
     */
    const close = useCallback(() => {
      dispose();
      setVisible(false);
    }, [dispose]);

    /**
     * 惰性初始化引擎：截图 → 建 Fabric 画布 → 挂载容器
     *
     * @param targetEl 待截图元素（open 时记录的目标）
     * @returns 画布挂载完成后 resolve
     * 副作用：先触发 onBeforeCapture，挂载完成后触发 onAfterCapture；
     * 把模板中的 canvas 占位替换为 Fabric 的 .canvas-container。
     */
    const initEngine = useCallback(async (targetEl: HTMLElement) => {
      onBeforeCapture?.(targetEl);
      // 留 50ms 让 onBeforeCapture 中的隐藏/改样式生效，截图拍的是当前视口
      await new Promise(resolve => setTimeout(resolve, 50));

      await init(targetEl);

      // 将 Fabric 创建的 .canvas-container 容器整体替换进容器
      // （含下层绘制画布 + 上层事件画布，只插入单层 canvas 会导致无法交互）
      // wrapperEl 自带尺寸与绝对定位样式，直接替换占位即可保持布局不变
      const containerEl = getContainerElement();
      if (containerEl && canvasRef.current) {
        const parent = canvasRef.current.parentNode;
        if (parent) {
          parent.replaceChild(containerEl, canvasRef.current);
          // 缓存下层绘制画布，供后续需要时读取（交互事件仍绑在 upper 层）
          canvasRef.current = containerEl.querySelector('canvas');
        }
      }

      onAfterCapture?.(targetEl);
    }, [init, getContainerElement, onBeforeCapture, onAfterCapture]);

    /**
     * 工具按钮点击处理
     *
     * 首次选择有效工具时才初始化引擎（截图开销大，选中/取消工具不应触发）；
     * 切换后立即重算样式面板位置，避免面板停留在上一个工具按钮下方。
     *
     * @param toolId 目标工具 id；'' 表示退出绘制、回到选择模式
     * @returns 无
     * 副作用：可能触发截图建画布（见 initEngine），并写入 currentTool / 面板位置。
     */
    const handleSelectTool = useCallback(async (toolId: ToolId) => {
      if (toolId !== '' && !engine.current) {
        await initEngine(pendingTargetRef.current);
      }
      selectTool(toolId);
      updatePanelPosition(toolId);
    }, [engine, initEngine, selectTool, updatePanelPosition]);

    /**
     * 滑块尺寸变化（拖动过程中高频触发）
     *
     * @param payload.size 新尺寸，单位 px；文字工具下为字号，其余为线宽。
     *        仅处理 size，颜色由 onSetColor 单独通道处理（两者提交时机不同）。
     * @returns 无；只实时应用样式，不写历史，避免拖动产生大量撤销点
     */
    const handleUpdateStyle = useCallback((payload: { size?: number; color?: string }) => {
      if (payload.size !== undefined) setSize(payload.size);
    }, [setSize]);

    /**
     * 颜色变更（预设色块或取色器）
     *
     * @param c CSS 颜色字符串，如 '#ff3b30'
     * @returns 无；颜色是离散操作，立即应用并提交一次历史
     */
    const handleSetColor = useCallback((c: string) => {
      setColor(c);
    }, [setColor]);

    /**
     * 提交样式变更（滑块松开时调用）
     *
     * @returns 无；把拖动期间累积的样式写成一个历史点，供撤销回退
     */
    const handleCommitStyle = useCallback(() => {
      commitStyle();
    }, [commitStyle]);

    /**
     * 确认并导出
     *
     * 两条分支保证返回值结构一致：
     * - 从未初始化引擎（没画任何东西）→ 直接截取原图；
     * - 有引擎 → 先收尾（退出文字编辑、结束未闭合折线）再导出，
     *   否则正在编辑的空文字或半截折线不会进入导出结果。
     *
     * @returns 无
     * 副作用：调用 onConfirm 回传 { base64, blob } 或 null，随后关闭覆盖层。
     */
    const handleConfirm = useCallback(async () => {
      let payload: ConfirmPayload | null = null;

      if (!engine.current) {
        // 未进行任何标注：直接返回原始截图
        payload = await captureOnly(pendingTargetRef.current);
      } else {
        // 收尾：退出文字编辑、结束折线，再导出
        prepareForExport();
        payload = await exportImage();
      }

      onConfirm?.(payload);
      close();
    }, [engine, captureOnly, prepareForExport, exportImage, onConfirm, close]);

    /**
     * 取消标注
     *
     * @returns 无；先回调 onCancel 再关闭，保证使用方能在覆盖层卸载前处理业务
     */
    const handleCancel = useCallback(() => {
      onCancel?.();
      close();
    }, [onCancel, close]);

    // ============================================================
    // 拖拽（鼠标 + 触摸）
    // ============================================================
    /**
     * 鼠标拖动中：把指针位置换算成工具栏左上角坐标，并限制在视口内
     *
     * @param e 原生 mousemove 事件（监听挂在 document 上，移出工具栏也能继续拖）
     * @returns 无；副作用为写入 toolbarPosition 触发重渲染
     */
    const onDrag = useCallback((e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // 减去按下时的抓取偏移，避免工具栏瞬间跳到指针位置
      const newX = Math.max(0, e.clientX - dragOffsetRef.current.x);
      const newY = Math.max(0, e.clientY - dragOffsetRef.current.y);
      const toolbarEl = toolbarGroupRef.current;
      if (toolbarEl) {
        // 用工具栏实际尺寸夹紧右下边界，防止拖出视口后无法再抓回
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        setToolbarPosition({ x: Math.min(newX, maxX), y: Math.min(newY, maxY) });
      } else {
        setToolbarPosition({ x: newX, y: newY });
      }
    }, []);

    /**
     * 触摸拖动中：逻辑与 onDrag 一致，坐标取自第一个触点
     *
     * @param e 原生 touchmove 事件
     * @returns 无；副作用为写入 toolbarPosition，并阻止页面滚动手势
     */
    const onDragTouch = useCallback((e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      // 减去按下时的抓取偏移，避免工具栏瞬间跳到手指位置
      const newX = Math.max(0, touch.clientX - dragOffsetRef.current.x);
      const newY = Math.max(0, touch.clientY - dragOffsetRef.current.y);
      const toolbarEl = toolbarGroupRef.current;
      if (toolbarEl) {
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        setToolbarPosition({ x: Math.min(newX, maxX), y: Math.min(newY, maxY) });
      } else {
        setToolbarPosition({ x: newX, y: newY });
      }
      // 阻止移动端拖动工具栏时页面跟着滚动
      e.preventDefault();
    }, []);

    /**
     * 结束鼠标拖动：复位标志并解绑 document 上的临时监听
     *
     * @returns 无；监听必须在此成对移除，否则每次拖动都会叠加一组监听
     */
    const endDrag = useCallback(() => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', endDrag);
    }, [onDrag]);

    /**
     * 结束触摸拖动：复位标志并解绑 touchmove / touchend
     *
     * @returns 无；与 endDrag 同理，避免监听累积
     */
    const endDragTouch = useCallback(() => {
      isDraggingRef.current = false;
      document.removeEventListener('touchmove', onDragTouch);
      document.removeEventListener('touchend', endDragTouch);
    }, [onDragTouch]);

    /**
     * 开始鼠标拖动
     *
     * 只允许从拖动手柄或工具栏空白处起拖，按钮上的点击不能被识别为拖动；
     * 首次拖动时把当前的绝对定位位置固化为 fixed 坐标，避免切换定位方式时跳位。
     *
     * @param e 工具栏组的 React 鼠标事件
     * @returns 无；副作用为置位 isDraggingRef、写入 toolbarPosition 并注册 document 监听
     */
    const startDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
      // 按钮区域交给 click 处理，按下即拖动会导致按钮点不动
      if (target.closest('button')) return;
      isDraggingRef.current = true;
      const rect = toolbarGroupRef.current?.getBoundingClientRect();
      if (rect) {
        dragOffsetRef.current.x = e.clientX - rect.left;
        dragOffsetRef.current.y = e.clientY - rect.top;
      }
      if (!isCustomPosition && toolbarGroupRef.current) {
        // 记住居中状态下的实际位置，切到 fixed 时保持视觉不跳
        const rect = toolbarGroupRef.current.getBoundingClientRect();
        setToolbarPosition({ x: rect.left, y: rect.top });
        setIsCustomPosition(true);
      }
      // 监听挂 document：指针移出工具栏（甚至移出覆盖层）后仍能继续拖
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', endDrag);
      // 阻止拖动时选中文本
      e.preventDefault();
    }, [isCustomPosition, onDrag, endDrag]);

    /**
     * 开始触摸拖动
     *
     * 与 startDrag 逻辑一致，区别是坐标取自第一个触点；
     * 触摸端没有 mousemove，必须单独绑定 touchmove / touchend。
     *
     * @param e 工具栏组的 React 触摸事件
     * @returns 无；副作用同 startDrag，另外阻止触摸滚动
     */
    const startDragTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
      if (target.closest('button')) return;
      const touch = e.touches[0];
      if (!touch) return;
      isDraggingRef.current = true;
      const rect = toolbarGroupRef.current?.getBoundingClientRect();
      if (rect) {
        dragOffsetRef.current.x = touch.clientX - rect.left;
        dragOffsetRef.current.y = touch.clientY - rect.top;
      }
      if (!isCustomPosition && toolbarGroupRef.current) {
        const rect = toolbarGroupRef.current.getBoundingClientRect();
        setToolbarPosition({ x: rect.left, y: rect.top });
        setIsCustomPosition(true);
      }
      document.addEventListener('touchmove', onDragTouch);
      document.addEventListener('touchend', endDragTouch);
      e.preventDefault();
    }, [isCustomPosition, onDragTouch, endDragTouch]);

    // ============================================================
    // 快捷键
    // ============================================================
    /**
     * 全局快捷键：Esc 取消，Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z 与 Ctrl+Y 重做
     *
     * 依赖 visible：未打开时直接返回，避免拦截页面其它快捷键。
     * 其余依赖为回调引用（useCallback 稳定）；清理函数成对移除 keydown，
     * 防止覆盖层反复开关后监听叠加。
     */
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!visible) return;

        if (e.key === 'Escape') {
          // 先退出文字编辑（保证历史被保存），再取消
          exitTextEditing();
          handleCancel();
          return;
        }
        // 同时兼容 Windows/Linux 的 Ctrl 与 macOS 的 Command
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        if (key === 'y') { e.preventDefault(); redo(); }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [visible, undo, redo, exitTextEditing, handleCancel]);

    // ============================================================
    // Expose
    // ============================================================
    // 只暴露 open/close 两个命令式方法；依赖引用变化时自动更新句柄
    useImperativeHandle(ref, () => ({ open, close }), [open, close]);

    // ============================================================
    // Render
    // ============================================================
    if (!visible) return null;

    // 挂到 body：规避祖先 transform/filter 造成的 fixed 包含块偏移
    // 结构：.anno-overlay（覆盖层）> .anno-topbar-group（工具栏 + 样式面板）
    //       + .anno-canvas-wrap（Fabric 容器挂载点，初始 canvas 仅作占位）
    return createPortal(
      <div className="anno-overlay" style={overlayStyle}>
        <div
          className="anno-topbar-group"
          ref={toolbarGroupRef}
          style={toolbarGroupStyle}
          onMouseDown={startDrag}
          onTouchStart={startDragTouch}
        >
          <Toolbar
            currentTool={currentTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onSelectTool={handleSelectTool}
            onUndo={undo}
            onRedo={redo}
            onCancel={handleCancel}
            onConfirm={handleConfirm}
          />

          {showStylePanel && (
            <StylePanel
              currentColor={color}
              lineWidth={lineWidth}
              fontSize={fontSize}
              isTextTool={isTextTool}
              panelLeft={panelLeft}
              panelTop={panelTop}
              isCustomPosition={isCustomPosition}
              onUpdateStyle={handleUpdateStyle}
              onSetColor={handleSetColor}
              onCommitStyle={handleCommitStyle}
            />
          )}
        </div>

        {/* 画布容器：无工具时点击穿透（不挡下层页面） */}
        <div
          className="anno-canvas-wrap"
          style={{ pointerEvents: currentTool ? 'auto' : 'none' }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>,
      document.body
    );
  }
);

AnnotationOverlay.displayName = 'AnnotationOverlay';

export default AnnotationOverlay;
