import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AnnotationOverlayVue',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue', '@laoliangfe/annotation-overlay-core'],
      output: {
        globals: {
          vue: 'Vue',
          '@laoliangfe/annotation-overlay-core': 'AnnotationCore',
        },
        assetFileNames: 'style.[ext]',
         exports: 'named',
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
});