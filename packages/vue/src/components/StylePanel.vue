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