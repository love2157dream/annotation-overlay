# @laoliangfe/annotation-overlay-vue

Vue 3 网页标注组件：对页面元素截图，在图上画矩形、椭圆、箭头、折线、画笔、文字，一键导出带标注的 PNG。

- 零依赖 UI 库，纯 CSS 布局，样式可通过 CSS 变量覆盖
- 画布按设备像素比渲染，高分屏与导出图都清晰
- 支持撤销/重做、选中对象改颜色/粗细/字号、文字二次编辑
- 与 React / Angular 版共享同一套核心引擎与样式

## 安装

```bash
npm i @laoliangfe/annotation-overlay-vue
```

Vue 3.5+ 作为 peer 依赖，由宿主提供。

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue';
import AnnotationOverlay from '@laoliangfe/annotation-overlay-vue';
import '@laoliangfe/annotation-overlay-vue/style.css';
import type { ConfirmPayload } from '@laoliangfe/annotation-overlay-vue';

const cardRef = ref<HTMLElement>();
const overlayRef = ref<InstanceType<typeof AnnotationOverlay>>();

/** 打开覆盖层并截取卡片区域 */
function openAnnotation() {
  if (cardRef.value) overlayRef.value?.open(cardRef.value);
}

/** 确认：payload 为 null 表示导出失败，务必判空 */
function handleConfirm(payload: ConfirmPayload | null) {
  if (!payload) return;
  const url = URL.createObjectURL(payload.blob);
  console.log('标注图', url);
}
</script>

<template>
  <!-- 被标注的内容 -->
  <div ref="cardRef" class="card">这里是要标注的内容</div>
  <button @click="openAnnotation">添加标注</button>

  <!-- 覆盖层：不占文档流，打开时挂到 body -->
  <AnnotationOverlay
    ref="overlayRef"
    @confirm="handleConfirm"
    @cancel="() => {}"
    @before-capture="(el) => {}"
    @after-capture="(el) => {}"
  />
</template>
```

也可以全局注册：

```ts
import { createApp } from 'vue';
import AnnotationOverlay from '@laoliangfe/annotation-overlay-vue';
import '@laoliangfe/annotation-overlay-vue/style.css';

createApp(App).use(AnnotationOverlay).mount('#app');
```

## API

组件**没有 props**，开关由 `ref` 上的方法驱动。

### 暴露的方法

| 方法 | 说明 |
|---|---|
| `open(targetEl)` | 打开覆盖层并截取该元素；返回 Promise。目标元素需完整处于视口内 |
| `close()` | 关闭并销毁画布，未确认的标注直接丢弃 |

### 事件

| 事件 | 参数 | 说明 |
|---|---|---|
| `confirm` | `payload: ConfirmPayload \| null` | 点击确认后触发；`null` 表示截图/导出失败 |
| `cancel` | — | 点击取消或按 Esc |
| `beforeCapture` | `targetEl` | 截图前触发，可临时隐藏 loading、遮罩等不该出现在图里的元素 |
| `afterCapture` | `targetEl` | 截图完成后触发，用于恢复上一步的临时改动 |

`ConfirmPayload` 为 `{ base64: string; blob: Blob }`。

## 从旧包迁移

旧包 [`@laoliangfe/annotation-overlay`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay)（1.x，单文件 Vue 组件）**仍然可用且保持原样**，但不带 React / Angular 版本，也不再接收新功能。

新项目请使用本包。两者 API 一致，迁移只需两处改动：

```diff
- import AnnotationOverlay from '@laoliangfe/annotation-overlay';
+ import AnnotationOverlay from '@laoliangfe/annotation-overlay-vue';
+ import '@laoliangfe/annotation-overlay-vue/style.css';
```

## 相关包

引擎与样式已内联进本包，安装后无需额外依赖 —— `core`（引擎）与 `ui`（样式 / 图标）
是仓库内部包，不单独发布到 npm。

- React 版：[`@laoliangfe/annotation-overlay-react`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-react)
- Angular 版：[`@laoliangfe/annotation-overlay-angular`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-angular)

## 链接

- 在线演示与文档：https://love2157dream.github.io/annotation-overlay/
- 源码与问题反馈：https://github.com/love2157dream/annotation-overlay

MIT © love2157dream
