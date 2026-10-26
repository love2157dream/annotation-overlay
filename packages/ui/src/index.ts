/**
 * @file @laoliangfe/annotation-overlay-ui 包入口
 *
 * 共享界面资源包：设计令牌（tokens.css）+ 结构样式（overlay.css）
 * + SVG 图标数据（icons.ts）+ 工具栏结构数据（data.ts）。
 * 无框架依赖、无 UI 库，vue / react / angular 三个适配层共用同一份实现。
 *
 * 注意：两个 CSS import 是「副作用导入」，构建时由 Vite 抽取为 dist/style.css
 * 并从 JS 中移除；因此使用方必须自行 `import '.../style.css'`，
 * 只引 JS 会出现「组件结构在、样式全丢」的现象。
 *
 * @see ./styles/tokens.css 设计令牌
 * @see ./styles/overlay.css 组件结构样式
 */
import './styles/tokens.css';
import './styles/overlay.css';

/** 图标几何数据与 AnnoIcon / AnnoIconName 类型 */
export * from './icons';
/** 工具列表、调色板、尺寸区间与界面文案 */
export * from './data';
