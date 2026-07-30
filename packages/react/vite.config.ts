import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AnnotationOverlayReact',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@laoliangfe/annotation-overlay-core'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
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