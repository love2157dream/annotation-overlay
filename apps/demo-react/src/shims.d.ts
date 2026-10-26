/**
 * @file 全局模块类型补充声明（React demo）
 *
 * TypeScript 不认识 `import './styles.css'` 这类副作用导入，会报 TS2307。
 * 这里用通配 declare module 兜住所有 CSS 类扩展名，让样式导入通过类型检查；
 * 真正的解析与注入交给 Vite。
 *
 * 注意：通配对 `@scope/pkg/style.css` 这种带包名与子路径的导入匹配不稳定
 * （TS 版本间行为有差异），所以第 2 段对组件库样式又单独声明了一次。
 *
 * @see ./main.tsx 使用这些声明的地方
 */
// apps/demo-vue/src/shims.d.ts

// 1. 声明所有 CSS 文件的模块类型
// 通配声明：任何 *.css 导入都视为「默认导出字符串」
declare module '*.css' {
  // 占位类型；运行时并无实际导出，样式由 Vite 注入到 <style>
  const content: string;
  // 兼容 `import styles from './a.css'` 的默认导入写法
  export default content;
}

// Sass 文件的兜底声明，便于后续直接引入 .scss
declare module '*.scss' {
  const content: string;
  export default content;
}

// 单行注释版 .sass（缩进语法）的兜底声明
declare module '*.sass' {
  const content: string;
  export default content;
}

// Less 文件的兜底声明
declare module '*.less' {
  const content: string;
  export default content;
}

// 2. 显式声明组件库的样式文件 
// 具体包路径优先于通配声明，规避通配匹配不到裸包路径的问题
declare module '@laoliangfe/annotation-overlay-react/style.css' {
  // 同上，仅用于让导入语句通过类型检查
  const content: string;
  export default content;
}
