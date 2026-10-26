/**
 * @file ui 包构建配置（Vite library mode）
 *
 * 产物：dist/index.es.js + dist/index.cjs.js + dist/style.css + 类型声明。
 * 本包不含任何运行时依赖，唯一需要打入产物的是两个 CSS 文件，
 * 因此配置重点在「CSS 抽取成独立文件」与「类型声明一并生成」。
 *
 * 注意：CSS 被抽到 dist/style.css 后不会再由 JS 自动注入，
 * 使用方（vue/react/angular 适配层与最终业务）必须显式 import 该文件。
 *
 * @see ./package.json exports 字段（./style.css 指向 dist/style.css）
 * @see ./src/index.ts 库入口
 */
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // 生成 .d.ts：为 src 下所有 ts 文件产出声明，并写入类型入口，
    // 让 package.json 的 "types": "dist/index.d.ts" 能命中
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      // 库入口：与 package.json 的 main/module 对齐，统一从这里聚合导出
      entry: resolve(__dirname, 'src/index.ts'),
      // UMD 全局变量名；当前只输出 es/cjs，保留该字段以备后续加 umd 格式
      name: 'AnnotationOverlayUI',
      // 产物文件名固定为 index.es.js / index.cjs.js，供 exports 字段直接引用
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      output: {
        // 样式资源统一输出为 dist/style.css：
        // 包内 exports 已声明 "./style.css"，改名会让使用方 import 失效
        assetFileNames: 'style.[ext]',
        // 显式使用具名导出，避免 rollup 对混合导出给出告警
        exports: 'named',
      },
    },
    // 关闭 CSS 代码分割：本包只有一份样式，合并成单文件可避免使用方漏引
    cssCodeSplit: false,
    // 保留 sourcemap，便于业务侧排查样式/数据来源
    sourcemap: true,
  },
});
