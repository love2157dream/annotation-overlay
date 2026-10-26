<!--
  StylePanel —— 样式面板
  职责：就地调整当前工具的描边宽度 / 字号与颜色，改动实时上抛给父组件。
  结构：两行 Flex —— 「粗细/大小」滑块 + 数值 / 「颜色」预设色块 + 自定义取色器。
  注意：面板自身不写引擎、不存状态；尺寸的实时值与历史提交由父组件区分
        （@input 只预览，@change 才落历史，避免一次拖动产生大量撤销记录）。
-->
<template>
    <!-- 面板根节点：position:absolute 相对 .anno-topbar-group 定位，
         坐标由 stylePanelPosition 按父组件算好的差值注入 -->
    <div class="anno-style-panel" :style="stylePanelPosition">
        <!-- 第一行：尺寸 -->
        <div class="anno-style-row">
            <!-- 标签随工具切换：文字工具显示「大小」，其余显示「粗细」 -->
            <span class="anno-label">{{ isTextTool ? labels.fontSize : labels.strokeWidth }}</span>
            <!-- 滑块：@input 高频触发只做实时预览；@change（松手）才提交历史 -->
            <input type="range" :min="sizeRange.min" :max="sizeRange.max" :value="sizeOrWidth"
                @input="$emit('update-style', { size: Number(($event.target as HTMLInputElement).value) })"
                @change="$emit('commit-style')" />
            <!-- 当前值回显，单位固定 px，与引擎侧样式单位一致 -->
            <span class="anno-value">{{ sizeOrWidth }}px</span>
        </div>
        <!-- 第二行：颜色 -->
        <div class="anno-style-row">
            <span class="anno-label">{{ labels.color }}</span>
            <div class="anno-color-list">
                <!-- 预设色块：active 表示与当前颜色完全相等（自定义色不在列表内，故全不高亮） -->
                <span v-for="c in COLOR_PRESETS" :key="c" class="anno-swatch" :class="{ active: currentColor === c }"
                    :style="{ background: c }" @click="$emit('set-color', c)"></span>
                <!-- 原生取色器：:value 只做初值绑定，拖动时通过 @input 实时上抛 -->
                <input type="color" :value="currentColor"
                    @input="$emit('set-color', ($event.target as HTMLInputElement).value)" class="anno-color-picker"
                    :title="labels.customColor" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 样式面板（尺寸 + 颜色，纯展示组件）
 *
 * 在整体架构中的位置：AnnotationOverlay.vue 的子组件，跟随当前工具或选中对象出现。
 * 对外暴露：7 个 props（当前颜色/线宽/字号/是否文字工具 + 面板坐标）与 3 个事件
 * （改尺寸、改颜色、提交样式）。
 *
 * 注意：面板的显示条件由父组件的 showStylePanel 决定，本组件不做 v-if 自判；
 * 坐标也不在本组件计算——父组件用 getBoundingClientRect 差值算好后传入，
 * 因为只有父组件同时持有工具栏组与按钮两个节点的引用。
 *
 * @see ../../ui/src/data.ts COLOR_PRESETS / SIZE_RANGE / LABELS
 * @see ./AnnotationOverlay.vue updatePanelPosition()
 */
import { computed } from 'vue';
import { COLOR_PRESETS, SIZE_RANGE, LABELS as labels } from '@laoliangfe/annotation-overlay-ui';

const props = defineProps<{
    /** 当前生效的颜色（CSS 色值）；用于色块高亮与取色器初值，来自引擎回读或用户选择 */
    currentColor: string;
    /** 当前线宽（px），非文字工具时作为滑块当前值，取值范围见 SIZE_RANGE.lineWidth */
    lineWidth: number;
    /** 当前字号（px），文字工具时作为滑块当前值，取值范围见 SIZE_RANGE.fontSize */
    fontSize: number;
    /** 是否处于文字工具：决定滑块绑定的值、范围与行标签文案 */
    isTextTool: boolean;
    /** 面板左偏移（px），相对 .anno-topbar-group；未传时按 0 处理 */
    panelLeft?: number;
    /** 面板上偏移（px），相对 .anno-topbar-group；未传时回落到 54（工具栏高度附近） */
    panelTop?: number;
    /** 工具栏是否已被拖动到自定义位置：true 时改用固定偏移，避免跟随按钮闪烁 */
    isCustomPosition?: boolean;
}>();

defineEmits<{
    /** 尺寸实时变化（滑块 @input 每帧触发）；size 单位 px，只预览不写历史 */
    'update-style': [payload: { size?: number; color?: string }];
    /** 颜色变化（色块点击或取色器 @input）；color 为 CSS 色值 */
    'set-color': [color: string];
    /** 尺寸提交（滑块 @change，松手时触发一次，用于写入历史） */
    'commit-style': [];
}>();

/** 滑块当前值：文字工具取字号，其余取线宽，把两套语义收敛成一个数值 */
const sizeOrWidth = computed(() =>
    props.isTextTool ? props.fontSize : props.lineWidth
);

/** 滑块取值范围：与 sizeOrWidth 配套切换，保证 min/max 始终对应当前语义 */
const sizeRange = computed(() =>
    props.isTextTool ? SIZE_RANGE.fontSize : SIZE_RANGE.lineWidth
);

/**
 * 面板定位样式
 *
 * 两种模式：
 *   - 默认：采用父组件算出的差值坐标（相对 .anno-topbar-group），精确贴到工具按钮下方；
 *   - 工具栏被拖动后（isCustomPosition）：固定到工具组左上角下方 52px 处。
 *     此时工具组已切换为 fixed 定位、不再居中，若继续按按钮跟随，
 *     面板会随工具栏拖动而漂移，固定在组内更稳定。
 */
const stylePanelPosition = computed(() => {
    if (props.isCustomPosition) {
        return { position: 'absolute' as const, left: '0px', top: '52px' };
    }
    return {
        position: 'absolute' as const,
        left: `${props.panelLeft || 0}px`,
        top: `${props.panelTop ?? 54}px`,
    };
});
</script>
