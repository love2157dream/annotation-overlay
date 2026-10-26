# Changelog

本仓库包含两代发布物，版本号各自独立：

- **当前（monorepo）**：`@laoliangfe/annotation-overlay-{vue,react,angular}`，三个框架包统一版本，首发 `2.0.0`。
  引擎（core）与样式（ui）是内部包，构建时内联进这三个包，**不发布到 npm**。
- **历史（旧包）**：`@laoliangfe/annotation-overlay`（1.x，单文件 Vue 3 组件），冻结在 `1.1.7`，源码见 tag [`v1.1.7`](https://github.com/love2157dream/annotation-overlay/tree/v1.1.7)，条目见文末。

## [2.0.0] - 2026-10-26

monorepo 首发：同一套引擎与样式，输出 Vue 3 / React 18 / Angular 21 三个框架组件。

> 版本号直接从 2.0.0 起，是延续老包 `@laoliangfe/annotation-overlay`（1.1.7）的产品线，
> 并非 1.x 的增量升级。老包 API 与 `-vue` 一致，迁移改 import 路径 + 补一行 `style.css` 即可。

### Added

- 公开发布三个包：`vue` / `react` / `angular`；`core`（引擎）与 `ui`（样式、图标）为 private 内部包，构建时内联，用户装一个包即可用
- React 18 组件（`forwardRef` + `createPortal`，命令式 `open` / `close`）
- Angular 21 组件（standalone + signals，兼容 zoneless，`ViewEncapsulation.None`）
- 三端统一暴露 `confirm` / `cancel` / `beforeCapture` / `afterCapture`
- 三个包统一重新导出 `ConfirmPayload` / `ToolId`，使用方无需安装内部包即可标注事件参数类型
- 文档站与三端在线演示：首屏使用文档，顶部 Tab 切换框架演示，iframe 懒加载
- 每个适配包提供 `style.css` 子路径，样式可独立引入
- 构建产物附带 sourcemap，便于宿主调试

### Changed

- 引擎由 class 改为闭包工厂 `createCanvasEngine()`，工具改为 `createXxxTool(ctx: ToolContext)` 注入
- 历史记录改为 Fabric 对象快照序列化，恢复期间用 `isRestoring` 覆盖异步 `enlivenObjects` 全程
- 画布挂载改为整体挂载 Fabric 的 `.canvas-container`（lower 绘制层 + upper 事件层）
- 三端样式面板定位统一改为 `getBoundingClientRect()` 差值计算，避免拖动后 `offsetParent` 变化导致偏移

### Fixed

- 撤销/重做失效：形状工具绘制完成后未保存历史
- 高 DPI 屏打开标注后画面发虚：移除 `enableRetinaScaling: false` 与手写 canvas 位图尺寸
- 导出图模糊：改用 `lowerCanvasEl.toDataURL()/toBlob()`，不再传 `multiplier`
- React 包产物内嵌 `require("react")` 导致白屏：补齐 `react/jsx-runtime` external
- Angular 样式面板与工具栏重叠：补齐面板 `left/top` 绑定
- 折线未收尾、文字编辑丢失历史等引擎侧问题

---

## 历史版本（旧包 `@laoliangfe/annotation-overlay`）

> 1.x 为单文件 Vue 3 组件，API 与 `@laoliangfe/annotation-overlay-vue` 完全一致。
> 已冻结在 `1.1.7`：不再接收更新，npm 页面已 deprecate 并指向 tag [`v1.1.7`](https://github.com/love2157dream/annotation-overlay/tree/v1.1.7)。
> 新项目请使用 monorepo 的三个框架包。

## [1.1.7]

### Note

- npm 上的最后一个 1.x 版本，仓库内未记录具体变更明细。

## [1.1.6] - 2026-07-24

### Feat

- 增加自定义颜色

## [1.1.1] - 2026-07-20

### Fixed

- 修复取消按钮的默认字体颜色
- 修复 input 滑块的默认样式

## [1.1.0] - 2026-07-15

### Added

- 添加 snapdom 支持，提升截图速度
- 添加 beforeCapture / afterCapture 事件
- 添加 isRestoring 保护，防止 undo/redo 竞态

### Changed

- 优化性能
- 统一控制手柄配置
- 改进历史记录管理

### Fixed

- 修复工具栏位置偏移问题
- 修复文字编辑保存状态问题

## [1.0.0] - 2026-07-14

### Added

- 初始版本发布
- 支持画笔、折线、箭头、矩形、椭圆、文字工具
- 撤销/重做功能
- 可拖动工具栏
- 截图前/后事件回调
- TypeScript 支持
- 键盘快捷键支持（Ctrl+Z、Ctrl+Shift+Z、Ctrl+Y、ESC）

### Fixed

- 矩形和椭圆绘制位置精确
- 文字编辑后光标清除
- 折线绘制连续点击
- 控制手柄方向正确显示
