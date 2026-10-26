# @laoliangfe/annotation-overlay-angular

Angular 21 网页标注组件（standalone + signals，兼容 zoneless）：对页面元素截图，在图上画矩形、椭圆、箭头、折线、画笔、文字，一键导出带标注的 PNG。

- standalone 组件，无需 NgModule；状态用 signal，`OnPush` 下自动更新
- 零依赖 UI 库，纯 CSS 布局，样式可通过 CSS 变量覆盖
- 画布按设备像素比渲染，高分屏与导出图都清晰
- 支持撤销/重做、选中对象改颜色/粗细/字号、文字二次编辑

## 安装

```bash
npm i @laoliangfe/annotation-overlay-angular
```

`@angular/core`、`@angular/common` 21+ 作为 peer 依赖，由宿主提供。

## 引入样式

Angular 包**不走 Vite 抽 CSS**，需要显式配置全局样式（漏引会出现「组件在、样式全丢」）：

**方式一：`angular.json`**

```json
"styles": [
  "node_modules/@laoliangfe/annotation-overlay-angular/style.css",
  "src/styles.css"
]
```

**方式二：`src/styles.css`**

```css
@import '@laoliangfe/annotation-overlay-angular/style.css';
```

## 快速开始

```ts
import { Component, viewChild } from '@angular/core';
import {
  AnnotationOverlayComponent,
  type ConfirmPayload,
} from '@laoliangfe/annotation-overlay-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [AnnotationOverlayComponent],
  template: `
    <!-- 被标注的内容 -->
    <div #card class="card">这里是要标注的内容</div>
    <button (click)="overlay.open(card)">添加标注</button>

    <!-- 覆盖层：不占文档流，visible 为 false 时不产生 DOM -->
    <annotation-overlay
      #overlay
      (confirm)="onConfirm($event)"
      (cancel)="onCancel()"
      (beforeCapture)="onBeforeCapture($event)"
      (afterCapture)="onAfterCapture($event)"
    />
  `,
})
export class DemoComponent {
  /** 组件实例（模板引用变量 #overlay 已可直接调用 open/close） */
  readonly overlay = viewChild.required(AnnotationOverlayComponent);

  /** payload 为 null 表示截图/导出失败，务必判空 */
  onConfirm(payload: ConfirmPayload | null): void {
    if (!payload) return;
    console.log('标注图', URL.createObjectURL(payload.blob));
  }

  onCancel(): void {}
  onBeforeCapture(el: HTMLElement): void {}
  onAfterCapture(el: HTMLElement): void {}
}
```

## API

### 方法

| 方法 | 说明 |
|---|---|
| `open(target: HTMLElement)` | 打开覆盖层并截取该元素；返回 Promise。目标元素需完整处于视口内 |
| `close()` | 关闭并销毁画布，未确认的标注直接丢弃 |

### 输出（`output()`）

| 输出 | 参数 | 说明 |
|---|---|---|
| `confirm` | `ConfirmPayload \| null` | 点击确认后触发；`null` 表示截图/导出失败 |
| `cancel` | `void` | 点击取消或按 Esc |
| `beforeCapture` | `HTMLElement` | 截图前触发，可临时隐藏 loading、遮罩等 |
| `afterCapture` | `HTMLElement` | 截图完成后触发，用于恢复临时改动 |

其余三个 standalone 组件（`ToolbarComponent`、`StylePanelComponent`、`IconComponent`）随主组件默认渲染，一般无需单独使用。

## 相关包

引擎与样式已内联进本包，安装后无需额外依赖 —— `core`（引擎）与 `ui`（样式 / 图标）
是仓库内部包，不单独发布到 npm。公共类型 `ConfirmPayload` / `ToolId` 已从本包重新导出，
可直接 `import type { ConfirmPayload } from '@laoliangfe/annotation-overlay-angular'`。

- Vue 版：[`@laoliangfe/annotation-overlay-vue`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-vue)
- React 版：[`@laoliangfe/annotation-overlay-react`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-react)

## 链接

- 在线演示与文档：https://love2157dream.github.io/annotation-overlay/
- 源码与问题反馈：https://github.com/love2157dream/annotation-overlay

MIT © love2157dream
