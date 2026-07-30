<template>
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

        <button v-for="(tool, idx) in tools" :key="tool.id" :ref="(el: any) => setToolBtnRef(el, idx)"
            class="anno-tool-btn" :class="{ active: currentTool === tool.id }" :title="tool.label"
            @click="$emit('select-tool', tool.id)">
            <component :is="tool.icon" />
        </button>

        <div class="anno-sep"></div>

        <button class="anno-tool-btn" title="撤销 (Ctrl+Z)" :disabled="!canUndo" @click="$emit('undo')">
            <IconUndo />
        </button>
        <button class="anno-tool-btn" title="重做 (Ctrl+Shift+Z)" :disabled="!canRedo" @click="$emit('redo')">
            <IconRedo />
        </button>

        <div class="anno-sep"></div>

        <button class="anno-btn" @click="$emit('cancel')">取消</button>
        <button class="anno-btn primary" @click="$emit('confirm')">确认</button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ToolId } from '@laoliangfe/annotation-overlay-core';
import { IconUndo, IconRedo, toolIcons } from '../constants/icons';

// ============================================================
// Props / Emits
// ============================================================
defineProps<{
    currentTool: ToolId;
    canUndo: boolean;
    canRedo: boolean;
}>();

const emit = defineEmits<{
    'select-tool': [toolId: ToolId];
    undo: [];
    redo: [];
    cancel: [];
    confirm: [];
}>();

// ============================================================
// 工具定义
// ============================================================
const tools = [
    { id: 'pen' as const, label: '画笔', icon: toolIcons.pen },
    { id: 'line' as const, label: '折线', icon: toolIcons.line },
    { id: 'arrow' as const, label: '箭头', icon: toolIcons.arrow },
    { id: 'rect' as const, label: '矩形', icon: toolIcons.rect },
    { id: 'ellipse' as const, label: '椭圆', icon: toolIcons.ellipse },
    { id: 'text' as const, label: '文字', icon: toolIcons.text },
];

// ============================================================
// 按钮引用
// ============================================================
const toolBtnEls: (HTMLElement | null)[] = [];
function setToolBtnRef(el: any, idx: number): void {
    toolBtnEls[idx] = el as HTMLElement | null;
}
</script>

<style scoped>
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

.anno-sep {
    width: 1px;
    height: 20px;
    background: #eee;
    margin: 0 4px;
    flex-shrink: 0;
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
</style>