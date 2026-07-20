# @laoliangfe/annotation-overlay

一个基于 Fabric.js 的 Vue 3 页面标注组件，支持画笔、矩形、椭圆、箭头、折线和文字标注。

## ✨ 特性

- 🎨 多种标注工具：画笔、矩形、椭圆、箭头、折线、文字
- 📦 基于 Fabric.js 7.x，功能强大
- 🚀 快速截图：使用 snapdom 替代 html2canvas
- ↩️ 撤销/重做：完整的操作历史管理
- 🎯 精确坐标：支持高 DPI 屏幕
- 📱 响应式设计：适配不同屏幕尺寸
- 🎨 可定制样式：粗细、颜色、大小
- 🔄 可拖动工具栏：避免遮挡内容
- ⌨️ 键盘快捷键：Ctrl+Z 撤销，Ctrl+Shift+Z 重做

## 📦 安装

```bash
npm install @laoliangfe/annotation-overlay
# 或
yarn add @laoliangfe/annotation-overlay
# 或
pnpm add @laoliangfe/annotation-overlay
```

## 🚀 快速开始

- 全局注册

```typescript
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import AnnotationOverlay from '@laoliangfe/annotation-overlay';
import '@laoliangfe/annotation-overlay/style.css';

const app = createApp(App);
app.use(AnnotationOverlay);
app.mount('#app');
```
- 局部使用
```vue
<template>
  <div>
    <button @click="openAnnotation">📝 添加标注</button>
    
    <AnnotationOverlay 
      ref="annoRef" 
      @confirm="handleConfirm" 
      @cancel="handleCancel"
      @before-capture="cleanupBeforeCapture"
    />
    
    <div ref="targetRef" class="content">
      <!-- 你的内容 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AnnotationOverlay from '@laoliangfe/annotation-overlay'
import '@laoliangfe/annotation-overlay/style.css'

const annoRef = ref<InstanceType<typeof AnnotationOverlay>>()
const targetRef = ref<HTMLElement>()

const openAnnotation = () => {
  if (targetRef.value) {
    annoRef.value?.open(targetRef.value)
  }
}

const handleConfirm = (payload: ConfirmPayload | null) => {
  if (!payload) {
    console.log('未进行任何标注')
    return
  }
  console.log('标注结果:', payload)
  // 上传或保存
}

const handleCancel = () => {
  console.log('取消标注')
}

const cleanupBeforeCapture = (targetEl: HTMLElement) => {
  targetEl.querySelectorAll('.active, .hover').forEach(el => {
    el.classList.remove('active', 'hover')
  })
}
</script>

```

## 🎯 API

**事件**

| 事件名 | 参数 | 说明 |
| :--: | :--------: | :---------- |
| `confirm` |	`ConfirmPayload \| null` | 	确认标注，无内容时返回 `null` | 
| `cancel` |	- |	取消标注|
| `beforeCapture` |	`targetEl: HTMLElement` |	截图前触发，可用于清理状态 |
| `afterCapture` |	`targetEl: HTMLElement` |	截图后触发，可用于恢复状态 |

**方法**

|方法	|参数	|说明|
| :--:    | :--------:               | :---------- |
| `open`  |	`targetEl?: HTMLElement` |	打开标注组件 |
| `close` |	-	|关闭标注组件|

**使用**

```typescript
const annoRef = ref<InstanceType<typeof AnnotationOverlay>>()

// 打开
annoRef.value?.open(document.querySelector('.target'))

// 关闭
annoRef.value?.close()

```

## ⌨️ 键盘快捷键

| 快捷键|	功能|
| :--: | :---------- |
|Ctrl+Z / Cmd+Z|	撤销|
|Ctrl+Shift+Z / Cmd+Shift+Z|	重做|
|Ctrl+Y / Cmd+Y|	重做|
|ESC	|退出文字编辑 / 取消|

## 🔧 开发

```bash
# 克隆仓库
git clone https://github.com/love2157dream/annotation-overlay.git

# 安装依赖
npm install

# 启动开发服务
npm run dev

# 构建
npm run build

# 运行测试
npm run test
```

## 📄 许可证
MIT © [Liang lei]