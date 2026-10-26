/**
 * @file Angular 版标注覆盖层：组件状态、模板与引擎桥接
 *
 * 在整体架构中的位置：
 * 与 React 版 AnnotationOverlay.tsx 职责一一对应，区别在于状态载体：
 * - React 用 useState/useRef + 回调 setState；
 * - Angular 用 signal + computed，引擎回调里 signal.set 即可驱动渲染；
 * - 命令式 API（open/close）直接暴露在组件实例上，供模板引用变量或 viewChild 调用。
 *
 * 技术选型与约束：
 * - standalone + OnPush + 无 zone.js：不依赖变更检测补丁，signal 写入自动标脏；
 *   因此引擎回调必须写 signal，不能写普通字段，否则视图不会更新。
 * - ViewEncapsulation.None：样式全部来自 ui 包的全局 .anno-* 类，
 *   开启封装会给选择器加属性前缀导致样式失效。
 * - 宿主要挂到 document.body（构造函数内完成）：祖先 transform/filter 会创建包含块，
 *   使 position: fixed 相对祖先定位；与 React 的 createPortal、Vue 的 teleport 一致。
 * - 覆盖层尺寸取自目标元素 getBoundingClientRect()，目标元素必须完整在视口内，
 *   超出部分会被 .anno-overlay 的 overflow: hidden 裁掉。
 * - Fabric 7 的 `new fabric.Canvas()` 生成 .canvas-container（lower 绘制层 +
 *   upper 事件层），必须整体替换模板里的 canvas 占位；只挂 getElement()
 *   会出现「画布可见但画不了」。
 * - Angular 没有 nextTick；这里用 setTimeout(0) 让出一轮宏任务，等 @if 区块与
 *   signal 更新落到 DOM 后再测量或操作节点。
 *
 * 调试提示：修改 packages/ 下任何源码后，必须删除 apps/demo-angular/.angular/cache，
 * 否则 dev server 会继续加载旧产物，表现为改动「不生效」。
 *
 * @see ./toolbar.component.ts 工具栏
 * @see ./style-panel.component.ts 样式面板
 * @see ../../core/src/engine/createCanvasEngine.ts 引擎契约
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  createCanvasEngine,
  captureOnly,
  type CanvasEngineInstance,
  type CanvasEngineCallbacks,
  type ConfirmPayload,
  type ToolId,
} from '@laoliangfe/annotation-overlay-core';
import { ToolbarComponent } from './toolbar.component';
import { StylePanelComponent } from './style-panel.component';

/** 等待一帧，让 @if 区块 / DOM 更新完成（等价于 vue 的 nextTick） */
// 注意是宏任务（setTimeout 0）而不是微任务：Angular 的模板更新与浏览器布局
// 都排在宏任务之后，微任务里读 getBoundingClientRect 可能拿到旧值。
const nextFrame = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** 六种绘图工具（选中任一即显示样式面板） */
// 空串表示选择模式：此时不显示面板，除非选中了已有对象（由 activeObjectType 决定）
const DRAWING_TOOLS: ToolId[] = ['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'];

/**
 * 标注覆盖层组件（Angular 版）
 * - standalone + signals，无 NgModule，不依赖 zone.js（zoneless 下 signal 写入自动触发渲染）
 * - 样式全部来自 ui 包的全局 anno-* 类，因此使用 ViewEncapsulation.None
 * - 状态同步完全由引擎回调驱动（历史变化 / 选中对象回读样式）
 *
 * 典型用法（模板引用变量方式）：
 * @example
 * <annotation-overlay #overlay (confirm)="onConfirm($event)" (cancel)="onCancel()" />
 * <button (click)="overlay.open(card)">标注</button>
 *
 * 也可用 viewChild 获取实例后调用 open/close，组件本身不渲染任何触发按钮。
 */
@Component({
  // 标签名固定，使用方以 <annotation-overlay> 引入
  selector: 'annotation-overlay',
  // 关闭样式封装：ui 包的 .anno-* 选择器必须能命中本组件模板
  encapsulation: ViewEncapsulation.None,
  // OnPush + signal：只有 signal 变化或输入引用变化才重新渲染
  changeDetection: ChangeDetectionStrategy.OnPush,
  // standalone 组件显式声明依赖，无需 NgModule
  imports: [ToolbarComponent, StylePanelComponent],
  // 模板内联：结构简单且与状态强相关，放一起便于对照阅读
  // 注意：@if 控制整体显隐，visible 为 false 时不产生任何 DOM 与事件监听
  template: `
    @if (visible()) {
      <div class="anno-overlay" [style]="overlayStyle()">
        <!-- 可拖动的工具栏组 -->
        <div
          class="anno-topbar-group"
          #toolbarGroup
          [style]="toolbarGroupStyle()"
          (mousedown)="startDrag($event)"
          (touchstart)="startDragTouch($event)"
        >
          <anno-toolbar
            [currentTool]="currentTool()"
            [canUndo]="canUndo()"
            [canRedo]="canRedo()"
            (selectTool)="handleSelectTool($event)"
            (undo)="handleUndo()"
            (redo)="handleRedo()"
            (cancel)="handleCancel()"
            (confirm)="handleConfirm()"
          />

          @if (showStylePanel()) {
            <anno-style-panel
              [style.left.px]="isCustomPosition() ? 0 : panelLeft()"
              [style.top.px]="isCustomPosition() ? 52 : panelTop()"
              [currentColor]="color()"
              [lineWidth]="lineWidth()"
              [fontSize]="fontSize()"
              [isTextTool]="isTextTool()"
              [panelLeft]="panelLeft()"
              [isCustomPosition]="isCustomPosition()"
              (updateStyle)="handleUpdateStyle($event)"
              (setColor)="handleSetColor($event)"
              (commitStyle)="handleCommitStyle()"
            />
          }
        </div>

        <!-- Fabric 画布容器：无工具时点击穿透（不挡下层页面） -->
        <div class="anno-canvas-wrap" [style.pointer-events]="currentTool() ? 'auto' : 'none'">
          <canvas #canvasEl></canvas>
        </div>
      </div>
    }
  `,
})
export class AnnotationOverlayComponent implements OnDestroy {
  // ============================================================
  // Outputs
  // ============================================================
  /** 点击确认：回传导出结果；null 表示截图/导出失败，订阅方必须判空 */
  readonly confirm = output<ConfirmPayload | null>();
  /** 点击取消或按 Esc：不回传任何图片 */
  readonly cancel = output<void>();
  /** 截图前触发：用于临时隐藏 loading、tooltip 等不应出现在截图里的元素 */
  readonly beforeCapture = output<HTMLElement>();
  /** 截图与画布挂载完成后触发：用于恢复 beforeCapture 中隐藏的元素 */
  readonly afterCapture = output<HTMLElement>();

  // ============================================================
  // Signals（UI 状态）
  // ============================================================
  /** 覆盖层是否渲染；false 时模板整块 @if 不输出，引擎已在 close 中销毁 */
  readonly visible = signal(false);
  /** 当前颜色，默认 #ff3b30（与 core defaults 一致），选中对象时回读其真实颜色 */
  readonly color = signal('#ff3b30');
  /** 当前线宽，单位 px，默认 4，范围 1–20（见 ui 包 SIZE_RANGE.lineWidth） */
  readonly lineWidth = signal(4);
  /** 当前字号，单位 px，默认 20，范围 8–72（见 ui 包 SIZE_RANGE.fontSize） */
  readonly fontSize = signal(20);
  /** 覆盖层定位与尺寸（视口坐标，px），open 时取自目标元素矩形 */
  readonly overlayRect = signal({ left: 0, top: 0, width: 0, height: 0 });
  /** 工具栏被拖动后的左上角坐标（fixed 定位，px），仅在 isCustomPosition 为 true 时生效 */
  readonly toolbarPosition = signal({ x: 0, y: 0 });
  /** 是否已被拖动过：false 时工具栏居中吸顶，true 时改为 fixed 自由定位 */
  readonly isCustomPosition = signal(false);
  /** 样式面板左偏移（px），相对 .anno-topbar-group，由按钮 rect 差值算出 */
  readonly panelLeft = signal(0);
  /** 样式面板上偏移（px），相对 .anno-topbar-group，默认 54（工具栏高度 + 间距） */
  readonly panelTop = signal(54);
  /** 画布是否已创建；为 false 时覆盖层禁用指针事件，避免空容器挡住工具栏 */
  readonly isInitialized = signal(false);
  /** 当前工具，'' 表示选择模式；切换时同步给工具栏高亮与画布事件开关 */
  readonly currentTool = signal<ToolId>('');
  /** 是否可撤销（历史指针 > 0），驱动撤销按钮禁用态 */
  readonly canUndo = signal(false);
  /** 是否可重做（指针未到末尾），驱动重做按钮禁用态 */
  readonly canRedo = signal(false);
  /** 是否正在编辑文字（IText 输入态），供需要屏蔽快捷键等场景使用 */
  readonly isTextEditing = signal(false);
  /** 当前选中对象的 Fabric 类型（如 'rect' / 'i-text'），null 表示未选中 */
  readonly activeObjectType = signal<string | null>(null);

  // ============================================================
  // Computed
  // ============================================================
  /** 是否文字工具：决定样式面板显示字号还是线宽 */
  readonly isTextTool = computed(() => this.currentTool() === 'text');

  /** 是否显示样式面板：绘图工具激活，或选中了已有对象（用于改已有标注样式） */
  readonly showStylePanel = computed(
    () => DRAWING_TOOLS.includes(this.currentTool()) || this.activeObjectType() !== null,
  );

  /**
   * 覆盖层内联样式
   * 尺寸与位置跟随目标元素视口矩形；引擎就绪前指针事件为 none，
   * 让点击穿透到下层页面（此时画布还没内容，拦截点击没有意义）。
   */
  readonly overlayStyle = computed<Record<string, string>>(() => ({
    left: `${this.overlayRect().left}px`,
    top: `${this.overlayRect().top}px`,
    width: `${this.overlayRect().width}px`,
    height: `${this.overlayRect().height}px`,
    'pointer-events': this.isInitialized() ? 'auto' : 'none',
  }));

  /**
   * 工具栏组定位
   * 未拖动时绝对定位并水平居中；拖动后改 fixed，必须把 transform 置 none，
   * 否则 translateX(-50%) 会再次把坐标偏移半个宽度。
   */
  readonly toolbarGroupStyle = computed<Record<string, string>>(() => {
    if (this.isCustomPosition()) {
      return {
        position: 'fixed',
        left: `${this.toolbarPosition().x}px`,
        top: `${this.toolbarPosition().y}px`,
        transform: 'none',
        'z-index': '3',
      };
    }
    return {
      position: 'absolute',
      top: '8px',
      left: '50%',
      transform: 'translateX(-50%)',
      'z-index': '3',
    };
  });

  // ============================================================
  // 模板引用 / 私有状态
  // ============================================================
  /** 模板中的 canvas 占位；引擎初始化后会被 .canvas-container 整体替换 */
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  /** 工具栏组容器：拖拽取矩形、样式面板定位取基准 */
  private readonly toolbarGroupRef = viewChild<ElementRef<HTMLElement>>('toolbarGroup');

  /** 引擎实例存私有字段（非 signal） */
  // 引擎是可变对象且只在方法内部使用，放进 signal 会造成无意义的变更检测
  private engine: CanvasEngineInstance | null = null;
  /** open 时记录的目标元素；首次选工具、或未画任何内容直接确认时使用 */
  private pendingTarget: HTMLElement = document.body;
  /** 是否处于拖拽中；用普通字段即可，拖动过程不需要触发渲染 */
  private isDragging = false;
  /** 按下点相对工具栏左上角的偏移，拖动时保持抓手不跳 */
  private dragOffset = { x: 0, y: 0 };

  /**
   * 构造函数：宿主迁移到 body + 绑定全局快捷键
   *
   * 副作用：
   * - 把宿主元素 append 到 document.body（只在还不是 body 子节点时执行），
   *   避免父级 transform/filter 建立包含块导致 fixed 定位偏移；
   * - 在 document 上注册 keydown，保证画布未聚焦时 Esc/Ctrl+Z 也能生效。
   * 注意：快捷键在组件创建时就绑定，但 onKeyDown 里以 visible() 提前返回，
   * 未打开时不会干扰页面其它交互。
   */
  constructor() {
    // 与 react（createPortal）/ vue（teleport）一致：把宿主元素挂到 body，
    // 避免父级 transform / stacking context 影响 fixed 定位
    // inject 必须在注入上下文（构造函数/字段初始化）中调用，因此写在这里
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (host !== document.body) {
      document.body.appendChild(host);
    }

    // document 级快捷键
    document.addEventListener('keydown', this.onKeyDown);
  }

  // ============================================================
  // 公开 API（模板外通过 template reference / viewChild 调用）
  // ============================================================
  /**
   * 打开覆盖层并记录目标元素
   *
   * 只负责渲染覆盖层与记录矩形，不创建引擎：用户可能不画任何东西直接确认，
   * 此时应返回原图，没必要承担截图开销。
   *
   * @param target 待标注元素，需已挂载且完整位于视口内
   * @returns 覆盖层 DOM 渲染完成后 resolve（等 @if 输出 canvas 占位）
   * 副作用：写入 pendingTarget / overlayRect / visible
   */
  async open(target: HTMLElement): Promise<void> {
    this.pendingTarget = target;
    // 覆盖层是 fixed 定位，直接复用视口坐标，无需叠加滚动偏移
    const rect = target.getBoundingClientRect();
    this.overlayRect.set({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    this.visible.set(true);
    // 等一帧，让 @if 区块渲染出 canvas 占位
    await nextFrame();
  }

  /**
   * 关闭覆盖层
   *
   * @returns 无
   * 副作用：销毁引擎（移除画布 DOM、解绑事件、清空历史）并隐藏覆盖层；
   * 未确认的标注直接丢弃，不会触发 confirm。
   */
  close(): void {
    this.disposeEngine();
    this.visible.set(false);
  }

  // ============================================================
  // 引擎生命周期
  // ============================================================
  /**
   * 构造注入引擎的回调集合
   *
   * 回调内只写 signal 与引擎字段，不直接操作 DOM；需要在 DOM 更新后测量时
   * （如面板定位）通过 nextFrame 延后一拍。
   *
   * @param engine 当前引擎实例，用于在选中变化后重新读取历史状态
   * @returns CanvasEngineCallbacks，交给 engine.setCallbacks()
   */
  private buildCallbacks(engine: CanvasEngineInstance): CanvasEngineCallbacks {
    return {
      onHistoryChanged: info => {
        this.canUndo.set(info.canUndo);
        this.canRedo.set(info.canRedo);
      },
      onSelectionChanged: info => {
        if (!info) {
          // 取消选中：只清空类型，保留当前工具与样式，方便继续绘制
          this.activeObjectType.set(null);
          return;
        }
        this.activeObjectType.set(info.objectType);
        // 映射回对应工具（样式面板对齐到对应图标下方）
        if (info.toolId && info.toolId !== this.currentTool()) {
          this.currentTool.set(info.toolId);
        }
        // 回读对象真实的颜色/粗细/字号（原版 syncPanelFromObject 行为）
        this.color.set(info.color);
        this.lineWidth.set(info.lineWidth);
        this.fontSize.set(info.fontSize);
        // 面板位置依赖工具按钮的最终布局，等一拍再测量
        nextFrame().then(() => this.updatePanelPosition(info.toolId));
        this.syncHistory(engine);
      },
      onTextEditingChanged: editing => {
        this.isTextEditing.set(editing);
      },
    };
  }

  /**
   * 从引擎读取历史状态并同步到 canUndo / canRedo
   *
   * @param engine 引擎实例（调用方已确保非空）
   * @returns 无；副作用为写两个 signal
   */
  private syncHistory(engine: CanvasEngineInstance): void {
    const s = engine.getHistoryState();
    this.canUndo.set(s.canUndo);
    this.canRedo.set(s.canRedo);
  }

  /**
   * 懒创建引擎实例并注入回调（不截图、不建画布）
   *
   * 拆分原因：回调需要在 init 之前注入（init 期间即可能触发历史/选中事件），
   * 而创建实例与截图建画布是两个阶段。
   *
   * @returns 已存在或新建的引擎实例
   * 副作用：首次调用会写入 this.engine
   */
  private ensureEngine(): CanvasEngineInstance {
    if (this.engine) return this.engine;
    const engine = createCanvasEngine();
    engine.setCallbacks(this.buildCallbacks(engine));
    this.engine = engine;
    return engine;
  }

  /**
   * 销毁引擎并复位全部 UI 状态
   *
   * @returns 无
   * 副作用：调用引擎 destroy、清空实例引用，并把所有 signal 恢复默认值。
   * 主题色/线宽/字号复位是刻意行为：保证下次打开不继承上一次会话的样式。
   */
  private disposeEngine(): void {
    this.engine?.destroy();
    this.engine = null;
    this.isInitialized.set(false);
    this.currentTool.set('');
    this.canUndo.set(false);
    this.canRedo.set(false);
    this.isTextEditing.set(false);
    this.activeObjectType.set(null);
    this.color.set('#ff3b30');
    this.lineWidth.set(4);
    this.fontSize.set(20);
  }

  /** 惰性初始化：第一次选工具时才截图 + 创建 fabric 画布 */
  // 独立的 ensureEngine 已经就绪，这里只做「截图 → init → 挂载容器」三段
  private async initEngine(targetEl: HTMLElement): Promise<void> {
    if (this.engine) return;
    const engine = this.ensureEngine();

    this.beforeCapture.emit(targetEl);
    // 留一拍给订阅方隐藏临时元素，截图拍的是当前视口
    await nextFrame();

    await engine.init(targetEl);
    this.isInitialized.set(true);
    this.syncHistory(engine);

    // 用引擎生成的 .canvas-container 容器整体替换模板里的 canvas 占位
    // （含下层绘制画布 + 上层事件画布，只插入单层 canvas 会导致无法交互）
    // 只替换占位节点，保留 .anno-canvas-wrap 的布局与点击穿透控制
    const containerEl = engine.getContainerElement();
    const placeholder = this.canvasRef()?.nativeElement;
    if (containerEl && placeholder) {
      const parent = placeholder.parentNode;
      if (parent) {
        parent.replaceChild(containerEl, placeholder);
      }
    }

    this.afterCapture.emit(targetEl);
  }

  // ============================================================
  // 样式面板定位（对齐当前工具按钮，移植原版 updatePanelPosition）
  // ============================================================
  /**
   * 把样式面板对齐到指定工具按钮正下方
   *
   * 面板是 .anno-topbar-group 的子元素，因此算的是「按钮相对组容器」的偏移。
   * 注意：必须用 getBoundingClientRect() 相减而非 offsetLeft —— 工具栏拖动后
   * 改为 fixed 定位，offsetParent 会变化，offsetLeft 不再等于视觉偏移。
   *
   * @param toolId 目标工具 id；空串（选择模式）时直接返回
   * @returns 无；副作用为写入 panelLeft / panelTop
   */
  private updatePanelPosition(toolId: ToolId): void {
    const group = this.toolbarGroupRef()?.nativeElement;
    if (!toolId || !group) return;
    const btn = group.querySelector<HTMLElement>(`.anno-tool-btn[data-tool="${toolId}"]`);
    if (!btn) return;
    // 用 rect 差值而非 offsetLeft：工具栏拖动后 offsetParent 会变，offsetLeft 不再等价
    const groupRect = group.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    // 横向对齐按钮左边缘；纵向落在按钮下沿再留 6px 间距
    this.panelLeft.set(btnRect.left - groupRect.left);
    this.panelTop.set(btnRect.bottom - groupRect.top + 6);
  }

  // ============================================================
  // 工具栏事件
  // ============================================================
  /**
   * 工具按钮点击
   *
   * 首次选择有效工具时初始化引擎（'' 表示退出绘制，无需截图）；
   * 切换后等一拍再定位面板，确保新工具的按钮已渲染、尺寸可测。
   *
   * @param toolId 目标工具 id
   * @returns 无
   * 副作用：可能触发截图建画布，并写入 currentTool 与面板位置
   */
  async handleSelectTool(toolId: ToolId): Promise<void> {
    if (toolId !== '' && !this.engine) {
      await this.initEngine(this.pendingTarget);
    }
    if (!this.engine) return;
    this.engine.selectTool(toolId);
    this.currentTool.set(toolId);
    await nextFrame();
    this.updatePanelPosition(toolId);
  }

  /** 撤销一步；无可撤销内容时引擎内部为空操作 */
  handleUndo(): void {
    this.engine?.undo();
  }

  /** 重做一步；无可重做内容时引擎内部为空操作 */
  handleRedo(): void {
    this.engine?.redo();
  }

  /**
   * 取消标注
   *
   * @returns 无；先 emit 再关闭，保证订阅方能在覆盖层卸载前处理业务
   */
  handleCancel(): void {
    this.cancel.emit();
    this.close();
  }

  /**
   * 确认并导出
   *
   * 两条分支保证输出结构一致：
   * - 没创建过引擎（未标注）→ 直接截取原图；
   * - 有引擎 → 先 prepareForExport（退出文字编辑、结束未闭合折线）再导出，
   *   否则编辑中的空文字或半截折线不会进入结果。
   *
   * @returns 无
   * 副作用：emit confirm（可能为 null），随后关闭覆盖层
   */
  async handleConfirm(): Promise<void> {
    let payload: ConfirmPayload | null = null;

    if (!this.engine) {
      // 没有引擎（未进行任何标注），直接返回原始截图
      payload = await captureOnly(this.pendingTarget);
    } else {
      // 收尾：退出文字编辑、结束折线，再导出
      this.engine.prepareForExport();
      const { base64, blob } = await this.engine.exportImage();
      payload = blob ? { base64, blob } : null;
    }

    this.confirm.emit(payload);
    this.close();
  }

  /**
   * 滑条尺寸变化
   *
   * 以当前工具决定改字号还是线宽；只实时应用，不提交历史，
   * 历史点由滑条 mouseup 触发的 handleCommitStyle 统一写入。
   *
   * @param payload.size 新尺寸，单位 px；undefined 时忽略（该回调也承载颜色字段）
   * @returns 无；副作用为更新 signal 并调用引擎 setStyle
   */
  handleUpdateStyle(payload: { size?: number; color?: string }): void {
    if (payload.size === undefined) return;
    const isText = this.currentTool() === 'text';
    if (isText) {
      this.fontSize.set(payload.size);
    } else {
      this.lineWidth.set(payload.size);
    }
    this.engine?.setStyle(this.color(), this.lineWidth(), this.fontSize());
  }

  /**
   * 颜色变更（预设色块 / 取色器）
   *
   * @param c CSS 颜色字符串，如 '#ff3b30'
   * @returns 无；颜色是离散操作，立即应用并提交一次历史
   */
  handleSetColor(c: string): void {
    this.color.set(c);
    this.engine?.setStyle(c, this.lineWidth(), this.fontSize());
    this.engine?.commitStyle();
  }

  /**
   * 提交样式变更（滑条松开）
   *
   * @returns 无；把拖动期间的样式写成一个撤销点；有选中对象时才会真正落到对象上
   */
  handleCommitStyle(): void {
    this.engine?.commitStyle();
  }

  // ============================================================
  // 拖拽（鼠标 + 触摸）
  // ============================================================
  /**
   * 开始鼠标拖动
   *
   * 只允许从拖动手柄或工具栏空白处起拖，按钮上的按下交给 click 处理；
   * 首次拖动把居中定位的实际坐标固化为 fixed 坐标，切换定位方式时视觉不跳。
   *
   * @param e 原生 mousedown 事件（模板绑定）
   * @returns 无；副作用为置位 isDragging、写 toolbarPosition 并注册 document 监听
   */
  startDrag(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    if (target.closest('button')) return;

    this.isDragging = true;
    const toolbarEl = this.toolbarGroupRef()?.nativeElement;
    if (toolbarEl) {
      const rect = toolbarEl.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
    }
    if (!this.isCustomPosition() && toolbarEl) {
      // 记住居中状态下的实际位置，切到 fixed 时保持视觉不跳
      const rect = toolbarEl.getBoundingClientRect();
      this.toolbarPosition.set({ x: rect.left, y: rect.top });
      this.isCustomPosition.set(true);
    }
    // 监听挂 document：指针移出工具栏后仍能继续拖动
    document.addEventListener('mousemove', this.onDrag);
    document.addEventListener('mouseup', this.endDrag);
    e.preventDefault();
  }

  /**
   * 开始触摸拖动
   *
   * 逻辑同 startDrag，坐标取自第一个触点；触摸端没有 mousemove，
   * 必须单独绑定 touchmove / touchend。
   *
   * @param e 原生 touchstart 事件（模板绑定）
   * @returns 无；副作用同 startDrag，并阻止触摸滚动
   */
  startDragTouch(e: TouchEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    if (target.closest('button')) return;

    const touch = e.touches[0];
    this.isDragging = true;
    const toolbarEl = this.toolbarGroupRef()?.nativeElement;
    if (toolbarEl && touch) {
      const rect = toolbarEl.getBoundingClientRect();
      this.dragOffset.x = touch.clientX - rect.left;
      this.dragOffset.y = touch.clientY - rect.top;
    }
    if (!this.isCustomPosition() && toolbarEl) {
      const rect = toolbarEl.getBoundingClientRect();
      this.toolbarPosition.set({ x: rect.left, y: rect.top });
      this.isCustomPosition.set(true);
    }
    document.addEventListener('touchmove', this.onDragTouch);
    document.addEventListener('touchend', this.endDragTouch);
    e.preventDefault();
  }

  /**
   * 鼠标拖动中
   *
   * 写成箭头函数属性而非普通方法：removeEventListener 需要同一个函数引用，
   * 箭头属性保证 this 与引用都稳定。
   *
   * @param e 原生 mousemove 事件
   * @returns 无；把指针位置换算成工具栏左上角坐标并夹紧到视口内
   */
  private readonly onDrag = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    // 减去按下时的抓取偏移，避免工具栏瞬间跳到指针位置
    const newX = Math.max(0, e.clientX - this.dragOffset.x);
    const newY = Math.max(0, e.clientY - this.dragOffset.y);
    this.moveToolbar(newX, newY);
  };

  /**
   * 触摸拖动中
   *
   * @param e 原生 touchmove 事件
   * @returns 无；副作用为更新工具栏坐标并阻止页面滚动
   */
  private readonly onDragTouch = (e: TouchEvent): void => {
    if (!this.isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const newX = Math.max(0, touch.clientX - this.dragOffset.x);
    const newY = Math.max(0, touch.clientY - this.dragOffset.y);
    this.moveToolbar(newX, newY);
    // 阻止移动端拖动工具栏时页面跟着滚动
    e.preventDefault();
  };

  /**
   * 结束鼠标拖动：复位标志并解绑 document 监听
   *
   * @returns 无；监听必须成对移除，否则每次拖动都会叠加一组
   */
  private readonly endDrag = (): void => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.endDrag);
  };

  /**
   * 结束触摸拖动：复位标志并解绑 touchmove / touchend
   *
   * @returns 无；与 endDrag 同理，避免监听累积
   */
  private readonly endDragTouch = (): void => {
    this.isDragging = false;
    document.removeEventListener('touchmove', this.onDragTouch);
    document.removeEventListener('touchend', this.endDragTouch);
  };

  /**
   * 写入工具栏新坐标并夹紧到视口内
   *
   * @param newX 期望的左上角 x（视口坐标，px）
   * @param newY 期望的左上角 y（视口坐标，px）
   * @returns 无；副作用为写 toolbarPosition
   */
  private moveToolbar(newX: number, newY: number): void {
    const toolbarEl = this.toolbarGroupRef()?.nativeElement;
    if (toolbarEl) {
      // 用工具栏实际尺寸限制右下边界，防止拖出视口后无法再抓回
      const rect = toolbarEl.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      this.toolbarPosition.set({ x: Math.min(newX, maxX), y: Math.min(newY, maxY) });
    } else {
      this.toolbarPosition.set({ x: newX, y: newY });
    }
  }

  // ============================================================
  // 快捷键：Esc 取消 / Ctrl+Z 撤销 / Ctrl+Shift+Z、Ctrl+Y 重做
  // ============================================================
  /**
   * document 级快捷键处理
   *
   * 写成箭头函数属性，保证 ngOnDestroy 中能移除同一个引用。
   * 未打开时直接返回，避免拦截宿主页面的快捷键；Ctrl 与 Command 均视为修饰键。
   *
   * @param e 原生 keydown 事件
   * @returns 无；副作用为触发退出编辑、取消、撤销或重做
   */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.visible()) return;

    if (e.key === 'Escape') {
      // 先退出文字编辑（保证历史被保存），再取消
      this.engine?.exitTextEditing();
      this.handleCancel();
      return;
    }
    // 同时兼容 Windows/Linux 的 Ctrl 与 macOS 的 Command
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.handleUndo();
    }
    if (key === 'z' && e.shiftKey) {
      e.preventDefault();
      this.handleRedo();
    }
    if (key === 'y') {
      e.preventDefault();
      this.handleRedo();
    }
  };

  /**
   * 组件销毁
   *
   * 阶段职责：移除构造函数与拖拽过程中注册的全部 document 监听，
   * 再销毁引擎，避免画布与闭包泄漏。
   * 注意：宿主元素在构造函数中被移到 body，Angular 仍负责其销毁，无需手动移除。
   *
   * @returns 无；副作用为解绑监听、销毁引擎并复位状态
   */
  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.endDrag);
    document.removeEventListener('touchmove', this.onDragTouch);
    document.removeEventListener('touchend', this.endDragTouch);
    this.disposeEngine();
  }
}
