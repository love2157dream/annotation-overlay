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

// 0. 声明 *.vue 单文件组件的模块类型
// 纯 tsc（根目录 type-check 脚本就是这种）不认识 .vue，遇到 `import App from './App.vue'`
// 会报 TS2307「找不到模块」。vue-tsc 自己能解析 SFC，但它只用于本包的 build 脚本；
// CI 跑的是通用 tsc，所以这里必须补一条通配声明兜底。
// 代价是 tsc 不再检查 SFC 内部错误——那是 vue-tsc 的职责，build 阶段会拦住。
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // 通用组件类型：props 等细节不在这里建模，避免与真实 SFC 签名冲突
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

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
