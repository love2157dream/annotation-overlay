/**
 * @file React 包构建配置（Vite 库模式）
 *
 * 产物结构：dist/index.es.js（ESM）、dist/index.cjs.js（CJS）、
 * dist/index.d.ts（类型入口）、dist/style.css（抽取出的样式）。
 * 与 package.json 的 exports 字段一一对应，改文件名需同步修改那边。
 *
 * 三个容易踩的坑：
 * 1. external 必须包含 `react/jsx-runtime` 与 `react/jsx-dev-runtime`。
 *    它们是 CJS 实现，被打进 ESM 产物时会留下裸 `require("react")` 调用，
 *    浏览器没有 require，直接整包报错（表现为白屏）。
 * 2. core 与 ui 必须内联：它们是 monorepo 内部包（private），不发布到 npm，
 *    外置会让使用方安装后找不到模块。真正该外置的是 fabric 与 @zumer/snapdom ——
 *    fabric 体积大，且多实例会让 instanceof 判断失效。
 * 3. cssCodeSplit 必须为 false，否则样式可能被拆成多个文件，
 *    而 package.json 只声明了固定的 dist/style.css 出口。
 *
 * @see ./package.json exports / main / module 字段
 * @see ./src/index.ts 库入口
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // React 插件：负责 JSX 转换与开发期 HMR（库构建时主要是前者）
    react(),
    // 生成类型声明：只处理 src 下的 ts/tsx，输出到 dist 并写入 types 入口字段
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      // 以 src/index.ts 为唯一入口，所有导出都从这里汇总
      entry: resolve(__dirname, 'src/index.ts'),
      // UMD 全局名，当前只产出 es/cjs 用不到，保留以便将来增加 UMD 格式
      name: 'AnnotationOverlayReact',
      // 产物名固定为 index.es.js / index.cjs.js，与 package.json 对应
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // react/jsx-runtime 与 react/jsx-dev-runtime 必须外置：
      // 它们是 CJS 实现，被打进 ESM 产物时会保留裸 require("react") 调用，
      // 在浏览器中直接抛错导致整包无法运行（白屏）。
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        // core 与 ui 刻意不列：不发布到 npm，必须打进本包
        'fabric',
        '@zumer/snapdom',
      ],
      output: {
        // globals 仅在 UMD/IIFE 格式下生效；保留是为了未来加格式时不再改结构
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        // 抽取出的 CSS 固定命名 style.css，配合 package.json 的 ./style.css 出口
        assetFileNames: 'style.[ext]',
        // 只使用具名导出，避免 CJS 互操作时多出 default 包装层
        exports: 'named',
      },
    },
    // 不拆分 CSS：库产物应只有一个 style.css，由使用方显式引入
    cssCodeSplit: false,
    // 保留 sourcemap，便于使用方在生产环境定位到库源码
    sourcemap: true,
  },
});
