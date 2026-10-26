/**
 * @file 全局类型声明：让 TypeScript 接受 CSS 副作用导入
 *
 * 本项目通过 Vite 处理 `.css` 导入（抽成 dist/style.css、从 JS 移除），
 * 但 `tsc --noEmit` 不认识 CSS 模块，构建前会报 TS2307。
 * 这里做通配声明即可，不产生任何运行时代码；不要为具体路径单独声明，
 * 否则新增样式文件时还需要同步维护。
 *
 * @see ./index.ts 样式入口的导入位置
 */
declare module '*.css';
