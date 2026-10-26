/**
 * @file React demo 的 Vite 配置（开发服务器 + 构建）
 *
 * 开发：`pnpm dev:react` 起 9000 端口并自动开浏览器。
 * 构建：`vite build`；发布到 GitHub Pages 时由根目录 build-pages.mjs 调用
 * `vite build --base=./`，基础路径刻意不写在这里——同一份配置要同时服务
 * 「本地直开 dist」和「放进 docs/react/ 子目录」两种场景。
 *
 * 注意：本文件没有配置 resolve.alias / optimizeDeps / external。
 * demo 是应用而不是库，React 应当被打进产物；需要 external 的是
 * packages/react 的库构建（漏掉 react/jsx-runtime 会残留裸 require 调用，
 * 浏览器白屏），两者配置不能互相照抄。
 *
 * @see ../../packages/react/vite.config.ts 库构建侧的外置配置
 * @see ../../scripts/build-pages.mjs 调用 build:pages 的地方
 */
import { defineConfig } from 'vite';
// 官方 React 插件：JSX 转换（自动运行时）+ 开发期 Fast Refresh
import react from '@vitejs/plugin-react';

// 仅配置插件与 dev server；build 选项走默认值
export default defineConfig({
  plugins: [react()],
  server: {
    // 固定 9000：三个 demo 分别占 9000/9100/9200，可并行启动
    port: 9000,
    // 启动后自动打开浏览器
    open: true,
  },
});
