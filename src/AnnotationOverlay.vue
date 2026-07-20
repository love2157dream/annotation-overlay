<template>
    <teleport to="body">
        <div v-if="visible" class="anno-overlay" :style="overlayStyle">
            <!-- 可拖动的工具栏组 -->
            <div class="anno-topbar-group" ref="toolbarGroupRef" :style="toolbarGroupStyle" @mousedown="startDrag"
                @touchstart="startDragTouch">
                <div class="anno-toolbar" ref="toolbarElRef">
                    <!-- 拖动手柄 -->
                    <div class="anno-drag-handle" title="拖动工具栏">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <defs>
                                <circle id="dot" cx="0" cy="0" r="2" />
                            </defs>
                            <use href="#dot" x="5" y="5" />
                            <use href="#dot" x="12" y="5" />
                            <use href="#dot" x="19" y="5" />
                            <use href="#dot" x="5" y="12" />
                            <use href="#dot" x="12" y="12" />
                            <use href="#dot" x="19" y="12" />
                            <use href="#dot" x="5" y="19" />
                            <use href="#dot" x="12" y="19" />
                            <use href="#dot" x="19" y="19" />
                        </svg>
                    </div>

                    <div class="anno-sep"></div>

                    <button v-for="(t, idx) in tools" :key="t.id" :ref="(el: any) => setToolBtnRef(el, idx)"
                        class="anno-tool-btn" :class="{ active: currentTool === t.id }" :title="t.label"
                        @click="selectTool(t.id)">
                        <component :is="t.render" />
                    </button>

                    <div class="anno-sep"></div>
                    <button class="anno-tool-btn" title="撤销 (Ctrl+Z)" :disabled="historyIndex <= 0" @click="undo">
                        <IconUndo />
                    </button>
                    <button class="anno-tool-btn" title="重做 (Ctrl+Shift+Z)"
                        :disabled="historyIndex >= history.length - 1" @click="redo">
                        <IconRedo />
                    </button>

                    <div class="anno-sep"></div>
                    <button class="anno-btn" @click="handleCancel">取消</button>
                    <!-- 确认按钮：只有选择了工具并且画布已初始化才启用 -->
                    <button class="anno-btn primary" @click="handleConfirm">确认</button>
                </div>

                <!-- 样式面板：跟随工具栏位置 -->
                <div v-if="showStylePanel" class="anno-style-panel" :style="stylePanelPosition">
                    <div class="anno-style-row">
                        <span class="anno-label">{{ isTextTool ? '大小' : '粗细' }}</span>
                        <input type="range" :min="isTextTool ? 8 : 1" :max="isTextTool ? 72 : 20"
                            v-model.number="sizeOrWidth" @input="applyStyle" />
                        <span class="anno-value">{{ sizeOrWidth }}{{ isTextTool ? 'px' : 'px' }}</span>
                    </div>
                    <div class="anno-style-row">
                        <span class="anno-label">颜色</span>
                        <div class="anno-color-list">
                            <span v-for="c in colors" :key="c" class="anno-swatch" :class="{ active: color === c }"
                                :style="{ background: c }" @click="setColor(c)"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Fabric 画布容器 -->
            <div class="anno-canvas-wrap" :style="{ pointerEvents: currentTool ? 'auto' : 'none' }">
                <canvas ref="canvasElRef"></canvas>
            </div>
        </div>
    </teleport>
</template>


<script setup lang="ts">
import { ref, computed, nextTick, h, type VNode, onUnmounted } from 'vue';
import * as fabric from 'fabric';
import { snapdom } from '@zumer/snapdom';
import { ConfirmPayload, ToolDef, ToolId } from './types';


/* ============================================================
 *  Props / Emits
 * ============================================================ */

const emit = defineEmits<{
    /** 确认标注：验证通过返回 返回截图 + 标注内容的 base64 和 Blob，验证失败返回 null */
    confirm: [payload: ConfirmPayload | null];
    /** 取消标注：不返回任何数据 */
    cancel: [];
    /** 截图前清理：父组件可在此事件中清理临时状态 */
    beforeCapture: [targetEl: HTMLElement]
    /** 截图完成：父组件可在此事件中恢复状态 */
    afterCapture: [targetEl: HTMLElement]
}>()


/* ============================================================
 *  响应式状态
 * ============================================================ */

/** 组件是否可见（控制 Teleport 显示/隐藏） */
const visible = ref(false);

/** canvas DOM 元素的引用 */
const canvasElRef = ref<HTMLCanvasElement | null>(null);

/** 当前选中的工具：空字符串表示无工具（选择/查看模式） */
const currentTool = ref<ToolId>('');

/** 当前选中的颜色（默认红色） */
const color = ref('#ff3b30');

/** 线条粗细（1-20px） */
const lineWidth = ref(4);

/** 文字大小（8-72px） */
const fontSize = ref(20);

/** 预设颜色列表 */
const colors = ['#ff3b30', '#ffb020', '#34c759', '#0a84ff', '#af52de', '#111111', '#ffffff'];

/** 画布是否已经截图初始化：初始化之前，overlay 整体点击穿透（只有工具栏能点） */
const canvasInitialized = ref(false);

/* ============================================================
 *  工具栏拖拽状态
 * ============================================================ */

/** 工具栏组 DOM 引用 */
const toolbarGroupRef = ref<HTMLElement | null>(null);

/** 工具栏位置 */
const toolbarPosition = ref({ x: 0, y: 0 });

/** 是否正在拖拽 */
let isDragging = false;

/** 拖拽偏移量 */
let dragOffset = { x: 0, y: 0 };

/** 工具栏是否使用自定义位置（默认居中） */
const isCustomPosition = ref(false);

/**
 * 工具栏组样式：位置固定，可拖动
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
    // 默认居中
    return {
        position: 'absolute' as const,
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 3,
    };
})

/**
 * 样式面板位置：跟随工具栏
 */
const stylePanelPosition = computed(() => {
    if (isCustomPosition.value) {
        // 固定定位时，样式面板相对于工具栏组绝对定位
        return {
            position: 'absolute' as const,
            left: '0px',
            top: '52px',
        };
    }
    // 居中时，样式面板跟随工具按钮
    return {
        position: 'absolute' as const,
        left: `${panelLeft.value}px`,
        top: '54px',
    };
})


/* ============================================================
 *  工具栏拖拽方法
 * ============================================================ */

/**
 * 鼠标拖拽开始
 */
function startDrag(e: MouseEvent): void {
    // 只有点击拖动手柄或工具栏空白区域才触发拖拽
    const target = e.target as HTMLElement;
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    // 如果点击的是按钮，不触发拖拽
    if (target.closest('button')) return;

    isDragging = true;
    const rect = toolbarGroupRef.value?.getBoundingClientRect();
    if (rect) {
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
    }

    // 切换到自定义位置
    if (!isCustomPosition.value && toolbarGroupRef.value) {
        const rect = toolbarGroupRef.value.getBoundingClientRect();
        toolbarPosition.value = {
            x: rect.left,
            y: rect.top,
        }
        isCustomPosition.value = true;
    }

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    e.preventDefault();
}

/**
 * 触摸拖拽开始（移动端支持）
 */
function startDragTouch(e: TouchEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    if (target.closest('button')) return;

    const touch = e.touches[0];
    isDragging = true;
    const rect = toolbarGroupRef.value?.getBoundingClientRect();
    if (rect) {
        dragOffset.x = touch.clientX - rect.left;
        dragOffset.y = touch.clientY - rect.top;
    }

    if (!isCustomPosition.value && toolbarGroupRef.value) {
        const rect = toolbarGroupRef.value.getBoundingClientRect();
        toolbarPosition.value = {
            x: rect.left,
            y: rect.top,
        }
        isCustomPosition.value = true;
    }

    document.addEventListener('touchmove', onDragTouch);
    document.addEventListener('touchend', endDragTouch);
    e.preventDefault();
}

/**
 * 鼠标拖拽中
 */
function onDrag(e: MouseEvent): void {
    if (!isDragging) return;
    // 限制在视口范围内
    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);

    // 获取工具栏尺寸
    const toolbarEl = toolbarGroupRef.value;
    if (toolbarEl) {
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        toolbarPosition.value = {
            x: Math.min(newX, maxX),
            y: Math.min(newY, maxY),
        };
    } else {
        toolbarPosition.value = {
            x: newX,
            y: newY,
        };
    }
}

/**
 * 触摸拖拽中
 */
function onDragTouch(e: TouchEvent): void {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = Math.max(0, touch.clientX - dragOffset.x);
    const newY = Math.max(0, touch.clientY - dragOffset.y);

    const toolbarEl = toolbarGroupRef.value;
    if (toolbarEl) {
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        toolbarPosition.value = {
            x: Math.min(newX, maxX),
            y: Math.min(newY, maxY),
        };
    } else {
        toolbarPosition.value = {
            x: newX,
            y: newY,
        };
    }
    e.preventDefault();
}

/**
 * 结束拖拽
 */
function endDrag(): void {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
}

/**
 * 结束触摸拖拽
 */
function endDragTouch(): void {
    isDragging = false;
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
}


/* ============================================================
 *   Fabric 实例与绘制状态
 * ============================================================ */

/** Fabric 画布实例 */
let fCanvas: fabric.Canvas | null = null;

/** 当前正在绘制的图形对象（矩形/椭圆/箭头等） */
let drawingObj: fabric.FabricObject | null = null;

/** 绘制起始点坐标 */
let startPoint: { x: number; y: number } | null = null;

/** 是否正在绘制中（用于防止重复保存历史） */
let isDrawing = false;


/* ============================================================
 *  历史记录（撤销/重做）
 * ============================================================ */

/** 历史状态：存储序列化后的对象数据 */
interface HistoryState {
    objects: any[];
}

/** 历史记录栈（存储所有操作状态） */
const history = ref<HistoryState[]>([]);

/** 当前历史索引（指向当前显示的状态） */
const historyIndex = ref(-1);

/** 是否正在恢复历史状态（防止递归保存，同时用于给 undo/redo 按钮做互斥判断） */
const isRestoring = ref(false);

/** 是否正在保存历史状态（防止并发保存） */
let isSaving = false;


/* ============================================================
 *  折线专属状态
 * ============================================================ */

/** 折线的所有顶点坐标 */
let polylinePoints: { x: number; y: number }[] = [];

/** 当前正在绘制的折线对象 */
let polylineObj: fabric.Polyline | null = null;


/* ============================================================
 *  文字编辑状态
 * ============================================================ */

/** 是否正在编辑文字 */
let isTextEditing = false;

/** 是否正在清除文字光标（防止递归） */
let isClearingCursor = false;


/* ============================================================
 *  计算属性
 * ============================================================ */

/** 当前是否为文字工具 */
const isTextTool = computed(() => currentTool.value === 'text');

/**
 * 粗细/大小 统一滑块值
 * - 文字工具时：控制字体大小
 * - 其他工具时：控制线条粗细
 */
const sizeOrWidth = computed({
    get: () => isTextTool.value ? fontSize.value : lineWidth.value,
    set: (val: number) => {
        if (isTextTool.value) {
            fontSize.value = val;
        } else {
            lineWidth.value = val;
        }
    }
})

/** 是否显示样式面板（只有支持样式调节的工具才显示） */
const showStylePanel = computed(() =>
    (['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'] as ToolId[]).includes(currentTool.value)
)


/* ============================================================
 *  Overlay 定位
 * ============================================================ */

/** 目标元素的位置和尺寸信息 */
interface Rect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** 覆盖层的位置尺寸（与目标元素对齐） */
const overlayRect = ref<Rect>({ left: 0, top: 0, width: 0, height: 0 });

/** 覆盖层样式：定位到目标元素位置，初始化前点击穿透 */
const overlayStyle = computed(() => ({
    left: `${overlayRect.value.left}px`,
    top: `${overlayRect.value.top}px`,
    width: `${overlayRect.value.width}px`,
    height: `${overlayRect.value.height}px`,
    pointerEvents: canvasInitialized.value ? ('auto' as const) : ('none' as const),
}));


/* ============================================================
 *   SVG 图标
 * ============================================================ */

/**
 * 创建 SVG 图标的渲染函数
 * @param d - SVG path 的 d 属性
 * @param viewBox - SVG viewBox 属性（默认 0 0 24 24）
 * @returns VNode 渲染函数
 */
function svgIcon(d: string, viewBox: string = '0 0 24 24') {
    return (): VNode =>
        h(
            'svg',
            {
                width: 20,
                height: 20,
                viewBox: viewBox,
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': 2,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round'
            },
            [h('path', { d })]
        );
}

/** 撤销图标 */
const IconUndo = svgIcon('M9 14L4 9l5-5M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5h-1');

/** 重做图标 */
const IconRedo = svgIcon('M15 14l5-5-5-5M20 9H9a5 5 0 00-5 5v0a5 5 0 005 5h1');


/* ============================================================
 *  工具定义列表
 * ============================================================ */

/** 所有可用的绘制工具 */
const tools: ToolDef[] = [
    { id: 'pen', label: '画笔', render: svgIcon('M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z M18.8 6.2 l-2.6 -2.2 M8 18L5.5 15.5') },
    { id: 'line', label: '折线', render: svgIcon('M2 20 L8 8 L14 16 L22 4') },
    { id: 'arrow', label: '箭头', render: svgIcon('M4 20L20 4M20 4h-8M20 4v8') },
    { id: 'rect', label: '矩形', render: svgIcon('M4 5h16v14H4z') },
    { id: 'ellipse', label: '椭圆', render: svgIcon('M12 6a8 6 0 100 12 8 6 0 000-12z') },
    { id: 'text', label: '文字', render: svgIcon('M5 5h14M12 5v14') },
];


/* ============================================================
 *  工具栏定位
 * ============================================================ */

/** 工具栏 DOM 元素引用 */
const toolbarElRef = ref<HTMLElement | null>(null);

/** 工具按钮 DOM 元素数组（用于定位样式面板） */
const toolBtnEls: (HTMLElement | null)[] = [];

/**
 * 设置工具按钮引用
 * @param el - DOM 元素
 * @param idx - 按钮索引
 */
function setToolBtnRef(el: any, idx: number): void {
    toolBtnEls[idx] = el as HTMLElement | null;
}

/** 样式面板的 left 偏移量（跟随当前工具按钮位置） */
const panelLeft = ref(0);

/**
 * 更新样式面板位置（对齐到当前选中的工具按钮）
 * @param id - 工具 ID
 */
function updatePanelPosition(id: ToolId): void {
    const idx = tools.findIndex((t) => t.id === id);
    const btn = toolBtnEls[idx];
    if (btn) {
        panelLeft.value = btn.offsetLeft;
    }
}


/* ============================================================
 *  历史记录管理
 * ============================================================ */

/**
 * 保存当前画布状态到历史记录
 * 会序列化所有非背景对象，存入 history 数组
 */
function saveState(): void {
    if (!fCanvas || isRestoring.value || isSaving) return;

    isSaving = true;

    try {
        // 获取所有非背景对象
        const objects = fCanvas.getObjects().filter(obj => obj !== fCanvas?.backgroundImage);
        // 序列化对象
        const serialized = objects.map(obj => obj.toJSON());

        // 如果当前不在历史末尾，删除之后的历史（新操作会覆盖重做分支）
        if (historyIndex.value < history.value.length - 1) {
            history.value = history.value.slice(0, historyIndex.value + 1);
        }

        // 添加新状态
        history.value.push({ objects: serialized });
        historyIndex.value = history.value.length - 1;

    } catch (error) {
        console.warn('保存状态失败:', error);
    } finally {
        isSaving = false;
    }
}

/**
 * 恢复到指定索引的历史状态
 * @param index - 历史记录索引
 */
async function restoreState(index: number): Promise<void> {
    if (!fCanvas || index < 0 || index >= history.value.length || isRestoring.value) return;

    isRestoring.value = true;

    try {
        const state = history.value[index];

        // 清除所有非背景对象
        const objects = fCanvas.getObjects().filter(obj => obj !== fCanvas?.backgroundImage);
        objects.forEach(obj => fCanvas?.remove(obj));

        // 恢复对象
        if (state.objects.length > 0) {
            try {
                const restoredObjects = await fabric.util.enlivenObjects(state.objects);
                if (fCanvas) {
                    (restoredObjects as any[]).forEach((obj: any) => {
                        if (obj && obj.type) {
                            fCanvas?.add(obj as fabric.FabricObject)
                        }
                    });
                    fCanvas.requestRenderAll();
                }
            } catch (err) {
                console.warn('恢复对象失败:', err);
            }
        }

        fCanvas?.renderAll();

    } catch (error) {
        console.warn('恢复状态失败:', error);
    } finally {
        isRestoring.value = false;
    }
}

/**
 * 撤销：回到上一个历史状态
 * 增加 isRestoring 保护，避免连续快速点击导致 historyIndex 与画布状态错位
 */
async function undo(): Promise<void> {
    if (isRestoring.value || historyIndex.value <= 0) return;
    historyIndex.value--;
    await restoreState(historyIndex.value);
}

/**
 * 重做：前进到下一个历史状态
 * 增加 isRestoring 保护，避免连续快速点击导致 historyIndex 与画布状态错位
 */
async function redo(): Promise<void> {
    if (isRestoring.value || historyIndex.value >= history.value.length - 1) return;
    historyIndex.value++;
    await restoreState(historyIndex.value);
}


/* ============================================================
 *  组件公开 API
 * ============================================================ */

/** 目标元素引用（用于延迟截图） */
let pendingTargetEl: HTMLElement = document.body;

/**
 * 打开标注组件
 * @param targetEl - 要截图标注的目标 DOM 元素（默认 body）
 * 
 * @example
 * const annoRef = ref<InstanceType<typeof AnnotationOverlay>>()
 * // 点击按钮时打开标注
 * annoRef.value?.open(document.querySelector('.target-area'))
 */
async function open(targetEl: HTMLElement = document.body): Promise<void> {
    pendingTargetEl = targetEl;

    // 先定位 overlay 区域、显示工具栏，不截图、不创建 Fabric 画布
    const rect = targetEl.getBoundingClientRect();
    overlayRect.value = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
    visible.value = true;
    await nextTick();
}

/**
 * 关闭标注组件
 */
function close(): void {
    if (fCanvas) {
        fCanvas.dispose();
        fCanvas = null;
    }
    history.value = [];
    historyIndex.value = -1;
    currentTool.value = '';
    polylineObj = null;
    polylinePoints = [];
    isTextEditing = false;
    isDrawing = false;
    isRestoring.value = false;
    canvasInitialized.value = false;
    isCustomPosition.value = false;
    toolbarPosition.value = { x: 0, y: 0 };
    visible.value = false;
}

// 暴露给父组件的方法
defineExpose({ open, close });


/* ============================================================
 *  坐标转换工具
 * ============================================================ */

/**
 * 将鼠标事件转换为画布逻辑坐标
 * 处理了 CSS 缩放与画布逻辑尺寸的映射关系
 * @param e - 鼠标事件
 * @returns 画布逻辑坐标 { x, y }
 */
function getCanvasPointer(e: MouseEvent): { x: number; y: number } {
    if (!fCanvas) return { x: 0, y: 0 };

    const canvasEl = fCanvas.getElement();
    const rect = canvasEl.getBoundingClientRect();

    // 计算鼠标在画布上的相对位置（百分比）
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;

    // 转换为画布逻辑坐标
    const width = fCanvas.getWidth();
    const height = fCanvas.getHeight();

    return {
        x: relativeX * width,
        y: relativeY * height
    };
}


/* ============================================================
 *  文字光标清除 / 文字编辑退出
 * ============================================================ */

/**
 * 清除 IText 对象的光标和编辑状态
 * 用于退出文字编辑时彻底清除光标残留
 * @param textObj - IText 对象
 */
function clearTextCursor(textObj: fabric.IText): void {
    if (!textObj || isClearingCursor) return;

    isClearingCursor = true;

    try {
        // 获取隐藏的 textarea
        const obj = textObj as any;
        if (obj.hiddenTextarea) {
            const textarea = obj.hiddenTextarea as HTMLTextAreaElement;
            textarea.blur();
            textarea.style.display = 'none';
            if (textarea.parentNode) {
                textarea.parentNode.removeChild(textarea);
            }
            obj.hiddenTextarea = null;
        }

        // 重置光标相关属性
        textObj.selectionStart = 0;
        textObj.selectionEnd = 0;
        textObj.cursorWidth = 0;
        textObj.cursorDelay = 0;
        textObj.cursorDuration = 0;
        textObj.cursorColor = 'transparent';
        textObj.isEditing = false;

        if (textObj.canvas) {
            textObj.canvas.renderAll();
        }
    } catch (error) {
        console.warn('清除文字光标时出错:', error);
    } finally {
        isClearingCursor = false;
    }
}

/**
 * 统一的"退出文字编辑"入口
 * 不依赖 Fabric 的 text:editing:exited 事件是否触发，
 * 手动退出编辑时同步保存历史状态，避免文字操作丢失。
 *
 * 之前的问题：clearTextCursor 内部会把 textObj.isEditing 提前置为 false，
 * 导致后续调用 fCanvas.discardActiveObject() 时，Fabric 内部判断对象已经
 * 不处于编辑态，从而不会走 exitEditing() 分支，text:editing:exited 事件
 * 不会触发，唯一挂在该事件上的 saveState() 也就永远不会被调用。
 * 这里改为退出编辑后显式、同步地调用一次 saveState()。
 */
function exitTextEditing(): void {
    if (!fCanvas) return;

    const activeObj = fCanvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
        const textObj = activeObj as fabric.IText;
        clearTextCursor(textObj);

        // 空文字自动删除，不产生历史记录
        if (textObj.text === '') {
            fCanvas.remove(textObj);
            fCanvas.discardActiveObject();
            fCanvas.requestRenderAll();
            isTextEditing = false;
            return;
        }
    }

    fCanvas.discardActiveObject();
    fCanvas.requestRenderAll();
    isTextEditing = false;

    // 显式同步保存，不依赖 text:editing:exited 事件
    saveState();
}


/* ============================================================
 *  画布初始化（截图 + 创建 Fabric 实例）
 * ============================================================ */

/**
 * 初始化画布：截图目标元素并创建 Fabric 实例
 * 在用户第一次选中工具时调用
 * @param targetEl - 目标 DOM 元素
 */
async function initCanvasWithScreenshot(targetEl: HTMLElement): Promise<void> {
    // 获取目标元素位置尺寸
    const rect = targetEl.getBoundingClientRect();
    overlayRect.value = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
    await nextTick();

    // 触发截图前清理事件
    emit('beforeCapture', targetEl);

    // 等待一帧，确保父组件的清理操作已执行
    await nextTick();

    // 截图目标元素 - 使用 snapdom
    let bgDataURL: string;

    try {
        const shotCanvas = await snapdom.toCanvas(targetEl);
        bgDataURL = shotCanvas.toDataURL('image/png');
    } catch (error) {
        console.warn('截图失败:', error);
        bgDataURL = '';
    }

    // 触发截图完成后恢复事件
    emit('afterCapture', targetEl)

    const displayWidth = rect.width;
    const displayHeight = rect.height;

    if (!canvasElRef.value) return;

    // 创建 Fabric 画布
    fCanvas = new fabric.Canvas(canvasElRef.value, {
        selection: false,           // 禁用默认框选
        width: displayWidth,
        height: displayHeight,
        enableRetinaScaling: false, // 关闭视网膜缩放，保持坐标 1:1
    });

    // 设置画布 CSS 尺寸
    const canvasEl = fCanvas.getElement();
    canvasEl.style.width = displayWidth + 'px';
    canvasEl.style.height = displayHeight + 'px';
    canvasEl.width = displayWidth;
    canvasEl.height = displayHeight;

    // 设置画笔
    fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
    fCanvas.freeDrawingBrush.color = color.value;
    fCanvas.freeDrawingBrush.width = lineWidth.value;

    // 加载截图作为背景
    const img = await fabric.FabricImage.fromURL(bgDataURL);
    img.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        scaleX: displayWidth / (img.width || displayWidth),
        scaleY: displayHeight / (img.height || displayHeight),
    });
    fCanvas.backgroundImage = img;
    fCanvas.requestRenderAll();

    // 保存初始状态
    saveState();

    // 绑定绘制事件
    bindDrawingEvents();

    // 右键取消折线
    const upperCanvasEl = fCanvas.upperCanvasEl;
    upperCanvasEl?.addEventListener(
        'contextmenu',
        (e: MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (currentTool.value === 'line') {
                finalizePolyline()
            }
        },
        { capture: true }
    );

    // 绑定键盘事件
    document.addEventListener('keydown', handleKeyDown);

    // 标记画布已初始化
    canvasInitialized.value = true;
}


/* ============================================================
 *  键盘事件处理
 * ============================================================ */

/**
 * 全局键盘事件处理器
 * 支持：ESC 取消、Ctrl+Z 撤销、Ctrl+Shift+Z/Ctrl+Y 重做
 */
function handleKeyDown(e: KeyboardEvent): void {
    // ESC 退出文字编辑
    if (e.key === 'Escape') {
        exitTextEditing();
        currentTool.value = '';
        handleCancel();
        return;
    }

    // 检查是否按下了 Ctrl 或 Cmd
    const isModifierPressed = e.ctrlKey || e.metaKey;
    if (!isModifierPressed) return;

    const key = e.key.toLowerCase();

    // 撤销: Ctrl+Z (或 Cmd+Z)
    if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
    }

    // 重做: Ctrl+Shift+Z (或 Cmd+Shift+Z)
    if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
    }

    // 重做: Ctrl+Y (或 Cmd+Y)
    if (key === 'y') {
        e.preventDefault();
        redo();
        return;
    }
}


/* ============================================================
 *  样式应用
 * ============================================================ */

/**
 * 应用当前样式（粗细/大小 + 颜色）到画笔或选中的文字
 */
function applyStyle(): void {
    if (!fCanvas) return;

    // 更新画笔样式
    if (fCanvas.freeDrawingBrush) {
        fCanvas.freeDrawingBrush.color = color.value;
        fCanvas.freeDrawingBrush.width = lineWidth.value;
    }

    // 如果有选中的文字对象，更新其大小
    const activeObj = fCanvas.getActiveObject();

    if (activeObj && activeObj.type === 'i-text') {
        const textObj = activeObj as fabric.IText;
        textObj.set({
            fontSize: fontSize.value
        });
        fCanvas.requestRenderAll();
    }
}


/* ============================================================
 *  工具切换
 * ============================================================ */

/**
 * 切换绘制工具
 * @param id - 工具 ID
 * 
 * 首次选中工具时，会触发截图初始化
 */
async function selectTool(id: ToolId): Promise<void> {
    // 第一次选中任意工具（且画布还没初始化）时，截图并创建 Fabric 画布
    if (id !== '' && !fCanvas) {
        await initCanvasWithScreenshot(pendingTargetEl);
    }

    // 如果正在编辑文字，先退出（统一走 exitTextEditing，保证历史被保存）
    if (isTextEditing) {
        exitTextEditing();
    }

    // 从折线切换到其他工具时，结束当前折线
    if (currentTool.value === 'line' && id !== 'line') {
        finalizePolyline();
    }

    currentTool.value = id;
    if (!fCanvas) return;

    // 画笔工具启用 Fabric 的 isDrawingMode
    fCanvas.isDrawingMode = id === 'pen'
    if (id === 'pen' && fCanvas.freeDrawingBrush) {
        fCanvas.freeDrawingBrush.color = color.value;
        fCanvas.freeDrawingBrush.width = lineWidth.value;
    }

    // 只有"没有选中任何绘制工具"（普通选择模式）时才允许框选
    fCanvas.selection = id === '';

    await nextTick();
    updatePanelPosition(id);
}


/* ============================================================
 *  颜色设置
 * ============================================================ */

/**
 * 设置当前颜色
 * @param c - 颜色值（十六进制字符串）
 * 同时更新选中的文字对象颜色
 */
function setColor(c: string): void {
    color.value = c;

    if (fCanvas) {
        const activeObj = fCanvas.getActiveObject();
        if (activeObj && activeObj.type === 'i-text') {
            const textObj = activeObj as fabric.IText;
            textObj.set({
                fill: color.value
            });
            fCanvas.requestRenderAll();
        }
    }

    applyStyle();
}

/* ============================================================
 *  控制手柄配置
 * ============================================================ */

/**
 * 控制手柄配置接口
 */
interface ControlConfig {
    cornerStyle: 'rect' | 'circle'
    cornerSize: number
    cornerColor: string
    cornerStrokeColor: string
    transparentCorners: boolean
    borderColor: string
    borderDashArray: number[]
    borderOpacityWhenMoving: number
    selectionBackgroundColor: string
    padding: number
    objectCaching: boolean
}

/**
 * 获取控制手柄的默认配置
 */
function getDefaultControlConfig(): ControlConfig {
    return {
        cornerStyle: 'circle',
        cornerSize: 10,
        cornerColor: '#4f6bff',
        cornerStrokeColor: '#4f6bff',
        transparentCorners: false,
        borderColor: '#4f6bff',
        borderDashArray: [4, 4],
        borderOpacityWhenMoving: 0.5,
        selectionBackgroundColor: 'rgba(79, 107, 255, 0.1)',
        padding: 8,
        objectCaching: false,
    }
}

/**
 * 为对象应用控制手柄配置
 * @param obj - Fabric 对象
 * @param config - 控制手柄配置（可选，默认使用 getDefaultControlConfig）
 */
function applyControlConfig(
    obj: fabric.FabricObject,
    config: Partial<ControlConfig> = {}
): void {
    const defaultConfig = getDefaultControlConfig()
    const mergedConfig = { ...defaultConfig, ...config }

    obj.set(mergedConfig)
    obj.objectCaching = false
    obj.setCoords()
}

/**
 * 为对象启用选中状态（带控制手柄）
 * @param obj - Fabric 对象
 */
function enableSelectable(obj: fabric.FabricObject): void {
    obj.set({
        selectable: true,
        hasControls: true,
        hasBorders: true,
        evented: true,
    })
    applyControlConfig(obj)
}

/**
 * 为对象禁用选中状态（绘制过程中）
 * @param obj - Fabric 对象
 */
function disableSelectable(obj: fabric.FabricObject): void {
    obj.set({
        selectable: false,
        hasControls: false,
        hasBorders: false,
        evented: false,
    })
}

/**
 * 刷新当前选中对象的控制手柄
 */
function refreshControls(): void {
    if (!fCanvas) return

    const activeObj = fCanvas.getActiveObject()
    if (activeObj) {
        applyControlConfig(activeObj)
        fCanvas.requestRenderAll()
    }
}

/**
 * 保证对象的包围盒宽高都不小于 minSize,避免退化成扁平矩形
 * 导致 Fabric 角控制点的 resize 光标方向计算错误(全部变成水平方向)
 */
function ensureMinBoundingBox(obj: fabric.FabricObject, minSize = 10): void {
    if (!fCanvas) return;
    obj.setCoords();
    const w = obj.getScaledWidth();
    const h = obj.getScaledHeight();

    if (w < minSize) {
        const scaleX = (obj.scaleX || 1) * (minSize / Math.max(w, 0.01));
        obj.set({ scaleX });
    }
    if (h < minSize) {
        const scaleY = (obj.scaleY || 1) * (minSize / Math.max(h, 0.01));
        obj.set({ scaleY });
    }
    obj.setCoords();
    fCanvas.requestRenderAll();
}

/* ============================================================
 *  绘制事件绑定
 * ============================================================ */

/**
 * 绑定 Fabric 画布的鼠标事件
 * 包括：mouse:down, mouse:move, mouse:up, 等
 */
function bindDrawingEvents(): void {
    if (!fCanvas) return;

    /** 鼠标按下：开始绘制或处理折线点击 */
    fCanvas.on('mouse:down', (opt: fabric.TPointerEventInfo) => {

        if (!fCanvas || fCanvas.isDrawingMode || !currentTool.value) return;

        const nativeEvt = opt.e as MouseEvent;
        if (nativeEvt.button === 2) return;

        const target = opt.target;

        // 折线工具：允许点击任何位置继续添加点
        if (currentTool.value === 'line' && polylineObj) {
            const p = getCanvasPointer(nativeEvt);
            handlePolylineClick(p);
            return;
        }

        // 点击已有对象时不绘制（允许选择/拖拽）
        if (target) {
            return;
        }

        // 点击空白区域取消选中
        fCanvas?.discardActiveObject();
        fCanvas?.renderAll();

        // 如果正在编辑文字，退出编辑（统一走 exitTextEditing，保证历史被保存）
        if (isTextEditing) {
            exitTextEditing();
            return;
        }

        const p = getCanvasPointer(nativeEvt);

        // 折线工具：开始或继续绘制
        if (currentTool.value === 'line') {
            handlePolylineClick(p);
            return;
        }

        // 文字工具：创建文本框并进入编辑
        if (currentTool.value === 'text') {
            createTextAt(p);
            return;
        }

        // 其他形状：记录起始点，创建形状对象
        startPoint = { x: p.x, y: p.y };
        isDrawing = true;

        const shape = createShape(currentTool.value, p);
        if (shape) {
            drawingObj = shape;
            fCanvas.add(shape);
        }
    })

    /** 鼠标移动：更新正在绘制的形状 */
    fCanvas.on('mouse:move', (opt: fabric.TPointerEventInfo) => {
        if (!fCanvas) return;
        const nativeEvt = opt.e as MouseEvent;
        const p = getCanvasPointer(nativeEvt);

        // 折线预览：鼠标移动时更新最后一个点
        if (currentTool.value === 'line' && polylineObj && polylinePoints.length) {
            polylinePoints[polylinePoints.length - 1] = { x: p.x, y: p.y };
            updatePolylinePoints();
            fCanvas.requestRenderAll();
            return;
        }

        // 更新当前绘制的形状
        if (!drawingObj || !startPoint) return;
        updateShape(currentTool.value, drawingObj, startPoint, p);
        fCanvas.requestRenderAll();
    })

    /** 鼠标释放：完成绘制，保存状态 */
    fCanvas.on('mouse:up', () => {
        if (drawingObj) {
            // 绘制完成后允许选择
            drawingObj.set({ selectable: true, evented: true, });
            ensureMinBoundingBox(drawingObj); // 加在这里,rect/ellipse 已经有保护,调用无副作用
            drawingObj.setCoords();
            saveState();
            drawingObj = null;
            startPoint = null;
        }
        isDrawing = false;
    })

    /** 双击：结束折线绘制 */
    fCanvas.on('mouse:dblclick', () => {
        if (currentTool.value === 'line') {
            finalizePolyline();
        }
    })

    /** 路径创建完成（画笔工具） */
    fCanvas.on('path:created', (e: any) => {
        const path = e.path as fabric.Path;
        if (path) ensureMinBoundingBox(path);
        saveState();
    })

    /** 对象修改完成（拖拽/缩放/旋转） */
    fCanvas.on('object:modified', () => {
        saveState();
    })

    /** 文字进入编辑 */
    fCanvas.on('text:editing:entered', () => {
        isTextEditing = true;
    })

    /**
     * 文字退出编辑（兜底）
     * 正常情况下手动退出编辑都已经在 exitTextEditing() 里同步保存过了；
     * 这里作为 Fabric 内部自身触发退出编辑场景（例如点击画布外区域导致
     * 原生 blur）的兜底保存，同步调用，不再使用 setTimeout 延迟，
     * 避免和 undo/redo 之间产生竞态导致重做分支被错误截断。
     */
    fCanvas.on('text:editing:exited', () => {
        if (isClearingCursor) return;

        isTextEditing = false;
        if (!fCanvas) return;

        const activeObj = fCanvas.getActiveObject();
        if (activeObj && 'text' in activeObj && typeof activeObj.text === 'string') {
            const textObj = activeObj as fabric.IText;

            // 空文字自动删除
            if (textObj.text === '') {
                fCanvas.remove(textObj);
                fCanvas.discardActiveObject();
            } else {
                fCanvas.discardActiveObject();
                saveState();
            }
        }
        fCanvas.requestRenderAll();
    })

    /** 选中对象时更新样式面板 */
    fCanvas.on('selection:created', (e: any) => {
        const selected = e.selected?.[0];
        if (selected && selected.type === 'i-text') {
            const textObj = selected as fabric.IText;
            fontSize.value = textObj.fontSize || 20;
            color.value = textObj.fill as string || '#ff3b30';
            textObj.cursorColor = color.value;
        }
    })

    /** 选中对象更新时更新样式面板 */
    fCanvas.on('selection:updated', (e: any) => {
        const selected = e.selected?.[0];
        if (selected && selected.type === 'i-text') {
            const textObj = selected as fabric.IText;
            fontSize.value = textObj.fontSize || 20;
            color.value = textObj.fill as string || '#ff3b30';
            textObj.cursorColor = color.value;
        }
    })
}


/* ============================================================
 *  文字创建
 * ============================================================ */

/**
 * 在指定位置创建文字并进入编辑
 * @param p - 位置坐标 { x, y }
 */
function createTextAt(p: { x: number; y: number }): void {
    if (!fCanvas) return;

    const text = new fabric.IText('', {
        left: p.x,
        top: p.y,
        fill: color.value,
        fontSize: fontSize.value,
        fontFamily: 'Arial',
        selectable: true,
        hasControls: true,
        cursorColor: color.value,
        cursorWidth: 2,
        // ...getDefaultControlConfig(), // 应用控制手柄配置
    });

    fCanvas.add(text);
    fCanvas.setActiveObject(text);
    fCanvas.requestRenderAll();

    // 延迟进入编辑模式，确保 DOM 已更新
    setTimeout(() => {
        text.enterEditing();
        const textarea = text.hiddenTextarea as HTMLTextAreaElement | null;
        if (textarea) {
            textarea.focus();
            textarea.selectionStart = 0;
            textarea.selectionEnd = 0;
        }
        isTextEditing = true;
    }, 100)
}

/* ============================================================
 * 27. 折线功能
 * ============================================================ */

/**
 * 处理折线点击：添加或追加顶点
 * @param p - 点击位置坐标
 */
function handlePolylineClick(p: { x: number; y: number }): void {
    if (!fCanvas) return;
    if (!polylineObj) {
        // 第一个点：起点和预览点重合
        polylinePoints = [
            { x: p.x, y: p.y },
            { x: p.x, y: p.y },
        ];
    } else {
        // 后续点击：将预览点固定为新点，并创建新的预览点
        polylinePoints[polylinePoints.length - 1] = { x: p.x, y: p.y };
        polylinePoints.push({ x: p.x, y: p.y });
    }
    updatePolylinePoints();
    fCanvas.requestRenderAll();
}

/**
 * 更新折线对象（重建 Polyline）
 * 因 Fabric 的 Polyline 更新 points 后不会自动重算，需重建
 */
function updatePolylinePoints(): void {
    if (!fCanvas) return;
    if (polylineObj) fCanvas.remove(polylineObj as unknown as fabric.FabricObject);
    polylineObj = new fabric.Polyline(polylinePoints, {
        stroke: color.value,
        fill: 'transparent',
        strokeWidth: lineWidth.value,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        objectCaching: false,
    });
    fCanvas.add(polylineObj);
}

/**
 * 完成折线绘制：移除多余的预览点，保存状态
 */
function finalizePolyline(): void {
    if (polylineObj) {
        if (polylinePoints.length > 2) {
            polylinePoints.pop();
            updatePolylinePoints();
        }
        if (polylineObj) ensureMinBoundingBox(polylineObj as unknown as fabric.FabricObject);
        saveState();
    }
    polylineObj = null;
    polylinePoints = [];
}


/* ============================================================
 *  形状创建和更新
 * ============================================================ */

/**
 * 创建形状对象（矩形/椭圆/箭头）
 * @param tool - 工具类型
 * @param p - 起始位置坐标
 * @returns Fabric 对象
 */
function createShape(tool: ToolId, p: { x: number; y: number }): fabric.FabricObject | null {
    const common = {
        left: p.x,
        top: p.y,
        stroke: color.value,
        fill: 'transparent',
        strokeWidth: lineWidth.value,
    };
    // 绘制过程中禁止选择/响应事件，避免和默认框选行为叠加
    const duringDrawProps = {
        selectable: false,
        evented: false,
    };
    switch (tool) {
        case 'rect':
            return new fabric.Rect({
                ...common,
                ...duringDrawProps,
                width: 1,
                height: 1,
                originX: 'left',
                originY: 'top',
            });
        case 'ellipse':
            return new fabric.Ellipse({
                ...common,
                ...duringDrawProps,
                rx: 1,
                ry: 1,
                originX: 'center',
                originY: 'center',
            });
        case 'arrow':
            return createArrow(p, p);
        default:
            return null;
    }
}

/**
 * 更新形状尺寸（跟随鼠标拖动）
 * @param tool - 工具类型
 * @param obj - 要更新的对象
 * @param start - 起始点坐标
 * @param p - 当前鼠标位置
 */
function updateShape(
    tool: ToolId,
    obj: fabric.FabricObject,
    start: { x: number; y: number },
    p: { x: number; y: number }
): void {
    if (!fCanvas) return;

    const width = p.x - start.x;
    const height = p.y - start.y;

    switch (tool) {
        case 'rect': {
            const rectObj = obj as fabric.Rect;
            // 根据鼠标方向调整位置
            const left = width >= 0 ? start.x : p.x;
            const top = height >= 0 ? start.y : p.y;

            rectObj.set({
                left: left,
                top: top,
                width: Math.abs(width) || 1,
                height: Math.abs(height) || 1,
            });
            rectObj.setCoords();
            break;
        }
        case 'ellipse': {
            const ellipseObj = obj as fabric.Ellipse;
            // 椭圆以中心点定位
            const cx = (start.x + p.x) / 2;
            const cy = (start.y + p.y) / 2;

            ellipseObj.set({
                left: cx,
                top: cy,
                rx: Math.abs(width) / 2 || 1,
                ry: Math.abs(height) / 2 || 1,
            });
            ellipseObj.setCoords();
            break;
        }
        case 'arrow':
            fCanvas.remove(obj as any);
            drawingObj = createArrow(start, p);
            fCanvas.add(drawingObj);
            break;
    }
}

/**
 * 创建箭头对象（线 + 三角形组合）
 * @param start - 起始点坐标
 * @param end - 终点坐标
 * @returns Fabric Group
 */
function createArrow(start: { x: number; y: number }, end: { x: number; y: number }): fabric.Group {
    const line = new fabric.Line([start.x, start.y, end.x, end.y], {
        stroke: color.value,
        strokeWidth: lineWidth.value,
        selectable: false,
    });
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
    const head = new fabric.Triangle({
        left: end.x,
        top: end.y,
        originX: 'center',
        originY: 'center',
        angle: angle + 90,
        width: 10 + lineWidth.value * 2,
        height: 12 + lineWidth.value * 2,
        fill: color.value,
        evented: false,
        selectable: false,
    });
    return new fabric.Group([line, head], { selectable: false });
}


/* ============================================================
 *  取消 / 确认
 * ============================================================ */

/**
 * 取消标注：触发 cancel 事件并关闭
 */
function handleCancel(): void {
    emit('cancel');
    close();
}

/**
 * 检查是否可以进行有效的标注确认
 */
function isValidAnnotation(): boolean {
    if (!canvasInitialized.value || !fCanvas) return false;

    // 1. 检查是否有工具被选中（允许用户先选工具再绘制）
    const hasTool = currentTool.value !== '';

    // 2. 检查是否有实际的标注内容（非背景对象）
    const objects = fCanvas.getObjects().filter(obj => obj !== fCanvas?.backgroundImage);
    const hasContent = objects.length > 0;

    // 必须同时满足：有工具选中 且 有标注内容
    return hasTool && hasContent;
}

/**
 * 确认标注：导出截图 + 标注，触发 confirm 事件
 */
function handleConfirm(): void {
    // 退出文字编辑（统一走 exitTextEditing，保证历史被保存，
    // 同时也会正确处理空文字被删除的情况）
    if (isTextEditing) {
        exitTextEditing();
    }

    // 完成当前折线
    if (currentTool.value === 'line') {
        finalizePolyline();
    }

    if (!fCanvas) {
        emit('confirm', null);
        close();
        return;
    }

    // 导出图片
    const dpr = window.devicePixelRatio || 1;
    const base64 = fCanvas.toDataURL({ format: 'png', multiplier: dpr });

    fCanvas.getElement().toBlob((blob) => {
        if (blob) {
            emit('confirm', { base64, blob });
        }
        close();
    }, 'image/png');
}


/* ============================================================
 *  生命周期
 * ============================================================ */

/** 组件卸载时清理资源 */
onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
    if (fCanvas) {
        fCanvas.dispose();
        fCanvas = null;
    }
})
</script>

<style scoped>
/* ============================================================
 *  组件样式
 * ============================================================ */

/** 覆盖层容器：固定定位，覆盖目标元素区域 */
.anno-overlay {
    position: fixed;
    z-index: 9999;
    overflow: hidden;
}

/** 画布容器：填满覆盖层 */
.anno-canvas-wrap {
    position: absolute;
    inset: 0;
}

/** 画布填满容器 */
.anno-canvas-wrap canvas {
    width: 100% !important;
    height: 100% !important;
}

/** 可拖动的顶部工具栏组 */
.anno-topbar-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    z-index: 3;
    max-width: calc(100% - 16px);
    pointer-events: auto;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
}

.anno-topbar-group:active {
    cursor: grabbing;
}

/** 拖动手柄 */
.anno-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 34px;
    cursor: grab;
    color: #999;
    transition: color 0.2s;
    flex-shrink: 0;
}

.anno-drag-handle:hover {
    color: #555;
}

.anno-drag-handle:active {
    cursor: grabbing;
}

/** 工具栏：白色背景，圆角阴影 */
.anno-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    cursor: default;
}

/** 样式面板：跟随工具栏位置 */
.anno-style-panel {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 10px;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    font-size: 13px;
    color: #555;
    min-width: 140px;
    cursor: default;
}

/** 样式行：水平排列 */
.anno-style-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

/** 滑块样式 */
.anno-style-row input[type="range"] {
    flex: 1;
    min-width: 80px;
    cursor: pointer;
}

/** 数值显示 */
.anno-value {
    min-width: 32px;
    text-align: right;
    font-size: 12px;
    color: #888;
}

/** 颜色列表：水平排列 */
.anno-color-list {
    display: flex;
    gap: 6px;
}

/** 标签文字 */
.anno-label {
    color: #888;
    font-size: 12px;
    min-width: 28px;
}

/** 工具按钮：34x34，图标居中 */
.anno-tool-btn {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: #444;
    cursor: pointer;
    padding: 0;
}

/** 工具按钮 SVG */
.anno-tool-btn svg {
    display: block;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

/** 工具按钮悬停 */
.anno-tool-btn:hover {
    background: #f0f0f0;
}

/** 工具按钮激活 */
.anno-tool-btn.active {
    background: #eef2ff;
    color: #4f6bff;
}

/** 工具按钮禁用 */
.anno-tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/** 分隔线 */
.anno-sep {
    width: 1px;
    height: 20px;
    background: #eee;
    margin: 0 4px;
    flex-shrink: 0;
}

/** 操作按钮（取消/确认） */
.anno-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid #ddd;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
}

/** 确认按钮（主色） */
.anno-btn.primary {
    background: #4f6bff;
    border-color: #4f6bff;
    color: #fff;
}

/** 颜色色块 */
.anno-swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #ddd;
    cursor: pointer;
    flex-shrink: 0;
}

/** 颜色色块激活 */
.anno-swatch.active {
    border-color: #4f6bff;
}
</style>