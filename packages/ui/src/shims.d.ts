/**
 * @file CSS 模块声明
 *
 * 让 TypeScript 接受 `import './styles/tokens.css'` 这类纯副作用导入：
 * 打包器会真正处理样式，而 tsc（构建脚本里的 `tsc --noEmit`）只需要一个
 * 宽松的模块声明，否则会报 TS2307「找不到模块」。
 *
 * 注意：这里声明的是「任意 CSS 文件」而非具体路径，新增样式文件无需再改本文件。
 *
 * @see ../tsconfig.json 编译范围覆盖 src 下的全部 .ts
 * @see ../../vue/src/shims-vue.d.ts vue 包中的同类声明
 */
// 通配声明：匹配所有以 .css 结尾的导入路径
declare module '*.css';
