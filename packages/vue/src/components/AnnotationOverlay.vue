<template>
    <teleport to="body">
        <div v-if="visible" class="anno-overlay" :style="overlayStyle">
            <!-- 可拖动的工具栏组 -->
            <div class="anno-topbar-group" ref="toolbarGroupRef" :style="toolbarGroupStyle" @mousedown="startDrag"
                @touchstart="startDragTouch">
                <Toolbar :current-tool="currentTool" :can-undo="canUndo" :can-redo="canRedo"
                    @select-tool="handleSelectTool" @undo="handleUndo" @redo="handleRedo" @cancel="handleCancel"
                    @confirm="handleConfirm" />

                <StylePanel v-if="showStylePanel" :current-color="color" :line-width="lineWidth" :font-size="fontSize"
                    :is-text-tool="isTextTool" :panel-left="panelLeft" :is-custom-position="isCustomPosition"
                    @update-style="handleUpdateStyle" @set-color="handleSetColor" @commit-style="handleCommitStyle" />
            </div>

            <!-- Fabric 画布容器 -->
            <div class="anno-canvas-wrap">
                <canvas ref="canvasRef"></canvas>
            </div>
        </div>
    </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { type ToolId, type ConfirmPayload, domCapture } from '@laoliangfe/annotation-overlay-core';
import { useAnnotationEngine } from '../composables/useAnnotationEngine';
import Toolbar from './Toolbar.vue';
import StylePanel from './StylePanel.vue';

// ============================================================
// Props / Emits
// ============================================================
const emit = defineEmits<{
    confirm: [payload: ConfirmPayload | null];
    cancel: [];
    beforeCapture: [targetEl: HTMLElement];
    afterCapture: [targetEl: HTMLElement];
}>();

// ============================================================
// 状态
// ============================================================
const visible = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const toolbarGroupRef = ref<HTMLElement | null>(null);

const color = ref('#ff3b30');
const lineWidth = ref(4);
const fontSize = ref(20);

// 引擎
const {
    engine,
    isInitialized,
    currentTool,
    canUndo,
    canRedo,
    activeObjectType,
    init,
    selectTool,
    setStyle,
    undo,
    redo,
    exportImage,
    dispose,
} = useAnnotationEngine();

// 拖拽状态
const toolbarPosition = ref({ x: 0, y: 0 });
const isCustomPosition = ref(false);
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let panelLeft = ref(0);

// 目标元素
let pendingTargetEl: HTMLElement = document.body;

// ============================================================
// 计算属性
// ============================================================
const isTextTool = computed(() => currentTool.value === 'text');

const showStylePanel = computed(() =>
    (['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'] as ToolId[]).includes(currentTool.value) ||
    activeObjectType.value !== null
);

const overlayRect = ref({ left: 0, top: 0, width: 0, height: 0 });
const overlayStyle = computed(() => ({
    left: `${overlayRect.value.left}px`,
    top: `${overlayRect.value.top}px`,
    width: `${overlayRect.value.width}px`,
    height: `${overlayRect.value.height}px`,
    pointerEvents: isInitialized.value ? ('auto' as const) : ('none' as const),
}));

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
// 方法
// ============================================================
const open = async (targetEl: HTMLElement): Promise<void> => {
    pendingTargetEl = targetEl;
    const rect = targetEl.getBoundingClientRect();
    overlayRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    visible.value = true;
    await nextTick();
};

const close = (): void => {
    dispose();
    visible.value = false;
};

const initEngine = async (targetEl: HTMLElement): Promise<void> => {
    emit('beforeCapture', targetEl);
    await nextTick();

    await init(targetEl);

    // 将画布 DOM 元素替换到容器中
    const canvasEl = engine.value?.getCanvasElement();
    if (canvasEl && canvasRef.value) {
        const parent = canvasRef.value.parentNode;
        if (parent) {
            parent.replaceChild(canvasEl, canvasRef.value);
            canvasRef.value = canvasEl;
        }
    }

    emit('afterCapture', targetEl);
};

const handleSelectTool = async (toolId: ToolId): Promise<void> => {
    if (toolId !== '' && !engine.value) {
        await initEngine(pendingTargetEl);
    }
    selectTool(toolId);
};

const handleUndo = (): void => undo();
const handleRedo = (): void => redo();

const handleCancel = (): void => {
    emit('cancel');
    close();
};

const handleConfirm = async (): Promise<void> => {
    if (!engine.value) {
        // 没有引擎，直接返回原始截图
        const base64 = await domCapture(pendingTargetEl);
        const blob = await fetch(base64).then(r => r.blob());
        emit('confirm', { base64, blob });
        close();
        return;
    }

    const payload = exportImage();
    if (payload) {
        emit('confirm', payload);
    } else {
        emit('confirm', null);
    }
    close();
};

const handleUpdateStyle = (payload: { size?: number; color?: string }): void => {
    if (payload.size !== undefined) {
        if (isTextTool.value) fontSize.value = payload.size;
        else lineWidth.value = payload.size;
    }
    setStyle(color.value, lineWidth.value, fontSize.value);
};

const handleSetColor = (c: string): void => {
    color.value = c;
    setStyle(color.value, lineWidth.value, fontSize.value);
};

const handleCommitStyle = (): void => {
    // 样式变更后保存历史（由引擎内部处理）
};

// ============================================================
// 拖拽方法
// ============================================================
const startDrag = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
    if (target.closest('button')) return;

    isDragging = true;
    const rect = toolbarGroupRef.value?.getBoundingClientRect();
    if (rect) {
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
    }
    if (!isCustomPosition.value && toolbarGroupRef.value) {
        const rect = toolbarGroupRef.value.getBoundingClientRect();
        toolbarPosition.value = { x: rect.left, y: rect.top };
        isCustomPosition.value = true;
    }
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    e.preventDefault();
};

const startDragTouch = (e: TouchEvent): void => {
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
        toolbarPosition.value = { x: rect.left, y: rect.top };
        isCustomPosition.value = true;
    }
    document.addEventListener('touchmove', onDragTouch);
    document.addEventListener('touchend', endDragTouch);
    e.preventDefault();
};

const onDrag = (e: MouseEvent): void => {
    if (!isDragging) return;
    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);
    const toolbarEl = toolbarGroupRef.value;
    if (toolbarEl) {
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        toolbarPosition.value = { x: Math.min(newX, maxX), y: Math.min(newY, maxY) };
    } else {
        toolbarPosition.value = { x: newX, y: newY };
    }
};

const onDragTouch = (e: TouchEvent): void => {
    if (!isDragging) return;
    const touch = e.touches[0];
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
    e.preventDefault();
};

const endDrag = (): void => {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
};

const endDragTouch = (): void => {
    isDragging = false;
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
};

// ============================================================
// 快捷键
// ============================================================
const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
        // 退出文字编辑由引擎内部处理
        handleCancel();
        return;
    }
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
    if (key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
    if (key === 'y') { e.preventDefault(); handleRedo(); }
};

// ============================================================
// 生命周期
// ============================================================
onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDragTouch);
    document.removeEventListener('touchend', endDragTouch);
    dispose();
});

// ============================================================
// 暴露
// ============================================================
defineExpose({ open, close });
</script>

<style scoped>
/* 所有样式都在这里集中定义，子组件复用 */
.anno-overlay {
    position: fixed;
    z-index: 9999;
    overflow: hidden;
}

.anno-canvas-wrap {
    position: absolute;
    inset: 0;
}

.anno-canvas-wrap canvas {
    width: 100% !important;
    height: 100% !important;
}

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

.anno-style-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.anno-style-row input[type="range"] {
    flex: 1;
    min-width: 80px;
    cursor: pointer;
}

.anno-value {
    min-width: 32px;
    text-align: right;
    font-size: 12px;
    color: #888;
}

.anno-color-list {
    display: flex;
    gap: 6px;
}

.anno-label {
    color: #888;
    font-size: 12px;
    min-width: 28px;
}

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

.anno-tool-btn svg {
    display: block;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
}

.anno-tool-btn:hover {
    background: #f0f0f0;
}

.anno-tool-btn.active {
    background: #eef2ff;
    color: #4f6bff;
}

.anno-tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.anno-sep {
    width: 1px;
    height: 20px;
    background: #eee;
    margin: 0 4px;
    flex-shrink: 0;
}

.anno-btn {
    width: 60px;
    height: 28px;
    line-height: 14px;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid #ddd;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
    color: #000;
}

.anno-btn.primary {
    background: #4f6bff;
    border-color: #4f6bff;
    color: #fff;
}

.anno-swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #ddd;
    cursor: pointer;
    flex-shrink: 0;
}

.anno-swatch.active {
    border-color: #4f6bff;
}

.anno-color-picker {
    width: 24px;
    height: 18px;
    border: 2px solid #ddd;
    cursor: pointer;
    overflow: hidden;
}

input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 0 !important;
}
</style>