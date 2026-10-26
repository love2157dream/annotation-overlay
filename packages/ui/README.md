# @laoliangfe/annotation-overlay-ui

`annotation-overlay` 的共享 UI 资源层：设计令牌（CSS 变量）、Flex 结构样式、SVG 图标几何数据、工具栏结构数据。

不依赖任何框架与 UI 库，供 `-vue` / `-react` / `-angular` 三个封装共用，一般**不需要单独安装**（适配包会自动带上）。

## 安装

```bash
npm i @laoliangfe/annotation-overlay-ui
```

## 内容

| 导出 | 说明 |
|---|---|
| `style.css` | 组件结构样式（`.anno-*` 类名）。由适配包构建时抽取为各自的 `dist/style.css` |
| `overlay.css` / `tokens.css` | 源样式文件，可在自己的构建里直接引入做二次定制 |
| `ANNO_ICONS` | 图标几何数据（`viewBox` + `paths` + `circles`），三端各自渲染为 SVG |
| `TOOL_ITEMS` / `COLOR_SWATCHES` / `DEFAULT_*` | 工具栏条目、预设色板、默认颜色/粗细/字号 |

## 样式定制

所有配色挂在 CSS 变量上，覆盖同名变量即可换主题，无需改组件代码：

```css
:root {
  --anno-primary: #4f6bff;        /* 主色：选中态、确认按钮 */
  --anno-primary-weak: #eef2ff;   /* 主色弱化背景：工具按钮激活态 */
  --anno-bg: #fff;                /* 工具栏/面板底色 */
  --anno-border: #ddd;
  --anno-text: #444;
  --anno-shadow: 0 6px 24px #0000002e;
  --anno-tool-btn-size: 34px;     /* 工具按钮尺寸 */
  --anno-icon-size: 18px;
}
```

完整变量清单见 `src/styles/tokens.css`。

> 这些样式是**必需**的：漏引会出现「组件在、样式全丢」。三个适配包都提供 `style.css` 子路径，优先引适配包的（已包含本包样式）。

## 链接

- 在线演示：https://love2157dream.github.io/annotation-overlay/
- 源码：https://github.com/love2157dream/annotation-overlay

MIT © love2157dream
