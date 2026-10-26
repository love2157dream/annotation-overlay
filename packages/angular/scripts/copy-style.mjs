/**
 * 构建前把 ui 包的 dist/style.css 拷贝到 src/assets/style.css，
 * 由 ng-package.json 的 assets 复制进 dist 根目录（作为 ./style.css 出口）。
 * 注意：本包构建依赖 ui 包已构建（turbo dependsOn: ^build 保证顺序）。
 *
 * 为什么需要这段后处理：
 * Angular 包用 ng-packagr 打包，它只处理 TS 与模板，不会像 Vite 那样把 JS 中
 * 导入的 CSS 抽取成独立文件。ui 包的样式又只能从 dist/style.css 取得，
 * 因此必须手动搬运：ui dist → 本包 src/assets → （ng-packagr）→ 本包 dist 根。
 *
 * 为什么是 prebuild 而不是 build 内联：package.json 的 prebuild/postbuild
 * 由 npm/pnpm 生命周期自动执行，ng-packagr 只负责打包，两者职责分开更清晰。
 *
 * 该脚本本身无副作用地失败（找不到 CSS 直接抛错），避免产出「有组件无样式」的包。
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// ESM 下没有 require.resolve，用 createRequire 复用 CJS 的解析规则
const require = createRequire(import.meta.url);
// 以脚本所在目录（scripts/）的上一级作为包根，保证在任意 cwd 下执行都正确
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 解析 ui 包样式文件在磁盘上的真实路径
 *
 * 依次尝试三种方式，任一命中即返回：
 * 1. 包导出映射 `@laoliangfe/annotation-overlay-ui/style.css`（推荐，跟随 exports）；
 * 2. 旧式深路径 `.../dist/style.css`（兼容 exports 尚未声明的历史版本）；
 * 3. pnpm workspace 下本包 node_modules 的软链（解析失败时的兜底）。
 *
 * @returns ui 包 style.css 的绝对路径
 * @throws 三种方式都找不到时抛错，提示先构建 ui 包
 */
function resolveUiStyle() {
  const specifiers = [
    '@laoliangfe/annotation-overlay-ui/style.css',
    '@laoliangfe/annotation-overlay-ui/dist/style.css',
  ];
  for (const id of specifiers) {
    try {
      // require.resolve 会读取 ui 的 exports 字段，能正确处理条件导出
      return require.resolve(id);
    } catch {
      /* try next */
    }
  }
  // 兜底：pnpm workspace 下直接找本包 node_modules 里的软链
  // （某些 hoisting 配置下 exports 解析可能失败，但文件实际存在）
  const fallback = resolve(
    pkgRoot,
    'node_modules/@laoliangfe/annotation-overlay-ui/dist/style.css',
  );
  if (existsSync(fallback)) return fallback;
  throw new Error(
    '[copy-style] 找不到 @laoliangfe/annotation-overlay-ui/dist/style.css，请先构建 ui 包',
  );
}

// ---- 解析源文件 ----
const src = resolveUiStyle();
// 目标固定在 src/assets：ng-package.json 的 assets 只监听这个目录，
// 换位置需要同步修改 ng-package.json，否则样式不会进入 dist
const dest = resolve(pkgRoot, 'src/assets/style.css');
// 目录可能被清理过，递归创建；已存在时无操作
mkdirSync(dirname(dest), { recursive: true });
// 整文件覆盖：该文件是产物，不做增量合并，避免残留旧版本样式
copyFileSync(src, dest);
// 打印来源与目标，便于 CI 日志排查「样式是否是最新的」
console.log(`[copy-style] ${src} -> ${dest}`);
