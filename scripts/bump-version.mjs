/**
 * @file 统一设置 5 个发布包的版本号
 *
 * 用途：monorepo 里 core / ui / vue / react / angular 走「统一版本」策略——
 * 同一批发版共用一个版本号，便于使用方判断兼容性，也让 release 脚本可以一次发完。
 * 但每个包目录下各有一份 package.json（共 5 个独立文件），手改容易漏，所以用脚本统一处理。
 *
 * 用法：
 *   pnpm version:set 1.1.0      # 直接指定版本
 *   pnpm version:set patch      # 在当前版本上递增（patch / minor / major）
 *
 * 注意：
 * - 只改 version 字段，不动 dependencies（包间依赖写的是 workspace:*，
 *   pnpm publish 时会自动替换成对应版本号，所以无需手动维护）。
 * - 不创建 git commit / tag，避免脚本误提交；发布前请自行 `git add -A && git commit`。
 * - 已发布到 npm 的版本不可覆盖，重复发布同一版本会报 E403。
 *
 * @see ./RELEASE.md 完整发版流程
 * @see ../package.json 的 version:set / release 脚本
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 参与统一版本管理的包目录（顺序与发布顺序一致：被依赖者在前） */
const PACKAGES = ['core', 'ui', 'vue', 'react', 'angular'];

/**
 * 计算下一个版本号
 *
 * @param current 当前版本，形如 1.0.0
 * @param input 用户输入：完整版本号，或 patch / minor / major
 * @returns 合法的新版本号（不含前缀 v）
 * @throws 输入非法或无法解析时抛出，避免把错误版本写进 package.json
 */
function nextVersion(current, input) {
  const kinds = ['patch', 'minor', 'major'];
  if (kinds.includes(input)) {
    const [major, minor, patch] = current.split('.').map(Number);
    if (input === 'major') return `${major + 1}.0.0`;
    if (input === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }
  // 严格校验 semver 三段式，防止误把 1.1 或 v1.1.0 写进去（npm 会拒绝）
  if (!/^\d+\.\d+\.\d+$/.test(input)) {
    throw new Error(`版本号格式不合法: "${input}"，应为 x.y.z 或 patch/minor/major`);
  }
  return input;
}

const input = process.argv[2];
if (!input) {
  console.error('用法: node scripts/bump-version.mjs <x.y.z|patch|minor|major>');
  process.exit(1);
}

// 以第一个包（core）的版本作为基准，其余包应与之相同
const read = (name) => JSON.parse(readFileSync(resolve(root, 'packages', name, 'package.json'), 'utf8'));
const current = read(PACKAGES[0]).version;

/** 解析目标版本；非法输入给出友好提示而不是抛栈，避免使用者误以为脚本坏了 */
let target;
try {
  target = nextVersion(current, input);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

// 先收集所有改动再统一写盘：任一步失败都不会留下「改了一半」的状态
const plans = [];
for (const name of PACKAGES) {
  const file = resolve(root, 'packages', name, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  if (pkg.version !== current) {
    console.warn(`⚠ ${pkg.name} 当前版本 ${pkg.version} 与基准 ${current} 不一致，将一并改为 ${target}`);
  }
  plans.push({ file, pkg, name });
}

for (const { file, pkg } of plans) {
  pkg.version = target;
  // 保持 2 空格缩进 + 结尾换行，与仓库现有格式一致，避免产生无意义的 diff
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`✓ ${pkg.name} → ${target}`);
}

console.log(`\n已将 ${plans.length} 个包版本从 ${current} 改为 ${target}`);
console.log('后续步骤：');
console.log('  1. 更新 CHANGELOG.md（记录本次变更）');
console.log(`  2. git add -A && git commit -m "chore(release): v${target}" && git tag v${target}`);
console.log('  3. pnpm release   （或推送 tag 由 GitHub Actions 自动发布）');
