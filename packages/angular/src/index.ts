/**
 * @file Angular 包对外唯一入口（ng-packagr 的 entryFile）
 *
 * 使用方从 `@laoliangfe/annotation-overlay-angular` 引入四个 standalone 组件。
 * core 与 ui 是 monorepo 内部包（private，不发布到 npm），构建时会被
 * scripts/inline-angular-js.mjs 内联进 fesm2022 产物，因此使用方无需安装它们；
 * 本文件额外把它们的公共类型重新导出，避免使用方为了标注事件参数而去装内部包。
 *
 * 注意：样式不在本文件导出。构建时 prebuild 脚本把 ui 的 dist/style.css
 * 拷到 src/assets，再由 ng-package.json 的 assets 复制到 dist/style.css，
 * 使用方通过 `@import '@laoliangfe/annotation-overlay-angular/style.css'` 引入，
 * 漏引会出现「组件在、样式全丢」。
 *
 * @see ../scripts/copy-style.mjs 样式拷贝
 * @see ../ng-package.json assets 配置
 */
// 主组件：覆盖层本身，暴露 open/close 与 confirm/cancel 等输出
export { AnnotationOverlayComponent } from './lib/annotation-overlay.component';
// 工具栏子组件：一般无需单独使用，随主组件默认渲染
export { ToolbarComponent } from './lib/toolbar.component';
// 样式面板子组件：同上，主组件按工具显隐
export { StylePanelComponent } from './lib/style-panel.component';
// 图标组件：把 ui 包图标数据渲染为 SVG，可复用到自定义工具栏
export { IconComponent } from './lib/icon.component';
// 公共类型：与 Vue / React 包导出的集合保持一致，供 (confirm) 事件的参数标注使用
export type { ConfirmPayload, ToolId } from '@laoliangfe/annotation-overlay-core';
