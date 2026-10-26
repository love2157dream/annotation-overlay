/**
 * @file 全局模块类型补充声明（Vue demo）
 *
 * TypeScript 只认识 .ts/.tsx 等代码模块，遇到 `import './x.css'` 这类
 * 副作用导入会报 TS2307「找不到模块」。这里用通配 declare module 兜住，
 * 让样式导入在类型检查阶段合法；运行时由 Vite 负责真正解析。
 *
 * 注意：`declare module '*.css'` 只能匹配相对/裸模块的通配导入，
 * 对 `@scope/pkg/style.css` 这类带包名的具体路径匹配不稳定（不同 TS 版本
 * 行为不一致），因此下面第 2 段又单独声明了一次组件库的样式文件。
 *
 * @see ./main.ts 实际使用这些声明的地方
 */
// apps/demo-vue/src/shims.d.ts

// 1. 声明所有 CSS 文件的模块类型
// 通配声明：任何 *.css 导入都被视为「默认导出字符串」，内容对 TS 不重要
declare module '*.css' {
  // 占位类型；运行时拿到的是空对象，样式早已被 Vite 注入 <style>
  const content: string;
  // 允许 `import styles from './a.css'` 这种默认导入写法
  export default content;
}

// 同理兜住 Sass 源文件，便于将来直接引入 .scss 而无需再改类型
declare module '*.scss' {
  const content: string;
  export default content;
}

// 单行注释版 .sass（缩进语法）的兜底声明
declare module '*.sass' {
  const content: string;
  export default content;
}

// Less 源文件的兜底声明
declare module '*.less' {
  const content: string;
  export default content;
}

// 2. 显式声明组件库的样式文件 
// 具体包路径的声明优先于通配声明，避免部分 TS 版本下通配匹配不到裸包路径
declare module '@laoliangfe/annotation-overlay-vue/style.css' {
  // 同上，仅用于让导入语句通过类型检查
  const content: string;
  export default content;
}
