/**
 * @file Vue 单文件组件与 CSS 的模块声明
 *
 * 让 TypeScript 认识 `import X from './X.vue'` 与 `import './x.css'`：
 * 构建脚本先跑 `vue-tsc --noEmit` 做类型检查，而 .vue 文件由 vue-tsc 自身处理，
 * 但通过路径别名/第三方包引入 .vue 时仍需兜底声明；CSS 则是纯副作用导入。
 *
 * 注意：这里把 .vue 统一声明为 DefineComponent<{}, {}, any>，
 * 因此组件的 props/expose 类型不会被推导——需要精确类型时请在业务侧
 * 用 InstanceType<typeof AnnotationOverlay> 获取。
 *
 * @see ./index.ts 包入口
 */
// packages/vue/src/shims-vue.d.ts
// 通配声明：任意 .vue 文件都视为一个无 props 的通用组件
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 通配声明：允许纯副作用地导入样式文件，由打包器负责抽取
declare module '*.css';
