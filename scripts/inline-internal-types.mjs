/**
 * @file 把内部工作区包（core / ui）的类型声明内联进适配包的发布产物
 *
 * 发布策略：npm 上只发布 vue / react / angular 三个框架包，core 与 ui 是 monorepo
 * 内部包（package.json 里标了 private），不单独发布。但适配包编译出的 .d.ts 会保留
 * `from '@laoliangfe/annotation-overlay-core'` 这类外部引用，使用方安装后
 * TypeScript 会直接报「找不到模块 '@laoliangfe/annotation-overlay-core'」。
 *
 * 因此构建完成后需要两步处理：
 *   1. 把被引用到的内部包的 dist 下所有 .d.ts 整棵复制到 `<dist>/_internal/<name>/`；
 *   2. 把适配包产物里指向内部包的模块说明符，改写为指向该目录的相对路径。
 *
 * 只复制「确实被引用」的内部包：Vue / React 的产物已内联 ui 的运行时，
 * 其 d.ts 也不引用 ui，因此不会白白多出一份声明文件。
 *
 * 用法（cwd 必须是适配包根目录，pnpm run 默认就是）：
 *   node ../../scripts/inline-internal-types.mjs --dist dist
 *   node ../../scripts/inline-internal-types.mjs --dist dist/types   # Angular 走这个
 *
 * 注意：脚本可重复执行，每次先清空 `_internal` 目录，避免上一次的残留混进发布包。
 */
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * 需要内联的内部包清单。
 *
 * key 为 npm 包名（.d.ts 里出现的模块说明符），
 * `dir` 是复制到 `_internal/` 下的子目录名，同时也是工作区里 `packages/<dir>` 的目录名。
 */
const INTERNAL_PACKAGES = {
  '@laoliangfe/annotation-overlay-core': { dir: 'core' },
  '@laoliangfe/annotation-overlay-ui': { dir: 'ui' },
};

/**
 * 把 Windows 反斜杠路径统一成 POSIX 斜杠。
 *
 * 模块说明符里只能出现 `/`，而 path.relative 在 Windows 上返回 `..\xxx`，
 * 直接写进 import 语句会变成非法路径。
 *
 * @param p 任意平台风格的路径片段
 * @returns 以 `/` 分隔的路径
 */
const toPosix = p => p.split(sep).join('/');

/**
 * 递归收集目录下所有 `.d.ts` 文件。
 *
 * @param dir 起始目录
 * @param out 内部累积数组（递归复用，调用方无需传入）
 * @returns 绝对路径数组
 */
function collectDts(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // _internal 是上一次构建的产物，node_modules 不可能出现在 dist 里但防御一下
      if (entry.name === '_internal' || entry.name === 'node_modules') continue;
      collectDts(full, out);
    } else if (entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * 把内部包 dist 下的声明文件整棵复制到目标目录，保持原有子目录结构。
 *
 * 必须保持结构：core 的 d.ts 内部用相对路径互相引用（如 `./engine/createEventBus`），
 * 一旦拍平成单层，这些引用全部失效。
 *
 * @param srcRoot 内部包的 dist 目录
 * @param destRoot 目标目录（`<dist>/_internal/<name>`）
 * @returns 复制的文件数量
 */
function copyDtsTree(srcRoot, destRoot) {
  let count = 0;
  for (const file of collectDts(srcRoot)) {
    const target = join(destRoot, relative(srcRoot, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
    count++;
  }
  return count;
}

// ---- 解析命令行参数 ----
const distFlag = process.argv.indexOf('--dist');
if (distFlag === -1 || !process.argv[distFlag + 1]) {
  console.error('[inline-internal-types] 缺少 --dist 参数，例如：--dist dist 或 --dist dist/types');
  process.exit(1);
}
// cwd 即适配包根目录，pnpm run 会在包根执行
const pkgRoot = process.cwd();
const distDir = resolve(pkgRoot, process.argv[distFlag + 1]);
// 工作区里内部包与适配包同级，都在 packages/ 下
const workspaceRoot = resolve(pkgRoot, '..');

// ---- 1. 扫描现有声明文件，找出实际被引用的内部包 ----
const existingDts = collectDts(distDir);
if (existingDts.length === 0) {
  console.error(`[inline-internal-types] ${distDir} 下没有找到 .d.ts，请确认构建是否成功`);
  process.exit(1);
}

/** 实际需要内联的内部包：包名 → 内部包 dist 绝对路径 */
const needed = new Map();
for (const [pkgName, meta] of Object.entries(INTERNAL_PACKAGES)) {
  // 用 `'包名'` 做匹配，能同时覆盖 import / export ... from 与 import('包名') 两种写法
  const hit = existingDts.some(file => readFileSync(file, 'utf8').includes(`'${pkgName}'`));
  if (!hit) continue;
  const internalDist = resolve(workspaceRoot, meta.dir, 'dist');
  needed.set(pkgName, { dir: meta.dir, dist: internalDist });
}

if (needed.size === 0) {
  console.log('[inline-internal-types] 未发现对内部包的引用，跳过');
  process.exit(0);
}

// ---- 2. 清空上次的 _internal 并复制声明文件 ----
const internalRoot = join(distDir, '_internal');
rmSync(internalRoot, { recursive: true, force: true });
const copied = [];
for (const [pkgName, meta] of needed) {
  const dest = join(internalRoot, meta.dir);
  const n = copyDtsTree(meta.dist, dest);
  copied.push(`${meta.dir}: ${n} 个文件`);
}

// ---- 3. 改写所有产物里的模块说明符为相对路径 ----
let patchedFiles = 0;
for (const file of existingDts) {
  let code = readFileSync(file, 'utf8');
  let changed = false;

  for (const [pkgName, meta] of needed) {
    if (!code.includes(pkgName)) continue;
    // 从当前文件所在目录指向 `_internal/<dir>/index` 的相对路径，
    // 显式带 /index：部分 TS 配置（moduleResolution: bundler）下 `./dir` 解析更保守
    let rel = toPosix(relative(dirname(file), join(internalRoot, meta.dir, 'index')));
    if (!rel.startsWith('.')) rel = `./${rel}`;
    // 单引号与双引号两种字面量都要换：tsc 输出单引号，但 Angular 编译器产出双引号
    const before = code;
    code = code.split(`'${pkgName}'`).join(`'${rel}'`).split(`"${pkgName}"`).join(`"${rel}"`);
    if (code !== before) changed = true;
  }

  if (changed) {
    writeFileSync(file, code);
    patchedFiles++;
  }
}

console.log(
  `[inline-internal-types] 已内联 ${copied.join('，')}；改写 ${patchedFiles}/${existingDts.length} 个声明文件`,
);
