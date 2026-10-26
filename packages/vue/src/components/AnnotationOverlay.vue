<!--
  AnnotationOverlay —— 覆盖层根组件
  职责：把「目标元素截图 + fabric 画布」这层覆盖物渲染到 body 上，串起工具栏、
        样式面板与核心引擎；对外只暴露 open / close 两个命令式方法。
  结构：.anno-overlay（定位层）> .anno-topbar-group（可拖动工具栏 + 样式面板）
        + .anno-canvas-wrap（fabric 画布容器）。
  注意：组件本身不接收 props，调用方通过 ref 调用 open(el) 打开、close() 关闭，
        confirm / cancel 等结果通过事件回传。
-->
<template>
    <!-- teleport 到 body：避免被业务页面的 transform / overflow / z-index 上下文裁剪 -->
    <teleport to="body">
        <!-- 覆盖层本体；尺寸与位置由 overlayStyle 按目标元素矩形内联注入 -->
        <div v-if="visible" class="anno-overlay" :style="overlayStyle">
            <!-- 可拖动的工具栏组：既是拖拽单元，也是样式面板的定位基准（position: relative） -->
            <div class="anno-topbar-group" ref="toolbarGroupRef" :style="toolbarGroupStyle" @mousedown="startDrag"
                @touchstart="startDragTouch">
                <!-- 顶部工具栏：工具切换、撤销重做、取消确认；事件全部上抛给本组件处理 -->
                <Toolbar :current-tool="currentTool" :can-undo="canUndo" :can-redo="canRedo"
                    @select-tool="handleSelectTool" @undo="handleUndo" @redo="handleRedo" @cancel="handleCancel"
                    @confirm="handleConfirm" />

                <!-- 样式面板：显示条件为「选了绘制工具」或「选中了已有对象」；
                     位置由 panelLeft / panelTop（相对 .anno-topbar-group 的差值）决定 -->
                <StylePanel v-if="showStylePanel" :current-color="color" :line-width="lineWidth" :font-size="fontSize"
                    :is-text-tool="isTextTool" :panel-left="panelLeft" :panel-top="panelTop"
                    :is-custom-position="isCustomPosition" @update-style="handleUpdateStyle"
                    @set-color="handleSetColor" @commit-style="handleCommitStyle" />
            </div>

            <!-- Fabric 画布容器：无工具时点击穿透（不挡下层页面） -->
            <!-- 未选工具时 pointer-events:none，让点击落到下方页面；选中工具后置 auto 才能绘制 -->
            <div class="anno-canvas-wrap" :style="{ pointerEvents: currentTool ? 'auto' : 'none' }">
                <!-- 占位 canvas：init 后被替换为 fabric 的 .canvas-container（双层 canvas） -->
                <canvas ref="canvasRef"></canvas>
            </div>
        </div>
    </teleport>
</template>

<script setup lang="ts">
/**
 * @file 覆盖层根组件（Vue3 适配层入口）
 *
 * 在整体架构中的位置：业务页面 → 本组件 → useAnnotationEngine → core 引擎。
 * 本组件负责「视图与交互编排」：维护覆盖层矩形、工具栏位置、样式面板坐标，
 * 把工具栏/样式面板的交互翻译成引擎调用，并把引擎回传的响应式状态分发给子组件。
 *
 * 对外能力（defineExpose）：open(targetEl) / close()；
 * 对外事件：confirm(导出结果) / cancel / beforeCapture / afterCapture。
 *
 * 注意：
 *   1. 画布挂载必须用引擎的 getContainerElement()（即 fabric 的 wrapperEl），
 *      只挂 getElement() 会得到「画布可见但画不了」——事件绑在 upper 层。
 *   2. 样式面板坐标必须用 getBoundingClientRect 差值计算，不能用 offsetLeft；
 *      .anno-topbar-group 有 position: relative，拖动后变成 fixed，offsetParent 会变。
 *   3. 引擎懒初始化：只有第一次选工具时才截图建画布，未标注直接确认则走 captureOnly。
 *
 * @see ./Toolbar.vue 顶部工具栏
 * @see ./StylePanel.vue 样式面板
 * @see ../composables/useAnnotationEngine.ts 引擎绑定与状态
 */
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { type ToolId } from '@laoliangfe/annotation-overlay-core';
import { useAnnotationEngine } from '../composables/useAnnotationEngine';
import Toolbar from './Toolbar.vue';
import StylePanel from './StylePanel.vue';

// ============================================================
// Props / Emits
// ============================================================
// 本组件不声明 props：开关与目标元素都由父组件通过 ref 调用 open/close 驱动，
// 这样父层无需维护 visible 状态，也便于在任意时机（点击、滚动、定时）唤起标注。
const emit = defineEmits<{
    /**
     * 确认导出后回传结果，父组件据此保存/上传图片。
     * payload 为 null 表示导出失败（引擎异常或 toBlob 返回空）。
     */
    confirm: [payload: import('@laoliangfe/annotation-overlay-core').ConfirmPayload | null];
    /**
     * 用户主动取消（点击取消按钮或按 Esc）。
     * 注意：该事件在覆盖层关闭前触发，父组件无需自行调用 close。
     */
    cancel: [];
    /**
     * 截图前触发，入参为即将被截取的目标元素。
     * 用途：父组件临时隐藏 loading 遮罩、展开被折叠内容等，确保截图内容正确。
     */
    beforeCapture: [targetEl: HTMLElement];
    /**
     * 截图并建好画布后触发，入参同 beforeCapture。
     * 用途：恢复在 beforeCapture 中做的临时改动（如重新显示遮罩）。
     */
    afterCapture: [targetEl: HTMLElement];
}>();

// ============================================================
// 状态
// ============================================================
/** 覆盖层是否可见；同时也是快捷键监听的开关（不可见时忽略按键） */
const visible = ref(false);
/** 模板里的占位 canvas；init 后会被替换为 .canvas-container 内的真实画布 */
const canvasRef = ref<HTMLCanvasElement | null>(null);
/** 工具栏组根节点，用于读取矩形以计算样式面板坐标、以及拖动时取尺寸做边界限制 */
const toolbarGroupRef = ref<HTMLElement | null>(null);
/** 样式面板相对工具栏组的左偏移（px），由按钮矩形差值算出 */
const panelLeft = ref(0);
/** 样式面板相对工具栏组的上偏移（px），默认 54≈工具栏高度+间距，避免首帧压住按钮 */
const panelTop = ref(54);

// 引擎（含样式状态）
// 解构出的 ref 与组件模板直接绑定；方法内部已处理 engine 为空的情况，可安全调用
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
    setSelectionSyncedHandler,
    dispose,
} = useAnnotationEngine();

// 拖拽状态
/** 工具栏组的固定定位坐标（仅 isCustomPosition 为 true 时生效），单位 px */
const toolbarPosition = ref({ x: 0, y: 0 });
/** 是否已被用户拖动过；false 时工具栏按 CSS 居中悬浮，true 后改为 fixed 跟随坐标 */
const isCustomPosition = ref(false);
/** 是否正在拖动；用于过滤 mousemove 抖动与重复的 document 事件 */
let isDragging = false;
/** 按下点相对工具栏左上角的偏移，保证拖动时工具栏不会「跳」到指针位置 */
let dragOffset = { x: 0, y: 0 };

// 目标元素
/** 待标注的目标元素；open 时记录，供首次选工具时懒初始化引擎使用 */
let pendingTargetEl: HTMLElement = document.body;

// ============================================================
// 计算属性
// ============================================================
/** 当前是否为文字工具；决定样式面板显示「大小」还是「粗细」 */
const isTextTool = computed(() => currentTool.value === 'text');

/**
 * 样式面板是否显示
 *
 * 两种场景需要面板：已选中某个绘制工具（准备画）、或选中了画布上已有对象（要改样式）。
 * 未选工具且无选中时不显示，避免面板悬空挡住截图。
 */
const showStylePanel = computed(() =>
    (['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'] as ToolId[]).includes(currentTool.value) ||
    activeObjectType.value !== null
);

/** 覆盖层矩形，open 时取自目标元素的 getBoundingClientRect（含 left/top/宽高，px） */
const overlayRect = ref({ left: 0, top: 0, width: 0, height: 0 });
/**
 * 覆盖层内联样式
 *
 * 用目标元素的视口矩形直接定位，使覆盖层与截图区域严格重合；
 * 引擎未初始化前置 pointer-events:none，防止截图完成前误拦截页面点击。
 */
const overlayStyle = computed(() => ({
    left: `${overlayRect.value.left}px`,
    top: `${overlayRect.value.top}px`,
    width: `${overlayRect.value.width}px`,
    height: `${overlayRect.value.height}px`,
    pointerEvents: isInitialized.value ? ('auto' as const) : ('none' as const),
}));

/**
 * 工具栏组定位样式
 *
 * 两种模式：默认绝对定位 + translateX(-50%) 水平居中于覆盖层顶部；
 * 用户拖动过一次后切 fixed + 明确坐标，坐标即视口坐标（拖动途中已做边界夹取）。
 * transform 在 fixed 模式下必须置 none，否则会叠加默认的位移导致偏移。
 */
const toolbarGroupStyle = computed(() => {
    if (isCustomPosition.value) {
        return {
            position: 'fixed' as const,
            left: `${toolbarPosition.value.x}px`,
            top: `${toolbarPosition.value.y}px`,
            transform: 'none',
            zIndex: 3,
        };
    }
    return {
        position: 'absolute' as const,
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 3,
    };
});

// ============================================================
// 样式面板定位（对齐当前工具按钮，移植原版 updatePanelPosition）
// ============================================================
/**
 * 把样式面板移到指定工具按钮的正下方
 *
 * 副作用：写入 panelLeft / panelTop。
 *
 * 实现要点：坐标 = 按钮矩形 − 工具组矩形，均为 getBoundingClientRect 的视口值，
 * 相减后得到「相对 .anno-topbar-group」的偏移（面板是它的 absolute 子元素）。
 * 不能改用 offsetLeft/offsetTop：拖动后工具组变成 position:fixed，
 * offsetParent 随之改变，算出来的值会整体偏移。
 *
 * @param toolId 目标工具；为空（未选工具）或无对应按钮时保持原位不动
 * @example
 * updatePanelPosition('rect'); // 面板跳到矩形按钮下方 6px 处
 */
const updatePanelPosition = (toolId: ToolId): void => {
    const group = toolbarGroupRef.value;
    if (!toolId || !group) return;
    const btn = group.querySelector<HTMLElement>(`.anno-tool-btn[data-tool="${toolId}"]`);
    if (!btn) return;
    // 用 rect 差值计算（panel 相对 .anno-topbar-group 定位）：
    // offsetLeft 依赖 offsetParent，工具栏在居中/拖动时 offsetParent 会变化，容易偏移
    const groupRect = group.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    panelLeft.value = btnRect.left - groupRect.left;
    // +6 是面板与按钮之间的视觉间距，与 CSS 的 gap 区分开（gap 作用于面板与工具栏之间）
    panelTop.value = btnRect.bottom - groupRect.top + 6;
};

// ============================================================
// 方法
// ============================================================
/**
 * 打开覆盖层（对外 API）
 *
 * 副作用：记录目标元素、写入覆盖层矩形、切换 visible 并等待一次渲染。
 * 不在此处创建引擎——真正截图推迟到用户第一次选工具，避免「打开即截图」的开销。
 *
 * @param targetEl 被标注元素，必须完整位于视口内，超出部分会被覆盖层裁掉
 */
const open = async (targetEl: HTMLElement): Promise<void> => {
    pendingTargetEl = targetEl;
    // ---- 读取目标元素视口矩形，作为覆盖层与画布的尺寸基准 ----
    const rect = targetEl.getBoundingClientRect();
    overlayRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    visible.value = true;
    // 等 DOM 挂载完成，父组件随后可安全调用 close 或读取尺寸
    await nextTick();
};

/**
 * 关闭覆盖层（对外 API）
 *
 * 副作用：销毁引擎（解绑 fabric 事件、移除 .canvas-container）、隐藏覆盖层。
 * 会丢弃尚未确认的标注内容，调用方无需自行清理。
 */
const close = (): void => {
    dispose();
    visible.value = false;
};

/**
 * 懒初始化引擎并接管画布容器
 *
 * 流程：通知父组件（隐藏遮罩等）→ 等一帧让页面稳定 → 截图建画布 →
 * 用 fabric 的 wrapperEl 替换占位 canvas → 通知父组件恢复。
 *
 * 关键点：fabric 7 的 Canvas 会生成 .canvas-container，内含 lower（绘制）与
 * upper（事件）两层 canvas，事件绑定在 upper 上。因此必须整体替换容器；
 * 只把 getElement()（lower canvas）挂上去，会出现「画布可见但画不了」。
 *
 * @param targetEl 截图目标元素
 */
const initEngine = async (targetEl: HTMLElement): Promise<void> => {
    // ---- 通知父层：即将截图，可临时调整 DOM ----
    emit('beforeCapture', targetEl);
    await nextTick();

    // ---- 截图 + 创建 fabric 画布（异步：等图片/字体解码） ----
    await init(targetEl);

    // 将 Fabric 创建的 .canvas-container 容器整体替换进容器
    // （含下层绘制画布 + 上层事件画布，只插入单层 canvas 会导致无法交互）
    const containerEl = engine.value?.getContainerElement();
    if (containerEl && canvasRef.value) {
        const parent = canvasRef.value.parentNode;
        if (parent) {
            parent.replaceChild(containerEl, canvasRef.value);
            // 更新 ref 指向真实画布：后续如需再次替换/读取尺寸时拿到的是有效节点
            canvasRef.value = containerEl.querySelector('canvas');
        }
    }

    // ---- 通知父层：截图完成，可恢复 DOM ----
    emit('afterCapture', targetEl);
};

/**
 * 选择工具
 *
 * 首次选工具时才初始化引擎（此时才需要截图），之后再切换只做模式切换。
 * 选 '' 表示退出绘制，不会触发初始化。
 *
 * 副作用：可能创建画布、替换 DOM 节点；随后重算样式面板位置。
 *
 * @param toolId 目标工具，'' 表示取消当前工具
 */
const handleSelectTool = async (toolId: ToolId): Promise<void> => {
    // ---- 懒初始化：仅在有实际工具且引擎尚未创建时执行 ----
    if (toolId !== '' && !engine.value) {
        await initEngine(pendingTargetEl);
    }
    selectTool(toolId);
    // 等按钮 active 态渲染完成再量矩形，否则取到的是切换前的布局
    await nextTick();
    updatePanelPosition(toolId);
};

/** 撤销一步（工具栏按钮 / Ctrl+Z）；无可撤销内容时由引擎静默忽略 */
const handleUndo = (): void => undo();
/** 重做一步（工具栏按钮 / Ctrl+Shift+Z / Ctrl+Y） */
const handleRedo = (): void => redo();

/**
 * 取消标注
 *
 * 副作用：先抛 cancel 事件（父组件可做埋点/提示），再关闭覆盖层并销毁引擎。
 */
const handleCancel = (): void => {
    emit('cancel');
    close();
};

/**
 * 确认并导出
 *
 * 分两种情况：
 *   - 从未初始化引擎（用户没画任何东西）：直接截取目标元素原图；
 *   - 已有画布：先收尾（提交文字编辑、闭合折线）再导出，
 *     否则正在编辑的文字或未闭合折线会以残缺形态进入导出图。
 *
 * 副作用：可能创建/销毁画布；异步导出，完成后抛 confirm 并关闭。
 */
const handleConfirm = async (): Promise<void> => {
    let payload: import('@laoliangfe/annotation-overlay-core').ConfirmPayload | null = null;

    if (!engine.value) {
        // 未进行任何标注：直接返回原始截图
        payload = await captureOnly(pendingTargetEl);
    } else {
        // 收尾：退出文字编辑、结束折线，再导出
        prepareForExport();
        payload = await exportImage();
    }

    emit('confirm', payload);
    close();
};

/**
 * 样式面板的尺寸变化
 *
 * 面板对「字号/线宽」只暴露一个滑块，这里只转尺寸；颜色走独立事件，
 * 因为颜色是离散选择、需要立即写历史，而尺寸是连续拖动、松手才写。
 *
 * @param payload.size 新尺寸（px）；未提供时忽略本次调用
 */
const handleUpdateStyle = (payload: { size?: number; color?: string }): void => {
    if (payload.size !== undefined) setSize(payload.size);
};

/**
 * 设置描边/文字颜色
 *
 * @param c CSS 颜色值（#rrggbb 或取色器返回的任意合法色值）
 */
const handleSetColor = (c: string): void => setColor(c);

/**
 * 提交样式到历史栈
 *
 * 由滑块的 @change（松手）触发：拖动过程只实时预览，松手才落一次历史，
 * 避免一次拖动产生几十条撤销记录。
 */
const handleCommitStyle = (): void => commitStyle();

// ============================================================
// 拖拽方法
// ============================================================
/**
 * 鼠标按下：开始拖动工具栏
 *
 * 仅响应手柄或工具栏空白处的按下（按钮上不触发，否则点按钮会变成拖动）。
 * 副作用：切换到自定义坐标模式、在 document 上注册 mousemove/mouseup。
 * 监听挂在 document 而非元素上，保证指针移出工具栏后仍能继续拖动。
 *
 * @param e 原始鼠标事件，用于计算按下点相对工具栏左上角的偏移
 */
const startDrag = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    // 只有手柄和工具栏本体是拖动区域；样式面板/按钮内部不参与
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    // 按钮优先响应点击，避免「按下即拖动」导致按钮点不动
    if (target.closest('button')) return;

    // ---- 记录按下偏移，拖动时保持相对位置不变 ----
    isDragging = true;
    const rect = toolbarGroupRef.value?.getBoundingClientRect();
    if (rect) {
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
    }
    // ---- 首次拖动：把「居中悬浮」换算成固定坐标，防止切换瞬间位置突变 ----
    if (!isCustomPosition.value && toolbarGroupRef.value) {
        const rect = toolbarGroupRef.value.getBoundingClientRect();
        toolbarPosition.value = { x: rect.left, y: rect.top };
        isCustomPosition.value = true;
    }
    // ---- 事件绑定（document 级，指针移出元素也能继续） ----
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    // 阻止按下时选中文本 / 触发浏览器原生拖拽
    e.preventDefault();
};

/**
 * 触摸按下：开始拖动工具栏（移动端等价于 startDrag）
 *
 * 逻辑与鼠标版本一致，差别在于坐标取自 touches[0]，且监听 touchmove/touchend。
 *
 * @param e 触摸事件；多点触控时只取第一个触点
 */
const startDragTouch = (e: TouchEvent): void => {
    const target = e.target as HTMLElement;
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    if (target.closest('button')) return;

    const touch = e.touches[0];
    isDragging = true;
    const rect = toolbarGroupRef.value?.getBoundingClientRect();
    if (rect && touch) {
        dragOffset.x = touch.clientX - rect.left;
        dragOffset.y = touch.clientY - rect.top;
    }
    if (!isCustomPosition.value && toolbarGroupRef.value) {
        const rect = toolbarGroupRef.value.getBoundingClientRect();
        toolbarPosition.value = { x: rect.left, y: rect.top };
        isCustomPosition.value = true;
    }
    document.addEventListener('touchmove', onDragTouch);
    document.addEventListener('touchend', endDragTouch);
    e.preventDefault();
};

/**
 * 鼠标移动：更新工具栏坐标
 *
 * 双重边界约束：先夹到视口左上（不小于 0），再夹到「视口右下 − 工具栏尺寸」，
 * 保证整条工具栏始终完整可见，不会被拖出屏幕后无法再抓回来。
 *
 * @param e 鼠标事件，clientX/clientY 为视口坐标
 */
const onDrag = (e: MouseEvent): void => {
    if (!isDragging) return;
    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);
    const toolbarEl = toolbarGroupRef.value;
    if (toolbarEl) {
        // ---- 右下边界：用实时 rect 尺寸，兼容工具栏因增删按钮而变化 ----
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        toolbarPosition.value = { x: Math.min(newX, maxX), y: Math.min(newY, maxY) };
    } else {
        toolbarPosition.value = { x: newX, y: newY };
    }
};

/**
 * 触摸移动：更新工具栏坐标（移动端版 onDrag）
 *
 * 与鼠标版本共享同一套边界夹取规则；preventDefault 用于阻止页面跟着滚动。
 *
 * @param e 触摸事件；无触点（如已抬起）时直接返回
 */
const onDragTouch = (e: TouchEvent): void => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const newX = Math.max(0, touch.clientX - dragOffset.x);
    const newY = Math.max(0, touch.clientY - dragOffset.y);
    const toolbarEl = toolbarGroupRef.value;
    if (toolbarEl) {
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        toolbarPosition.value = { x: Math.min(newX, maxX), y: Math.min(newY, maxY) };
    } else {
        toolbarPosition.value = { x: newX, y: newY };
    }
    // 阻止触摸拖动时页面滚动
    e.preventDefault();
};

/**
 * 结束鼠标拖动
 *
 * 副作用：清除 isDragging 并解绑 document 上的 mousemove/mouseup，
 * 必须与 startDrag 成对出现，否则监听会残留导致「一移动就跟着跑」。
 */
const endDrag = (): void => {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
};

/**
 * 结束触摸拖动
 *
 * 与 endDrag 对称，解绑 touchmove/touchend。
 */
const endDragTouch = (): void => {
    isDragging = false;
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
};

// ============================================================
// 快捷键
// ============================================================
/**
 * 全局快捷键处理
 *
 * 支持：Esc 取消、Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 重做、Ctrl/Cmd+Y 重做。
 * 监听挂在 document 上，因此覆盖层不可见时必须直接返回，避免劫持业务页面按键。
 *
 * 注意：Esc 先 exitTextEditing 再取消——文字编辑中的内容要先落成对象写进历史，
 * 否则「取消」会连带丢掉正在输入的文字（与用户预期不符）。
 *
 * @param e 键盘事件；命中组合键时调用 preventDefault 阻止浏览器默认行为
 */
const handleKeyDown = (e: KeyboardEvent): void => {
    // 覆盖层未打开时不参与任何快捷键，避免影响宿主页面
    if (!visible.value) return;

    if (e.key === 'Escape') {
        // 先退出文字编辑（保证历史被保存），再取消
        exitTextEditing();
        handleCancel();
        return;
    }
    // Mac 用 metaKey、Windows/Linux 用 ctrlKey，统一视为修饰键
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod) return;
    const key = e.key.toLowerCase();
    // ---- Ctrl/Cmd+Z：撤销 ----
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
    // ---- Ctrl/Cmd+Shift+Z：重做 ----
    if (key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
    // ---- Ctrl/Cmd+Y：重做（Windows 习惯） ----
    if (key === 'y') { e.preventDefault(); handleRedo(); }
};

// ============================================================
// 生命周期
// ============================================================
/**
 * 挂载：注册全局快捷键，并注入「选中对象后重定位面板」的回调
 *
 * 回调通过 setSelectionSyncedHandler 注入而非直接传参，是因为引擎回调在
 * composable 内部构造，需要由组件在 DOM 就绪后补上这一层 UI 行为。
 */
onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
    // 选中已有对象时：样式面板对齐到对应工具图标下方
    setSelectionSyncedHandler((info) => {
        updatePanelPosition(info.toolId);
    });
});

/**
 * 卸载：解绑全部全局监听并销毁引擎
 *
 * 必须清理的原因：document 级监听不会随组件 DOM 移除而自动解除，
 * 残留会导致内存泄漏，并在下次打开时出现重复响应（一次拖动走两步）。
 */
onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    // 拖拽监听可能因拖动中途卸载而残留，这里兜底解绑
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
    dispose();
});

// ============================================================
// 暴露
// ============================================================
/**
 * 对外命令式 API：父组件通过模板 ref 调用
 *
 * - open(targetEl)：打开覆盖层并标记待截取元素，不立即建画布；
 * - close()：销毁引擎并关闭，未确认的标注会被丢弃。
 *
 * @example
 * const overlay = ref<InstanceType<typeof AnnotationOverlay>>();
 * overlay.value?.open(document.querySelector('#chart')!);
 */
defineExpose({ open, close });
</script>
