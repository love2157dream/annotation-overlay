/**
 * @file @laoliangfe/annotation-overlay-vue 包入口
 *
 * 对外提供 Vue3 版覆盖层组件与两个常用类型：
 *   - 具名导出 AnnotationOverlay（便于按需引入与 tree-shaking）；
 *   - 默认导出同一个组件（便于 app.use / 直接注册）；
 *   - install 函数支持 `app.use(AnnotationOverlayVue)` 全局注册。
 *
 * 注意：第一行的 CSS 导入是构建期的样式聚合入口——构建时会被抽到
 * dist/style.css 并从 JS 中移除，因此使用方必须显式
 * `import '@laoliangfe/annotation-overlay-vue/style.css'`，只引组件不会带样式。
 *
 * @see ./components/AnnotationOverlay.vue 组件实现
 * @see ../ui/src/styles/overlay.css 实际样式来源
 */
import '@laoliangfe/annotation-overlay-ui/style.css';
import AnnotationOverlay from './components/AnnotationOverlay.vue';
import type { ConfirmPayload, ToolId } from '@laoliangfe/annotation-overlay-core';

/** 具名导出：适合 `import { AnnotationOverlay } from '...'` 的按需引入写法 */
export { AnnotationOverlay };
/** 默认导出：适合 `import AnnotationOverlay from '...'`，与具名导出指向同一组件 */
export default AnnotationOverlay;

/**
 * Vue 插件安装函数：全局注册 <AnnotationOverlay> 组件
 *
 * 供 `app.use(AnnotationOverlayVue)` 使用；注册后模板中可直接写
 * `<annotation-overlay ref="..." />`。组件本身无 props，调用方式仍是通过 ref 调 open/close。
 *
 * 副作用：修改传入 app 实例的全局组件表。
 *
 * @param app Vue 应用实例（类型放宽为 any，避免把 vue 的 App 类型写进公共声明）
 * @example
 * import AnnotationOverlay from '@laoliangfe/annotation-overlay-vue';
 * import '@laoliangfe/annotation-overlay-vue/style.css';
 * createApp(App).use(AnnotationOverlay).mount('#app');
 */
export function install(app: any): void {
  app.component('AnnotationOverlay', AnnotationOverlay);
}

/** 透出核心包的两个类型，使用方无需再单独安装/引入 core 即可标注回调参数 */
export type { ConfirmPayload, ToolId };
