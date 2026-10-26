/**
 * @file Vue demo 的 Vite 配置（开发服务器 + 构建）
 *
 * 开发：`pnpm dev:vue` 起 9200 端口并自动开浏览器。
 * 构建：`vite build`，若要发布到 GitHub Pages，由根目录的 build-pages.mjs
 * 调用 `vite build --base=./`——基础路径走 CLI 而不是写死在这里，
 * 这样同一份配置既能产出本地直开的 dist，也能产出可放进任意子目录的产物。
 *
 * 注意：这里没有配 resolve.alias / optimizeDeps。workspace 依赖由 pnpm
 * 软链到 node_modules，Vite 会直接读到 packages/vue 的源码入口，
 * 因此改组件库代码后无需重新 build 就能在 demo 里看到效果。
 *
 * @see ../../scripts/build-pages.mjs 调用 build:pages 的地方
 * @see ./src/main.ts 同样依赖组件库的样式副作用导入
 */
import { defineConfig } from 'vite';
// 官方 Vue 插件：负责 SFC 编译（template/script/style 三段）与 HMR
import vue from '@vitejs/plugin-vue';

// 仅配置插件与 dev server；build 相关选项全部走默认，base 由 CLI 注入
export default defineConfig({
  plugins: [vue()],
  server: {
    // 固定 9200：三个 demo 分别占 9000/9100/9200，同一台机器可同时起
    port: 9200,
    // 启动后自动打开默认浏览器，省去手点地址
    open: true,
  },
});
