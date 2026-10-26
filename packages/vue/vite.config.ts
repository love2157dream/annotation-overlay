/**
 * @file vue 包构建配置（Vite library mode）
 *
 * 产物：dist/index.es.js + dist/index.cjs.js + dist/style.css + 类型声明。
 * 发布策略决定了 external 的取舍：npm 上只发布本包（core / ui 是 private 内部包），
 * 所以 core 与 ui 都必须内联进产物；能外置的只有使用方自己提供的运行时：
 *   1. vue —— peerDependency，必须与宿主共用同一份响应式系统；
 *   2. fabric / @zumer/snapdom —— core 的运行期依赖，由 npm 正常安装，
 *      内联会重复打包体积巨大的 fabric，且多实例会让 instanceof 判断失效。
 * 文件头另注：本包比 ui 包多一个 @vitejs/plugin-vue，用于编译 .vue 单文件组件。
 *
 * 注意：CSS 仍统一抽到 dist/style.css（与 package.json 的 exports 对应），
 * 从 JS 移除后必须由使用方显式 import。
 *
 * @see ./package.json exports 与 peerDependencies
 * @see ./src/index.ts 库入口
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // 编译 .vue：模板编译与 <script setup> 语法转换都在这一步完成
    vue(),
    // 生成类型声明：除 .ts 外还要包含 .vue，否则组件本身没有 d.ts
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      // 库入口：聚合导出组件、install 与公共类型
      entry: resolve(__dirname, 'src/index.ts'),
      // UMD 全局变量名；当前仅 es/cjs，保留该字段以备后续加 umd 格式
      name: 'AnnotationOverlayVue',
      // 产物文件名与 package.json 的 main/module 对齐
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // 只外部化 vue 与 fabric/snapdom：
      // vue 由使用方提供（peerDependency），fabric 体积大且必须全应用单例；
      // core 与 ui 刻意不列入 —— 它们不发布到 npm，必须打进本包
      external: ['vue', 'fabric', '@zumer/snapdom'],
      output: {
        // 仅 umd/iife 需要全局变量映射，此处保留以兼容后续格式扩展
        globals: {
          vue: 'Vue',
        },
        // 样式统一输出为 dist/style.css，改名会让 "./style.css" 导出失效
        assetFileNames: 'style.[ext]',
        // 显式具名导出，避免 rollup 对混合导出告警
         exports: 'named',
      },
    },
    // 不拆 CSS：本包样式最终只有一份，合并可避免使用方漏引
    cssCodeSplit: false,
    // 保留 sourcemap，便于排查业务侧问题
    sourcemap: true,
  },
});
