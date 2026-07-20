import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.test.ts'],
      outDirs: 'dist',
      insertTypesEntry: true, // 生成 dist/index.d.ts
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AnnotationOverlay',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'umd', 'cjs'],
    },
    rollupOptions: {
      // 不要把 vue 打进包里，交给使用者自己的项目提供
      external: [
        'vue',
        'fabric',
        '@zumer/snapdom'
      ],
      output: {
        globals: {
          vue: 'Vue',
          fabric: 'fabric',
          '@zumer/snapdom': 'Snapdom'
        },
        exports: 'named',
        assetFileNames: 'style.[ext]'  // 使用字符串模板替代 name
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: 'esbuild'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})