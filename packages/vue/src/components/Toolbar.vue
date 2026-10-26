<!--
  Toolbar —— 顶部工具栏
  职责：纯展示组件，按 TOOL_ITEMS 渲染工具按钮、撤销/重做、取消/确认，
        并通过事件把用户意图上抛；自身不持有任何状态、不接触引擎。
  结构：拖动手柄 + 分隔线 + 工具按钮组 + 分隔线 + 撤销/重做 + 分隔线 + 取消/确认。
  注意：拖动手柄只提供可抓取的视觉与命中区，拖拽逻辑由父组件
        AnnotationOverlay 统一处理（mousedown 冒泡到 .anno-topbar-group）。
-->
<template>
    <!-- 工具栏胶囊条：背景/圆角/阴影来自 overlay.css 的 .anno-toolbar -->
    <div class="anno-toolbar">
        <!-- 拖动手柄：title 提示文案来自 LABELS.dragHandle，拖动由父级统一接管 -->
        <div class="anno-drag-handle" :title="labels.dragHandle">
            <Icon :icon="annoIcons.drag" />
        </div>

        <!-- 工具组与拖动手柄之间的分隔线 -->
        <div class="anno-sep"></div>

        <!-- 工具按钮：data-tool 供父组件用选择器精确定位（样式面板贴靠用），
             active 由 currentTool 决定，点击只上抛 select-tool 不自行切换 -->
        <button v-for="tool in TOOL_ITEMS" :key="tool.id" class="anno-tool-btn" :data-tool="tool.id"
            :class="{ active: currentTool === tool.id }" :title="tool.label"
            @click="$emit('select-tool', tool.id)">
            <!-- 按 tool.icon 从图标表取几何数据，图标名与工具名在此解耦 -->
            <Icon :icon="annoIcons[tool.icon]" />
        </button>

        <!-- 工具组与历史操作之间的分隔线 -->
        <div class="anno-sep"></div>

        <!-- 撤销/重做：不可用时 disabled，避免无效点击（可用性由引擎回传） -->
        <button class="anno-tool-btn" :title="labels.undo" :disabled="!canUndo" @click="$emit('undo')">
            <Icon :icon="annoIcons.undo" />
        </button>
        <button class="anno-tool-btn" :title="labels.redo" :disabled="!canRedo" @click="$emit('redo')">
            <Icon :icon="annoIcons.redo" />
        </button>

        <!-- 与确认/取消按钮之间的分隔线 -->
        <div class="anno-sep"></div>

        <!-- 取消：仅上抛事件，关闭与销毁由父组件负责 -->
        <button class="anno-btn" @click="$emit('cancel')">{{ labels.cancel }}</button>
        <!-- 确认：primary 主色样式，导出逻辑在父组件的 handleConfirm 中 -->
        <button class="anno-btn primary" @click="$emit('confirm')">{{ labels.confirm }}</button>
    </div>
</template>

<script setup lang="ts">
/**
 * @file 顶部工具栏（纯展示组件）
 *
 * 在整体架构中的位置：AnnotationOverlay.vue 的子组件，只负责渲染与抛事件。
 * 对外暴露：props（当前工具 / 撤销重做可用性）与 5 个事件（选工具、撤销、重做、取消、确认）。
 * 无内部状态、无 watch、无副作用，因此可以安全地做纯渲染优化。
 *
 * 注意：工具按钮顺序与图标全部来自 @laoliangfe/annotation-overlay-ui，
 * 三端共用同一份数据；本地不要硬编码按钮列表，否则三端界面会漂移。
 *
 * @see ./Icon.vue 图标渲染
 * @see ../../ui/src/data.ts TOOL_ITEMS / LABELS 数据来源
 */
import type { ToolId } from '@laoliangfe/annotation-overlay-core';
import { annoIcons, TOOL_ITEMS, LABELS as labels } from '@laoliangfe/annotation-overlay-ui';
import Icon from './Icon.vue';

// 重命名为 labels，避免模板中出现 LABELS.xxx 的大写下划线风格，保持模板可读性
defineProps<{
    /** 当前激活的工具；'' 表示未选工具（此时所有按钮均不高亮） */
    currentTool: ToolId;
    /** 是否可撤销，取引擎历史栈状态，false 时撤销按钮禁用 */
    canUndo: boolean;
    /** 是否可重做，取引擎历史栈状态，false 时重做按钮禁用 */
    canRedo: boolean;
}>();

defineEmits<{
    /** 点击某个工具按钮；入参为工具 id，传 '' 表示取消当前工具（由父级决定语义） */
    'select-tool': [toolId: ToolId];
    /** 点击撤销按钮（无参，是否真的可撤销由父级/引擎判断） */
    undo: [];
    /** 点击重做按钮 */
    redo: [];
    /** 点击取消按钮：放弃本次标注 */
    cancel: [];
    /** 点击确认按钮：导出并关闭 */
    confirm: [];
}>();
</script>
