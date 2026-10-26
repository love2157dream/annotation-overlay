/**
 * @file React 包对外唯一入口
 *
 * 使用方只从 `@laoliangfe/annotation-overlay-react` 引入，不直接依赖 core/ui。
 * 这里做三件事：引入 UI 共享样式（副作用导入）、导出组件与句柄类型、
 * 转出 core 的公共类型，避免使用方再单独安装 core 才能写类型标注。
 *
 * 注意：`import '.../style.css'` 是运行时无副作用的样式导入，但构建时会被 Vite
 * 抽取到 dist/style.css 并从 JS 中移除。因此这里的 import 并不能替代使用方
 * 自己的 `import '@laoliangfe/annotation-overlay-react/style.css'`——
 * 库产物不会自动带上样式，漏引会出现「组件在、样式全丢」。
 *
 * @see ./components/AnnotationOverlay.tsx 主组件
 * @see ../vite.config.ts CSS 抽取与 external 配置
 */
// 引入 ui 包样式，供构建期抽取为 dist/style.css（使用方需显式再引一次）
import '@laoliangfe/annotation-overlay-ui/style.css';
// 主组件及其命令式句柄类型（open / close）
export { AnnotationOverlay, default } from './components/AnnotationOverlay';
// 组件 Props 与 ref 句柄类型，供 TS 使用方标注 useRef
export type { AnnotationOverlayRef, AnnotationOverlayProps } from './components/AnnotationOverlay';
// 透出 core 的结果与工具类型，使用方无需额外依赖 core
export type { ConfirmPayload, ToolId } from '@laoliangfe/annotation-overlay-core';
