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
/* 样式在父组件中定义 */
</style>