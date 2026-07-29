<template>
    <div class="anno-style-panel" :style="stylePanelPosition">
        <div class="anno-style-row">
            <span class="anno-label">{{ isTextTool ? '大小' : '粗细' }}</span>
            <input type="range" :min="isTextTool ? 8 : 1" :max="isTextTool ? 72 : 20" :value="sizeOrWidth"
                @input="$emit('update-style', { size: Number(($event.target as HTMLInputElement).value) })"
                @change="$emit('commit-style')" />
            <span class="anno-value">{{ sizeOrWidth }}{{ isTextTool ? 'px' : 'px' }}</span>
        </div>
        <div class="anno-style-row">
            <span class="anno-label">颜色</span>
            <div class="anno-color-list">
                <span v-for="c in colors" :key="c" class="anno-swatch" :class="{ active: currentColor === c }"
                    :style="{ background: c }" @click="$emit('set-color', c)"></span>
                <input type="color" :value="currentColor"
                    @input="$emit('set-color', ($event.target as HTMLInputElement).value)" class="anno-color-picker"
                    title="自定义颜色" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ============================================================
// Props / Emits
// ============================================================
const props = defineProps<{
    currentColor: string;
    lineWidth: number;
    fontSize: number;
    isTextTool: boolean;
    panelLeft?: number;
    isCustomPosition?: boolean;
}>();

const emit = defineEmits<{
    'update-style': [payload: { size?: number; color?: string }];
    'set-color': [color: string];
    'commit-style': [];
}>();

// ============================================================
// 计算
// ============================================================
const sizeOrWidth = computed(() =>
    props.isTextTool ? props.fontSize : props.lineWidth
);

const stylePanelPosition = computed(() => {
    if (props.isCustomPosition) {
        return { position: 'absolute' as const, left: '0px', top: '52px' };
    }
    return { position: 'absolute' as const, left: `${props.panelLeft || 0}px`, top: '54px' };
});

// ============================================================
// 预设颜色
// ============================================================
const colors = ['#ff3b30', '#ffb020', '#34c759', '#0a84ff', '#af52de', '#111111', '#ffffff'];
</script>

<style scoped>
/* 样式在父组件中定义 */
</style>