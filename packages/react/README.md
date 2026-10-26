# @laoliangfe/annotation-overlay-react

React 网页标注组件：对页面元素截图，在图上画矩形、椭圆、箭头、折线、画笔、文字，一键导出带标注的 PNG。

- 零依赖 UI 库，纯 CSS 布局，样式可通过 CSS 变量覆盖
- 画布按设备像素比渲染，高分屏与导出图都清晰
- 支持撤销/重做、选中对象改颜色/粗细/字号、文字二次编辑
- 与 Vue / Angular 版共享同一套核心引擎与样式

## 安装

```bash
npm i @laoliangfe/annotation-overlay-react
```

React 18 作为 peer 依赖，由宿主提供。

## 快速开始

```tsx
import { useRef } from 'react';
import {
  AnnotationOverlay,
  type AnnotationOverlayRef,
  type ConfirmPayload,
} from '@laoliangfe/annotation-overlay-react';
import '@laoliangfe/annotation-overlay-react/style.css';

export function Demo() {
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<AnnotationOverlayRef>(null);

  /** 确认：payload 为 null 表示导出失败，务必判空 */
  const handleConfirm = (payload: ConfirmPayload | null) => {
    if (!payload) return;
    console.log('标注图', URL.createObjectURL(payload.blob));
  };

  return (
    <>
      <div ref={cardRef} className="card">这里是要标注的内容</div>
      <button onClick={() => overlayRef.current?.open(cardRef.current!)}>添加标注</button>

      <AnnotationOverlay
        ref={overlayRef}
        onConfirm={handleConfirm}
        onCancel={() => {}}
        onBeforeCapture={(el) => {}}
        onAfterCapture={(el) => {}}
      />
    </>
  );
}
```

## API

### Props

| 属性 | 类型 | 说明 |
|---|---|---|
| `onConfirm` | `(payload: ConfirmPayload \| null) => void` | 点击确认；`null` 表示截图/导出失败 |
| `onCancel` | `() => void` | 点击取消或按 Esc |
| `onBeforeCapture` | `(targetEl: HTMLElement) => void` | 截图前触发，可临时隐藏 loading、遮罩等 |
| `onAfterCapture` | `(targetEl: HTMLElement) => void` | 截图完成后触发，用于恢复临时改动 |

### ref 句柄（`AnnotationOverlayRef`）

| 方法 | 说明 |
|---|---|
| `open(targetEl)` | 打开覆盖层并截取该元素；目标元素需完整处于视口内 |
| `close()` | 关闭并销毁画布，未确认的标注直接丢弃 |

`ConfirmPayload` 为 `{ base64: string; blob: Blob }`。

### 样式

必须显式引入，否则会出现「组件在、样式全丢」：

```ts
import '@laoliangfe/annotation-overlay-react/style.css';
```

组件通过 `createPortal` 挂到 `document.body`，不受父级 `overflow: hidden` / `transform` 影响。

## 相关包

引擎与样式已内联进本包，安装后无需额外依赖 —— `core`（引擎）与 `ui`（样式 / 图标）
是仓库内部包，不单独发布到 npm。

- Vue 版：[`@laoliangfe/annotation-overlay-vue`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-vue)
- Angular 版：[`@laoliangfe/annotation-overlay-angular`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-angular)

## 链接

- 在线演示与文档：https://love2157dream.github.io/annotation-overlay/
- 源码与问题反馈：https://github.com/love2157dream/annotation-overlay

MIT © love2157dream
