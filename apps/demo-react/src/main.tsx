/**
 * @file React demo 的应用入口
 *
 * 按顺序做四件事：
 * 1. 取 React（StrictMode 用）与 react-dom/client 的 createRoot；
 * 2. 引入根组件 App；
 * 3. 引入两份样式：组件库 style.css（必需）+ 演示页 styles.css；
 * 4. 以 StrictMode 包裹渲染到 #root。
 *
 * 注意：
 * - `@laoliangfe/annotation-overlay-react/style.css` 不能省。库构建把 CSS
 *   抽到 dist/style.css 并从 JS 中剥离，包内部那行 import 只服务于构建期抽取，
 *   使用方必须自己再引一次，否则覆盖层能打开但完全没有样式。
 * - `document.getElementById('root')!` 的非空断言是安全的：index.html 里
 *   必然存在 #root，删掉该节点属于配置错误而非运行时分支。
 *
 * @see ./App.tsx 根组件
 * @see ./styles.css 演示页样式
 * @see ./shims.d.ts 为样式导入补的模块声明
 */
import React from 'react';
// React 18 的新入口：createRoot 替代 ReactDOM.render（后者已废弃）
import ReactDOM from 'react-dom/client';
import App from './App';
// 组件样式：包构建会把 CSS 抽到 dist/style.css，必须由使用方显式引入
import '@laoliangfe/annotation-overlay-react/style.css';
// 演示页样式
import './styles.css';

// 以 React 18 并发根渲染；StrictMode 仅在开发环境双调用部分生命周期/effect
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
