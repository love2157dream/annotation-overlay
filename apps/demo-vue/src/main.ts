/**
 * @file Vue demo 的应用入口
 *
 * 只做四件事，顺序不可乱：
 * 1. 取 Vue 3 的应用工厂 createApp；
 * 2. 取根组件 App.vue；
 * 3. 副作用引入覆盖层组件的样式表；
 * 4. 创建实例并挂载到 index.html 的 #app。
 *
 * 注意：`@laoliangfe/annotation-overlay-vue/style.css` 必须显式引入。
 * 库构建会把 CSS 抽到 dist/style.css 并从 JS 产物中剥离，因此包内部那行
 * import 不会跟着运行时走；漏引的表现是「覆盖层能打开、画布和工具条全无样式」，
 * 控制台却没有任何报错，很容易误判成组件 bug。
 *
 * @see ./App.vue 根组件（页面模板 + 演示逻辑）
 * @see ./shims.d.ts 为 style.css 这条导入补的模块声明
 */
// Vue 3 的应用工厂：每个应用一个独立实例，不再有全局构造函数
import { createApp } from 'vue';
// 根组件：SFC 由 @vitejs/plugin-vue 编译成 render 函数
import App from './App.vue';
// 覆盖层样式：纯副作用导入，只为让打包器把 CSS 注入页面，不绑定任何变量
import '@laoliangfe/annotation-overlay-vue/style.css';

// 创建实例并挂载到 index.html 的 #app 节点；挂载完成前模板不渲染
createApp(App).mount('#app');
