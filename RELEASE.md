# 发布手册（一次性配置与背景）

> **日常改完代码要发版，请直接看 [RELEASING.md](./RELEASING.md)** —— 那份是逐步操作单，照着敲即可。
> 本文只保留「一次性」的内容：仓库整合历史、NPM_TOKEN / Pages 配置、老包冻结、版本策略背景。
> 已经配好的环境，正常发版用不到这里。

面向维护者的发版流程：仓库整合 → 版本号 → npm 发布 → GitHub Pages。
日常开发看 [README](./README.md)，这里只讲「怎么把东西发出去」。

## 0. 现状

| 对象 | 状态 |
|---|---|
| `@laoliangfe/annotation-overlay`（1.x，单文件 Vue 组件） | 已发布 **1.1.7**，**冻结**，源码对应 tag `v1.1.7` |
| `@laoliangfe/annotation-overlay-{vue,react,angular}` | 公开发布，统一 **2.0.0** |
| `@laoliangfe/annotation-overlay-{core,ui}` | **private 内部包，不发布**；构建时内联进上面三个包 |
| GitHub 仓库 | `love2157dream/annotation-overlay`（monorepo：全部源码、三个 demo、文档站） |
| 演示与文档 | https://love2157dream.github.io/annotation-overlay/ |

命名策略：**只发布三个框架包**，用户装一个即可用。引擎与样式在构建期内联，
不占 npm 命名空间，也就不存在「core / vue 版本没对齐」这类问题。
老包 1.1.7 冻结并保留 tag，npm 页面用 `deprecate` 提示迁移与源码 tag 地址。

## 1. 版本策略

- **统一版本**：三个框架包永远同号（2.0.0、2.0.1、2.1.0…）。内部包 `core` / `ui` 也同步跟号，便于源码里对照，但不发布。
- **首发即 2.0.0**：与老包 1.1.7 形成产品线延续（单文件 Vue 组件 → 新一代三端组件）。README、CHANGELOG 已写明这一点，避免用户去找并不存在的 1.x 迁移指南。
- **语义化版本**：破坏性改动 → major；新增能力 → minor；修复 → patch。
- 老包 `@laoliangfe/annotation-overlay` 停在 1.1.7，不再改动。

## 2. 仓库整合（只做一次）

> 📌 本节是**历史操作记录**，写于远端还叫 `github`（GitHub）/ `origin`（codeup）的时候。
> 2026-10-26 已改成 **`origin` = GitHub**（对外主仓）、**`aliyun` = codeup**（私有备份仓），
> 所以下面命令里的 `github` / `origin` 与现在的实际名字不同 —— 只是留档，不要再照着执行。

目标：GitHub 仓库 `main` 放 monorepo，老代码留在分支与 tag 上，Pages 地址不变。当前 monorepo 的远端是 codeup，需要切到 GitHub。

```bash
# ① 先备份整个本地仓库（出问题还能回到今天的状态）
cd annotation-overlay-fe
git bundle create ../annotation-overlay-fe.bundle --all

# ② 在 GitHub 上给老版本存档：打 tag + 留分支（这一步必须在强推之前）
#    在老的 annotation-overlay 工作区执行
git fetch origin
git tag -a v1.1.7 -m "legacy: Vue3 single-file component (npm 1.1.7)" origin/main
git push origin v1.1.7
git branch legacy/v1 origin/main
git push origin legacy/v1

# ③ 把 monorepo 推到 GitHub 的 main
#    在 annotation-overlay-fe 里执行
git remote add github git@github.com:love2157dream/annotation-overlay.git
git add -A
git commit -m "feat: monorepo v2.0.0 — vue/react/angular packages + docs site"
git tag -a v2.0.0 -m "v2.0.0: three framework packages (core/ui inlined)"
git push github HEAD:main --force-with-lease
git push github v2.0.0

# ④ 以后默认远端改成 GitHub（codeup 保留为备份）
git remote rename origin codeup
git remote rename github origin
```

> ⚠️ `--force-with-lease` 会覆盖 GitHub 上的 `main`。执行前确认第 ② 步的 tag 与分支已经推送成功，
> 否则老代码只剩本地副本。

**Pages 设置**（仓库 Settings → Pages）：

- Source 选 `Deploy from a branch`
- Branch 选 `main`，目录选 `/docs`
- 保存后访问 https://love2157dream.github.io/annotation-overlay/ ，首屏是「使用文档」，顶部 Tab 可切三个框架的在线演示

`docs/` 是 `pnpm build:pages` 的生成物，需要提交到仓库（Pages 从分支读取）。改完代码后：

```bash
pnpm build:pages   # 重新生成 docs/
git add docs && git commit -m "docs: rebuild pages"
```

## 3. 首次发布到 npm

**前置检查**

- [ ] 当前 npm 账号是 `@laoliangfe` scope 的 owner（否则 3 个新包发不出去）
- [ ] 已 `npm login`，且账号开启 2FA（发布时需 `--otp`）
- [ ] `packages/{vue,react,angular}/package.json` 里 `version` 都是 `2.0.0`、`publishConfig.access` 为 `public`
- [ ] `packages/{core,ui}/package.json` 里带 `"private": true`（pnpm 会自动跳过，避免误发内部包）
- [ ] `pnpm build` 全绿

**先干跑，再真发**

```bash
pnpm install
pnpm build
pnpm release:dry     # 只打包不推送：检查每个包的 tarball 内容、版本、依赖改写
pnpm release         # 真发；2FA 账号加 --otp=123456，例如 pnpm release --otp=123456
```

`pnpm -r publish` 只会命中三个框架包 —— `core` / `ui` 标了 `private`，会被自动跳过。
三者之间**没有依赖关系**（引擎与样式已在构建时内联），因此发布顺序无关紧要。

**发布后验证**（务必做，不要只看命令成功）

```bash
# 1. 版本与依赖是否正确
npm view @laoliangfe/annotation-overlay-vue version      # 期望 2.0.0
npm view @laoliangfe/annotation-overlay-vue dependencies # 期望只有 fabric / @zumer/snapdom
#    出现任何 "@laoliangfe/annotation-overlay-core" 都说明内联失败，立刻停下来排查

# 2. 确认内部包确实没上 registry（应当 404）
npm view @laoliangfe/annotation-overlay-core version     # 期望 E404

# 2. 干净目录真实安装（最能暴露问题的一步）
mkdir -p /tmp/pkgtest && cd /tmp/pkgtest
npm init -y
npm i @laoliangfe/annotation-overlay-vue
node -e "console.log(require('@laoliangfe/annotation-overlay-vue/package.json').version)"
ls node_modules/@laoliangfe/annotation-overlay-vue/dist
```

## 4. 老包冻结（deprecate）

老包 1.1.7 的 `repository` / `homepage` 在发布时就固化进 tarball 了，不发新版本改不了。
要在 npm 页面上把访客引到 `v1.1.7` 的源码，用 `deprecate` 最省事 —— 不需要动代码、不需要发版：

```bash
npm deprecate @laoliangfe/annotation-overlay@"<=1.1.7" \
  "1.x 已冻结，不再更新。源码见 https://github.com/love2157dream/annotation-overlay/tree/v1.1.7 ，新项目请用 @laoliangfe/annotation-overlay-vue@2"
```

- 效果：npm 包页面顶部出现黄色提示条（内容即上面这段文字，链接可点），`npm i` 时也会打印。
- 撤销：`npm deprecate @laoliangfe/annotation-overlay@"<=1.1.7" ""`
- **不要用 `npm unpublish`**：会连带清掉下载统计，且 24 小时后同名版本不能再发布。

## 5. 后续发版

日常操作（改代码 → 升版本 → 提交 → 推 tag → 校验 npm → 更新站点）见 **[RELEASING.md](./RELEASING.md)**，这里只记三条容易踩的规则：

1. 版本号一律用 `pnpm version:set patch|minor|major`（一次改 5 个 package.json），**不要手改**，也**不要忘记改** —— 忘记改时 CI 会因「版本已存在」把三个包全部跳过，流水线仍然显示成功。
2. tag 名必须是 `v` + 版本号，且与 `packages/core/package.json` 的 `version` 完全一致，否则 CI 的校验步骤直接失败。
3. 分支：日常开发与提交都在 **`develop`**，**`master`** 只接受从 `develop` 合并并在其上打 tag；远端命名：**`origin` = GitHub 对外主仓**（CI / Pages 看它），**`aliyun` = codeup 私有备份仓**（只备份，不参与发布）。

自动发布依赖的一次性配置：

1. npm 网站 → Access Tokens → 生成 **Granular Access Token**，`Packages and scopes` 选 `Read and write (publish and stage)`，Scope 选 `@laoliangfe`，并勾选 **Bypass two-factor authentication**
2. GitHub 仓库 → Settings → Secrets and variables → Actions → 新建 `NPM_TOKEN`，粘贴 token
3. 之后推 tag 即可，workflow 会校验版本、逐个包查 registry（已存在则跳过）后发布，并创建 GitHub Release

> token 有效期到了会表现为「发布步骤返回 404」（npm 对无权限的写入统一返回 404 而不是 401）。
> 重新生成后要**同时**更新 GitHub secret 和本机 `~/.npmrc`，否则 CI 与本地会一个能用一个不能用。

## 6. 回滚

| 场景 | 做法 |
|---|---|
| 刚发错版本（72 小时内） | `npm unpublish @laoliangfe/xxx@1.0.1`；已被依赖的包不要删，改用 deprecate |
| 超过 72 小时 | `npm deprecate @laoliangfe/xxx@1.0.1 "该版本有已知问题，请升级到 1.0.2"`，再发补丁版 |
| 整包废弃 | 只 deprecate，不删除（删除会让已有 lockfile 装不上） |
| 代码回滚 | `git revert` 后按正常流程发新 patch，**不要**重发同一版本号（npm 不允许覆盖） |

## 7. 常见问题

| 现象 | 原因与处理 |
|---|---|
| `E403 Forbidden` | 未登录 / 无 scope 权限 / 2FA 未带 `--otp` / 该版本已存在 |
| `EPUBLISHCONFLICT` | 同版本已发布，改版本号重发 |
| 安装后组件无样式 | 使用方漏了 `import '@laoliangfe/annotation-overlay-<fw>/style.css'` |
| 页面空白 + 控制台 `require is not defined` | React 包构建漏配 external（`react/jsx-runtime`），检查 `packages/react/vite.config.ts` |
| Angular 报 peer 不兼容 | 本包 peer 为 `@angular/core ^21.0.0`，Angular 20 及以下不支持 |
| React 19 项目 peer 冲突 | 当前 peer 为 `^18.3.1`；可用 `--legacy-peer-deps`，或评估后放宽 peer 范围再发 minor |
| `pnpm docs` 报 `required arguments not provided` | `docs` 与 pnpm 内置命令冲突，用 `pnpm docs:preview` |
| Pages 打开 404 | 确认 Settings → Pages 指向 `main /docs`，且 `docs/.nojekyll` 已提交 |

## 8. 发版检查清单

- [ ] `pnpm build` 通过，`pnpm build:pages` 能生成 docs
- [ ] `pnpm version:set` 改完三个框架包版本一致
- [ ] CHANGELOG.md 已更新
- [ ] `pnpm release:dry` 看过 tarball 内容（含 `dist`、`README.md`，不含 `src`）
- [ ] 发布后用干净目录 `npm i` 验证过
- [ ] `docs/` 已重新生成并提交，线上页面刷新可见
- [ ] 打 tag 并推送（若走 CI 发布）
