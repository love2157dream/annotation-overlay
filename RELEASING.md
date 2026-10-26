# 发版操作手册（日常改动照这份做）

> 这份是**日常发版**的逐步操作单：改了代码 → 发到 npm → 更新线上站点。
> 一次性配置（NPM_TOKEN、Pages、老包迁移）在 [RELEASE.md](./RELEASE.md)，正常情况下一年也翻不到一次。

## 0. 先记住 6 件事

| 事实 | 含义 |
|---|---|
| **npm 上的版本不可覆盖** | 同一个版本号发出去就永久占用，改错了只能发下一个版本 |
| **只发 3 个包** | `-vue` / `-react` / `-angular`；`core` / `ui` 是 private 内部包，构建时内联，**永远不要单独发** |
| **三个包版本号必须一致** | 用 `pnpm version:set` 一次改 5 个 package.json（含内部包），别手改 |
| **tag 必须等于版本号** | CI 会校验 `v2.0.1` 与 `packages/core/package.json` 的 `version`，不一致直接失败 |
| **忘记改版本号 = 什么都没发** | CI 的守卫会跳过「registry 上已存在」的版本，三个全跳过、流水线照样是绿的，但 npm 上没有新版本 |
| **日常在 `develop`，`master` 只用来发版** | `master` 的每次变动都会触发 Pages 重新部署；没打算发的改动别往它上面推 |

### 分支与远端

| 分支 | 用途 | 谁在盯 |
|---|---|---|
| `develop` | 日常开发：改代码、修 bug、写文档，随便提交随便推 | 无（不触发 CI / Pages） |
| `master` | 发版分支：只接受从 `develop` 合并，并在这里打 tag | Pages 部署 + tag 触发 npm 发布 |
| `legacy/v1` | 老 1.x 存档，只读 | — |

| 远端 | 地址 | 用途 |
|---|---|---|
| `github` | `git@github.com:love2157dream/annotation-overlay.git` | 对外仓库，CI / Pages 都看它 |
| `origin` | `https://codeup.aliyun.com/.../annotation-overlay-fe.git` | 内部备份，可不同步 |

```bash
git checkout develop                    # 切换（已存在就直接切）
git push github develop                 # 日常推这里，不会触发任何流水线
```

## 1. 场景 → 版本号

| 你做了什么 | 版本 | 命令 |
|---|---|---|
| 修 bug、改样式、补注释、调文档 | patch | `pnpm version:set patch` |
| 加新功能、加新 prop / 新命令，旧代码照常能用 | minor | `pnpm version:set minor` |
| 删 API、改 prop 语义、改默认行为 | major | `pnpm version:set major` |
| 只改了 README / 注释，产物没变 | 不用发版 | 只提交，跳过第 3~7 步 |

> 拿不准就按 patch 发，别攒着。小步快发比攒一个大版本安全得多。

## 2. 完整流程一览

```bash
# ① 在 develop 上改完代码，本地自测
git checkout develop
pnpm dev                # 三个 demo 一起起，手点一遍功能
pnpm build              # 必须全绿
pnpm type-check         # 类型检查

# ② 定版本号（5 个包一起改，不提交不 tag）
pnpm version:set patch

# ③ 写 CHANGELOG.md

# ④ 重建 docs 站点（demo 产物要跟着新版本一起更新）
pnpm build:pages

# ⑤ 提交并推到 develop
git add -A
git commit -m "chore(release): v2.0.1"
git push github develop

# ⑥ 干跑，看 tarball 内容
pnpm release:dry

# ⑦ 合进 master、打 tag、推送（tag 触发 CI 自动发 npm）
git checkout master
git pull github master                       # 确保与远端一致，避免被拒
git merge --no-ff develop -m "chore(release): v2.0.1"
git tag -a v2.0.1 -m "v2.0.1: 修复 xxx"
git push github master --follow-tags
git checkout develop                         # 回到开发分支继续干活
```

下面逐步展开，每一步都写了「怎么确认成功」。

## 3. 逐步骤详解

### ① 本地自测

```bash
pnpm dev        # vue:5173 / react:5174 / angular:4200
pnpm build      # 8 个任务全 successful 才算过
pnpm type-check # 退出码 0
```

改过 `packages/` 之后跑 Angular demo，先删缓存，否则加载的是旧产物：

```bash
rm -rf apps/demo-angular/.angular/cache
```

### ② 定版本号

```bash
pnpm version:set patch    # 或 minor / major / 3.1.0
```

输出形如：

```
✓ @laoliangfe/annotation-overlay-core → 2.0.1
✓ @laoliangfe/annotation-overlay-ui → 2.0.1
✓ @laoliangfe/annotation-overlay-vue → 2.0.1
...
```

确认 5 个包版本一致：

```bash
node -e "for (const p of ['core','ui','vue','react','angular']) console.log(p, require('./packages/'+p+'/package.json').version)"
```

> 脚本只改文件，**不会 commit / tag**。写错了就 `git checkout -- packages` 重来。

### ③ 写 CHANGELOG.md

在 `## [2.1.0] - 2026-10-26` 这种格式的标题下加小节，用 Keep a Changelog 的三类：

```markdown
## [2.0.1] - 2026-10-26

### Fixed

- 修复移动端缩放后标注坐标偏移（问题：canvas 尺寸变化时未重算 viewportTransform）

### Changed

- `confirm` 的 `beforeCapture` 回调改为返回 `Promise<boolean>`，支持异步确认
```

破坏性改动放 `### Breaking`，并在标题下写一句迁移提示。

### ④ 重建 docs 站点

`docs/` 是生成物，里面三个 demo 引用的是各包的 **`dist/` 产物**（不是源码），所以顺序必须是
「先 `pnpm build` 出包 → 再 `pnpm build:pages` 出站点」。`build:pages` 本身**不会**帮你构建包，
只按 `--base=./` 重新构建三个 demo 并生成 `docs/index.html` —— 忘了先 build，线上 demo 跑的就是旧版本。

```bash
pnpm build:pages      # 三个 demo 产物 + 生成 docs/index.html（需先 pnpm build 过）
pnpm docs:preview     # 本地看一眼（默认 4173，自动开浏览器）
```

预览时重点看三处：首屏使用文档的版本号是否更新、顶部 Tab 切换是否正常、三个 demo 能正常标注。

> ⚠️ 不要手改 `docs/index.html`，它由 `scripts/build-pages.mjs` 生成，下次构建会被覆盖。

### ⑤ 提交到 develop

```bash
git add -A
git commit -m "chore(release): v2.0.1"
git push github develop
```

版本号改动、CHANGELOG、重建后的 `docs/` 都进这一个提交。推到 `develop` 不会触发任何流水线。

提交前确认没混进无关文件：

```bash
git show --stat HEAD
```

### ⑥ 干跑

```bash
pnpm release:dry
```

这一步会构建 + 打包但不推送。重点核对：

- **只有 3 个包**出现在清单里（出现 `-core` / `-ui` 说明 `private: true` 丢了）
- tarball 里有 `dist/`、`README.md`，**没有 `src/`**
- 包体积与此前版本接近（vue ≈ 108K / react ≈ 100K / angular ≈ 52K）

### ⑦ 合并到 master 并发布

```bash
git checkout master
git pull github master                    # 先同步，防止 push 被拒
git merge --no-ff develop -m "chore(release): v2.0.1"
git tag -a v2.0.1 -m "v2.0.1: 修复移动端缩放坐标偏移"
git push github master --follow-tags
```

- tag 名必须是 `v` + 版本号，且与 `package.json` 完全一致（`v2.0.1` ↔ `2.0.1`）；CI 会校验，不一致直接失败。
- 用 `--no-ff` 而不是快进合并，是为了在 `master` 上留一个清晰的「本次发版」节点，回滚时一眼能找到边界。
- `--follow-tags` 会把本次推送范围内可达的注解 tag 一起推上去；tag 到达远端那一刻 CI 才开始发布。

推 tag 会触发 `.github/workflows/release.yml`：安装 → 校验版本 → 构建 → 逐个包查 registry（已存在则跳过）→ 发布 → 建 GitHub Release。

到 GitHub 仓库 **Actions → Release** 看进度，绿了再往下走。发完记得 `git checkout develop` 回到开发分支。

**方案 B：本地发（CI 挂了 / 只想先本地验证时）**

```bash
pnpm release
```

要求本机 `~/.npmrc` 里有可用的 token：

```bash
npm whoami      # 必须打印用户名，返回 401 就先修 token
```

本地发完之后再推 tag，CI 会因为「registry 上已存在」全部跳过，只建 Release，不会重复发布（也不会报错）。

> A 和 B **不要同时做**，正常情况只走 A。

## 4. 发布后验证（别只看流水线变绿）

```bash
# 1. 版本号对上了吗
npm view @laoliangfe/annotation-overlay-vue version
npm view @laoliangfe/annotation-overlay-react version
npm view @laoliangfe/annotation-overlay-angular version

# 2. 依赖是否只有 fabric / @zumer/snapdom（出现 @laoliangfe/* 说明内联失败）
npm view @laoliangfe/annotation-overlay-vue dependencies

# 3. 内部包必须还是 404
npm view @laoliangfe/annotation-overlay-core version    # 期望 E404
```

再开个干净目录真实装一次，这是最能暴露问题的一步：

```bash
mkdir -p /tmp/pkgtest && cd /tmp/pkgtest
npm init -y
npm i @laoliangfe/annotation-overlay-vue
node -e "console.log(require('@laoliangfe/annotation-overlay-vue/package.json').version)"
ls node_modules/@laoliangfe/annotation-overlay-vue/dist
```

线上站点（Pages 自动从 `master` 的 `docs/` 部署，通常 1~2 分钟）：

```
https://love2157dream.github.io/annotation-overlay/
```

## 5. 出错了怎么办

| 现象 | 原因 | 处理 |
|---|---|---|
| CI 绿了但 npm 没新版本 | 忘记 `version:set`，三个包被守卫全部跳过 | 改版本号重来（tag 也要重打） |
| CI 挂在「校验 tag 与包版本一致」 | tag 与 package.json 不一致 | `git tag -d v2.0.1` 后按正确版本重打重推 |
| 发布步骤 `404 Not Found` | token 无效 / 无 `@laoliangfe` 写权限 / 未勾 Bypass 2FA | 重生成 token，同时更新 GitHub secret 与本地 `.npmrc` |
| 发布步骤 `403` | 该版本已存在，或 token 只有 stage 权限 | 版本号已被占用就发下一个；权限问题换 token |
| `EOTP` | token 没勾「Bypass 2FA」 | 换 Automation / Granular + Bypass 2FA |
| 装完组件没样式 | 使用方漏了 CSS | 检查三端 README 的 import 示例，必要时在 README 里加强提示 |
| 线上站点还是旧的 | `docs/` 没重建或没提交 | `pnpm build:pages` 后提交 `docs/` 再推 |
| Pages 部署红叉 | Settings → Pages 的源不对 | 设为 `master` 分支 + `/docs` 目录 |

**发错了版本怎么办**

```bash
# 72 小时内、没人依赖过
npm unpublish @laoliangfe/annotation-overlay-vue@2.0.1

# 超过 72 小时 / 已经有人装了 —— 不要删，废弃 + 发补丁版
npm deprecate @laoliangfe/annotation-overlay-vue@2.0.1 "该版本有已知问题，请升级到 2.0.2"
pnpm version:set 2.0.2 && pnpm release
```

> `unpublish` 之后**同名版本 24 小时内不能再发**，而且会清掉下载统计。除非刚发出去几分钟，优先用 deprecate。

## 6. 发版检查清单（可复制到 issue 里逐条打勾）

- [ ] `pnpm dev` 手点过三个 demo，功能正常
- [ ] `pnpm build` 全绿
- [ ] `pnpm type-check` 通过
- [ ] `pnpm version:set xxx` 后 5 个包版本一致
- [ ] CHANGELOG.md 已记录（含 Breaking 说明，如有）
- [ ] `pnpm build:pages` 已重建，`pnpm docs:preview` 看过
- [ ] `pnpm release:dry` 清单只有 3 个包
- [ ] 已在 `develop` 提交并推送（`git push github develop`）
- [ ] 已合并到 `master` 并打 tag（`git merge --no-ff develop` + `git tag -a vX.Y.Z`）
- [ ] `git push github master --follow-tags` 完成，Actions 变绿
- [ ] `npm view` 三个包版本都对，依赖只有 fabric / snapdom
- [ ] `npm view ...-core` 仍是 404
- [ ] 干净目录 `npm i` 安装成功
- [ ] 线上站点刷新可见新版
- [ ] 已切回 `develop` 继续开发

## 7. 常用命令速查

```bash
git checkout develop / master                  # 切换分支
git push github develop                        # 日常推送（不触发流水线）
git push github master --follow-tags           # 发版推送（触发 CI 发布 + Pages）
pnpm dev / dev:vue / dev:react / dev:angular   # 开发
pnpm build / build:vue / build:react           # 构建
pnpm type-check                                # 类型检查
pnpm build:pages                               # 重建 docs 站点
pnpm docs:preview                              # 本地预览 docs（不要用 pnpm docs）
pnpm version:set patch|minor|major|x.y.z       # 统一改版本号
pnpm release:dry                               # 干跑打包
pnpm release                                   # 本地真发
pnpm clean:all                                 # 清 node_modules + dist（环境出怪问题时）
```

分支与远端的对应关系见本文开头的「分支与远端」小节。
