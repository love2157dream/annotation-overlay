/**
 * ng-packagr 会把源 package.json 原样拷贝进 dist/package.json 再改写部分字段，
 * 其中以包根为基准的路径（main/types、./style.css 出口）在发布语境下
 * （发布内容即 dist 根）会多一层 dist/ 前缀，这里统一归一化。
 *
 * 这段后处理解决什么问题：
 * 源 package.json 写的是 `dist/fesm2022/xxx.mjs`（相对仓库中的包根），
 * 而 npm 发布的是 dist 目录本身，消费方解析 exports 时基准变成 dist/，
 * 于是路径被拼成 `dist/dist/fesm2022/xxx.mjs` 而 404。
 * ng-packagr 自身只做部分改写，不同版本行为不一致，因此在 postbuild 里
 * 统一把开头的 `dist/` 去掉，保证发布产物内部路径自洽。
 *
 * 执行时机：package.json 的 postbuild，必须在 ng-packagr 写完 dist 之后运行。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 以脚本目录的上一级为包根，避免依赖执行时的 cwd
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ng-packagr 的产物清单文件，所有字段均已按 dist 基准重写过
const distPkgPath = resolve(pkgRoot, 'dist/package.json');
const pkg = JSON.parse(readFileSync(distPkgPath, 'utf8'));

// 记录是否真的改过值，仅用于日志区分「已归一化」与「本来就正确」
let changed = false;
/**
 * 去掉路径开头的 `dist/` 或 `./dist/`
 *
 * 只处理字符串且确实以 dist/ 开头的情况，其余值原样返回（例如外部依赖名）。
 *
 * @param value 待归一化的字段值，可能是 undefined / 非字符串
 * @returns 去掉前缀后的路径；无需处理时返回原值
 */
const stripDistPrefix = value => {
  if (typeof value === 'string' && /^(?:\.\/)?dist\//.test(value)) {
    changed = true;
    return value.replace(/^(?:\.\/)?dist\//, '');
  }
  return value;
};

// ---- 逐字段归一化 ----
// main / types：CJS 与 TS 的解析兜底入口，字段缺失时跳过（由 exports 接管）
if (pkg.main) pkg.main = stripDistPrefix(pkg.main);
if (pkg.types) pkg.types = stripDistPrefix(pkg.types);
// style.css 出口：使用方以 `@import '包名/style.css'` 引入，路径错会导致样式 404
if (pkg.exports?.['./style.css']) {
  pkg.exports['./style.css'] = stripDistPrefix(pkg.exports['./style.css']);
}

// ---- 剔除内部工作区依赖 ----
// ng-packagr 会把源 package.json 的 dependencies 原样带进 dist/package.json，
// 其中包含 core / ui 这两个不发布到 npm 的内部包。留着它们，使用方 npm install
// 时会去 registry 找 @laoliangfe/annotation-overlay-core@x.y.z 并直接 404。
// 这两个包的运行时代码已由 inline-angular-js 打进 fesm2022，无需再声明依赖。
if (pkg.dependencies) {
  for (const name of Object.keys(pkg.dependencies)) {
    if (name.startsWith('@laoliangfe/annotation-overlay-')) {
      delete pkg.dependencies[name];
      changed = true;
    }
  }
}

// 固定 2 空格缩进 + 结尾换行，保证发布包内的 json 稳定、diff 友好
writeFileSync(distPkgPath, JSON.stringify(pkg, null, 2) + '\n');
// 输出处理结果，CI 中可据此确认 postbuild 确实执行过
console.log(`[fix-dist-package] dist/package.json normalized${changed ? '' : ' (no changes)'}`);
