// apps/demo-vue/src/shims.d.ts

// 1. 声明所有 CSS 文件的模块类型
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.scss' {
  const content: string;
  export default content;
}

declare module '*.sass' {
  const content: string;
  export default content;
}

declare module '*.less' {
  const content: string;
  export default content;
}

// 2. 显式声明组件库的样式文件 
declare module '@laoliangfe/annotation-overlay-react/style.css' {
  const content: string;
  export default content;
}