/**
 * @file Vite 库模式构建配置
 *
 * 将 packages/core/src/index.ts 打包为 ESM + CJS 双格式，并用
 * vite-plugin-dts 生成类型声明，产出供三端适配层消费的 npm 包。
 * 注意：fabric 与 @zumer/snapdom 被标记为 external，不打进产物 ——
 * 二者由使用方（适配层/宿主应用）安装，避免重复打包与多实例问题
 * （fabric 多实例会导致 instanceof 判断失效）。sourcemap 保留，便于宿主调试。
 *
 * @see packages/core/package.json
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      // 只为源码生成声明，排除测试与本地调试目录
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'dev/**/*'],
      outDir: 'dist', // 声明文件输出目录（原为 outDirs 拼写错误，默认值同为 dist，故此前未暴露）
      insertTypesEntry: true, // 生成 dist/index.d.ts
    }),
  ],
  build: {
    lib: {
      // 单入口：所有能力经 src/index.ts 汇总导出
      entry: resolve(__dirname, 'src/index.ts'),
      // UMD 全局名（当前未输出 umd，保留以备后续需要）
      name: 'AnnotationCore',
      // 产物文件名与 package.json 的 main/module 字段一一对应
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // 外部化运行时依赖：由宿主提供，防止重复实例（尤其 fabric）
      external: ['fabric', '@zumer/snapdom'],
    },
    sourcemap: true,
  },
});
