import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isGitHub = mode === 'github';
  const base = isGitHub ? '/annotation-overlay/' : '/';

  console.log(`🔧 构建模式: ${mode}, base: ${base}`);

  return {
    plugins: [vue()],
    root: resolve(__dirname, 'dev'),
    server: {
      port: 5173,
      open: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    base: base,
    build: {
      outDir: resolve(__dirname, 'docs'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'dev/index.html'),
        },
        // external: ['vue', 'fabric', '@zumer/snapdom'],
        // output: {
        //   globals: {
        //     vue: 'Vue',
        //     fabric: 'fabric',
        //     '@zumer/snapdom': 'Snapdom',
        //   },
        // },
      },
      cssCodeSplit: false,
      sourcemap: false,
      minify: 'esbuild',
    },
    preview: {
      port: 4173,
      // 预览时自动打开浏览器并访问正确的路径
      outDir: resolve(__dirname, 'docs'),
      open: isGitHub ? '/annotation-overlay/' : '/',
    },
  };
});