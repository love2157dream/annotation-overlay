<!--
  Icon —— 通用 SVG 图标渲染器
  职责：把 ui 包里的几何数据（paths / circles）渲染成 <svg>，统一线宽与端点样式。
  结构：单个 <svg>，内部按数据分别渲染 <path>（描边）与 <circle>（填充）。
  注意：颜色一律继承 currentColor，因此图标颜色由所在按钮的 color 决定，
        组件内不接收任何颜色 prop。
-->
<template>
    <!-- viewBox 缺省 0 0 24 24；有 circles 的图标视为实心图形，改用 fill 上色 -->
    <svg :width="size" :height="size" :viewBox="icon.viewBox ?? '0 0 24 24'"
        :fill="icon.circles ? 'currentColor' : 'none'"
        :stroke="icon.circles ? 'none' : 'currentColor'" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round">
        <!-- 描边路径：v-for 的索引参与 key，同一图标内路径顺序固定，不会触发重排 -->
        <path v-for="(d, i) in icon.paths ?? []" :key="'p' + i" :d="d" />
        <!-- 实心圆点：c 为 [cx, cy, r] 元组，用于九点阵拖动手柄 -->
        <circle v-for="(c, i) in icon.circles ?? []" :key="'c' + i" :cx="c[0]" :cy="c[1]" :r="c[2]" />
    </svg>
</template>

<script setup lang="ts">
/**
 * @file 图标渲染组件（Vue 版）
 *
 * 在整体架构中的位置：Toolbar.vue 的唯一图标出口；数据来自
 * @laoliangfe/annotation-overlay-ui 的 annoIcons，三端用同一份几何数据。
 *
 * 实现约束：
 *   - 图元只有 path 与 circle 两种，新增图元需要同时改 AnnoIcon 类型与三端实现；
 *   - 线宽固定 2（24×24 网格下的视觉标准），不在 props 中暴露，避免各调用点线宽不一；
 *   - 颜色通过 currentColor 继承，故不可在图标上直接使用 var(--anno-*)。
 *
 * @see ../../ui/src/icons.ts 图标数据与 AnnoIcon 类型
 * @see ./Toolbar.vue 调用方
 */
import type { AnnoIcon } from '@laoliangfe/annotation-overlay-ui';

// 默认 20px：略大于工具栏 CSS 中的 18px 图标尺寸，因为此处的 size 是 svg 的
// 逻辑尺寸，实际显示尺寸由 .anno-tool-btn svg 的 width/height 覆盖
withDefaults(defineProps<{
    /** 图标几何数据，必须是 annoIcons 中的值，形状见 AnnoIcon */
    icon: AnnoIcon;
    /** svg 的宽高（px），同时作用于 width/height；默认 20 */
    size?: number;
}>(), { size: 20 });
</script>
