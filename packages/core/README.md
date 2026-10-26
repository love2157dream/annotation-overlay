# @laoliangfe/annotation-overlay-core

框架无关的网页标注引擎。对任意 DOM 元素截图，铺到 [Fabric.js](https://fabricjs.com/) 画布上，提供矩形、椭圆、箭头、折线、画笔、文字六种工具，支持撤销/重做，最后导出 PNG。

> 这是 `annotation-overlay` 组件库的核心层。日常使用请直接安装对应框架的封装：
> [`-vue`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-vue) ·
> [`-react`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-react) ·
> [`-angular`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-angular)

## 安装

```bash
npm i @laoliangfe/annotation-overlay-core
```

同时需要 `fabric@^7` 与 `@zumer/snapdom@^2`（已作为 dependencies 自动安装；若宿主已使用 fabric，请确保版本一致，避免多实例导致 `instanceof` 失效）。

## 快速开始

```ts
import { createCanvasEngine } from '@laoliangfe/annotation-overlay-core';

const engine = createCanvasEngine({ color: '#ff3b30', lineWidth: 4, fontSize: 20 });

// 1. 截图目标元素并建好画布（画布容器需自行挂到 DOM）
await engine.init(document.querySelector('#target')!);
document.body.appendChild(engine.getContainerElement()!);

// 2. 订阅状态，驱动你自己的 UI
engine.setCallbacks({
  onHistoryChanged: (h) => console.log('undo', h.canUndo, 'redo', h.canRedo),
  onSelectionChanged: (s) => console.log('选中对象', s),
  onTextEditingChanged: (editing) => console.log('文字编辑中', editing),
});

// 3. 选工具 → 用户绘制 → 导出
engine.selectTool('rect');
const { base64, blob } = await engine.exportImage();
engine.destroy();
```

## 主要 API

| 方法 | 说明 |
|---|---|
| `init(targetEl)` | 截图并创建画布（异步）；画布尺寸等于目标元素的 `getBoundingClientRect()` |
| `getContainerElement()` | 返回 Fabric 的 `.canvas-container`。**必须整体挂载**，只挂 `getCanvasElement()` 会导致画布可见但无法绘制 |
| `selectTool(toolId)` | `'rect' \| 'ellipse' \| 'arrow' \| 'line' \| 'pen' \| 'text' \| ''` |
| `setStyle(color, lineWidth, fontSize)` / `commitStyle()` | 前者用于滑块拖动等高频更新（不写历史），后者提交一个撤销点 |
| `undo()` / `redo()` / `getHistoryState()` | 撤销重做（历史基于 Fabric 对象序列化快照） |
| `prepareForExport()` | 导出前收尾：退出文字编辑、闭合进行中的折线 |
| `exportImage()` | 返回 `{ base64, blob }`；直接取 `lowerCanvasEl` 位图，保留高 DPI 采样 |
| `captureOnly(targetEl)` | 未做任何标注时直接截图；也可作为独立函数引入 |
| `destroy()` | 销毁画布与事件监听 |

## 已知约束

- 目标元素需**完整处于视口内**，超出部分会被覆盖层裁切。
- 不要设置 `enableRetinaScaling: false`，也不要手写 canvas 的 `width/height`，否则高 DPI 屏上画面会发虚。
- 导出使用 `lowerCanvasEl.toDataURL()/toBlob()`，不要传 `multiplier`，否则会丢掉高 DPI 采样。

## 链接

- 在线演示与文档：https://love2157dream.github.io/annotation-overlay/
- 源码与问题反馈：https://github.com/love2157dream/annotation-overlay

MIT © love2157dream
