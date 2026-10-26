/**
 * @file 把 core / ui 的运行时代码内联进 Angular 包的 fesm2022 产物
 *
 * 为什么需要这层后处理：
 * ng-packagr 内部用 rollup 打包，规则是「非相对路径的 import 一律视为外部依赖」，
 * 并且没有 webpack 的 noExternal / vite 的 noExternal 这类开关可以让它内联
 * node_modules 里的包。而 npm 上只发布三个框架包、core 与 ui 是 private 内部包，
 * 产物里一旦残留 `from '@laoliangfe/annotation-overlay-core'`，
 * 使用方安装后运行时直接找不到模块。
 *
 * 因此 postbuild 阶段用 vite（底层即 rollup）对 fesm 文件做一次二次打包：
 * 把 core / ui 解析成工作区里的实际产物并内联，其余运行时依赖保持 external。
 *
 * 之所以只对 Angular 做这一步：Vue / React 用 vite 库模式构建，
 * 只要在 external 里不列 core，它天然就会被内联。
 *
 * 顺序要求：必须在 fix-dist-package 之后运行 —— 那边会把 dist/package.json 的路径
 * 归一化到 dist 基准，这里才能按 exports 字段定位入口文件。
 *
 * 注意：`treeshake: false` 是刻意的。fesm2022 已由 Angular 编译器编译过，
 * 二次打包只需做模块拼接；开启 tree-shaking 有概率误删组件装饰器的副作用引用。
 */
import { copyFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// 脚本位于 <repo>/scripts/，包在 <repo>/packages/angular
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'angular');
const distDir = resolve(pkgRoot, 'dist');

// ---- 1. 从已归一化的 dist/package.json 读取入口，避免硬编码文件名 ----
const distPkg = JSON.parse(readFileSync(resolve(distDir, 'package.json'), 'utf8'));
const entryRel = distPkg.exports?.['.']?.default;
if (!entryRel) {
  console.error('[inline-angular-js] dist/package.json 缺少 exports["."].default，无法定位入口');
  process.exit(1);
}
const entryFile = resolve(distDir, entryRel);
if (!existsSync(entryFile)) {
  console.error(`[inline-angular-js] 入口不存在: ${entryFile}`);
  process.exit(1);
}

// 二次打包先输出到临时目录，成功后再覆盖原文件：
// 直接写原路径会让 rollup 边读边写同一个文件
const tmpDir = resolve(distDir, '.inline-tmp');

// ---- 2. 二次打包：内联 core / ui，其余保持外部 ----
await build({
  configFile: false,
  root: pkgRoot,
  logLevel: 'warn',
  build: {
    lib: {
      entry: entryFile,
      formats: ['es'],
      // 产物名必须与 entry 同名，后面直接覆盖回 fesm2022
      fileName: () => basename(entryFile),
    },
    outDir: tmpDir,
    emptyOutDir: true,
    // 不压缩：库产物保留可读代码，便于使用方排查问题
    minify: false,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      // Angular 运行时、rxjs、tslib 由使用方提供；
      // fabric 与 @zumer/snapdom 是 core 的运行期依赖，必须留给 npm 安装
      external: [/^@angular\//, /^rxjs/, /^rxjs\//, 'tslib', 'fabric', '@zumer/snapdom'],
      treeshake: false,
    },
  },
});

// ---- 3. 覆盖原产物并清理 ----
const built = resolve(tmpDir, basename(entryFile));
copyFileSync(built, entryFile);
rmSync(tmpDir, { recursive: true, force: true });

// 原 sourcemap 对应的是内联前的代码，覆盖后已失真，删掉避免误导调试器
const mapFile = `${entryFile}.map`;
if (existsSync(mapFile)) rmSync(mapFile, { force: true });

console.log(`[inline-angular-js] 已内联 core / ui 到 ${entryRel}`);
