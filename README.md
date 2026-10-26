# Annotation Overlay

网页截图标注组件：对任意 DOM 元素截图铺到 Fabric.js 画布上，直接在页面内容上圈画、写批注，导出带标注的 PNG。
核心引擎框架无关，Vue 3 / React 18 / Angular 21 三端共用同一套能力与样式。

- 在线文档与演示：https://love2157dream.github.io/annotation-overlay/
- 源码与问题反馈：https://github.com/love2157dream/annotation-overlay

## 📦 包

npm 上只发布 **3 个框架包**，每个都是「装一个即可用」：

| 包 | 说明 |
|---|---|
| [`@laoliangfe/annotation-overlay-vue`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-vue) | Vue 3 组件 |
| [`@laoliangfe/annotation-overlay-react`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-react) | React 18 组件 |
| [`@laoliangfe/annotation-overlay-angular`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay-angular) | Angular 21 组件（standalone + signals） |

三个包**统一版本号**。`core`（框架无关引擎）与 `ui`（样式 / 图标 / 设计令牌）是
monorepo 内部包，`package.json` 里标了 `private`，**不发布到 npm** ——
构建时分别由 vite 库模式（Vue / React）与 `scripts/inline-angular-js.mjs`（Angular）
内联进各自产物，类型声明由 `scripts/inline-internal-types.mjs` 一并内联。
使用方因此不需要、也不应该安装 `core` / `ui`。

> 旧包 [`@laoliangfe/annotation-overlay`](https://www.npmjs.com/package/@laoliangfe/annotation-overlay)（1.x 单文件 Vue 组件）
> 已冻结在 **1.1.7**，源码对应 tag [`v1.1.7`](https://github.com/love2157dream/annotation-overlay/tree/v1.1.7)。
> 它不再接收新功能，API 与 `-vue` 完全一致：把 import 路径改成 `-vue`、补一行 `style.css` 即可迁移。

## 🚀 快速开始

```bash
npm i @laoliangfe/annotation-overlay-vue     # 或 -react / -angular
```

```vue
<script setup lang="ts">
import { ref } from 'vue';
import AnnotationOverlay from '@laoliangfe/annotation-overlay-vue';
import '@laoliangfe/annotation-overlay-vue/style.css';

const card = ref<HTMLElement>();
const overlay = ref<InstanceType<typeof AnnotationOverlay>>();
</script>

<template>
  <div ref="card">要标注的内容</div>
  <button @click="overlay?.open(card!)">添加标注</button>
  <AnnotationOverlay ref="overlay" @confirm="(p) => p && console.log(p.blob)" />
</template>
```

React / Angular 的完整示例、API 速查见文档站，或各包的 `README.md`。

## 🛠 常用命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 同时启动 vue / react / angular 三个 demo（端口 5173 / 5174 / 4200）
pnpm dev:vue        # 只启动某一个
pnpm build          # 构建全部包与 demo
pnpm docs:preview   # 本地预览 docs/ 站点（等价于 pnpm run docs）
pnpm docs:build     # 重新构建三个 demo 产物 → 写入 docs/ → 打开预览
pnpm version:set    # 统一修改三个框架包的版本号（patch / minor / major / x.y.z）
pnpm release:dry    # 发布前干跑：构建 + 打包，不推送
pnpm release        # 构建并发布 3 个包到 npm（详见 RELEASE.md）
```

> ⚠️ `pnpm docs` 是 pnpm 的内置命令（打开 npm 包文档页），会被 pnpm 自身拦截，
> 因此本地预览请用 **`pnpm docs:preview`** 或 **`pnpm run docs`**。

### docs/ 站点说明

`docs/` 是部署到 GitHub Pages 的静态站，**由 `pnpm build:pages` 自动生成，不要手改**：

- `docs/index.html` —— 首屏是「使用文档」（安装、三端用法、API 速查），顶部 Tab 可切三个框架的在线演示
- `docs/vue|react|angular/` —— 三个 demo 以相对 `base` 构建出的产物
- `docs/.nojekyll` —— 关闭 Jekyll 处理，避免下划线开头的资源被忽略

演示区用 iframe 懒加载：首屏只加载文档，切到某个框架时才请求对应 demo 的包。

预览服务（`scripts/serve-docs.mjs`）零依赖，仅用 Node 内置模块：默认端口 `4173`
（被占用自动 +1），启动后自动打开浏览器；可用 `pnpm docs:preview -- --port 8080`
指定端口，`-- --no-open` 关闭自动打开。

## 🧭 代码结构与阅读顺序

四层结构，自上而下依赖，`core` 不依赖任何框架：

| 层 | 目录 | 职责 |
|---|---|---|
| 引擎 | `packages/core` | 纯 TS：截图、Fabric 画布、六种工具、撤销/重做、导出 |
| 共享资源 | `packages/ui` | 工具/颜色/字号等静态数据、图标几何数据、`overlay.css` 与设计令牌 |
| 框架适配 | `packages/{vue,react,angular}` | 把引擎包成框架组件，用响应式状态驱动 UI |
| 演示 | `apps/demo-*`、`scripts/` | 三个可运行 demo、聚合演示站构建与本地预览 |

> 注意：`core` 与 `ui` 只存在于**源码层面**。它们在 package.json 里标了 `private`，
> 构建时由 vite 库模式（Vue / React）或 `scripts/inline-angular-js.mjs`（Angular）
> 内联进三个框架包，类型声明再由 `scripts/inline-internal-types.mjs` 一并内联，
> 因此 npm 上只有 `-vue` / `-react` / `-angular` 三个包。

建议阅读顺序：`core/src/engine/createCanvasEngine.ts`（一次标注会话的全生命周期）→
`core/src/tools/createBaseTool.ts` 与任一工具（绘制契约）→ `ui/src/data.ts` +
`ui/src/styles/overlay.css`（UI 结构）→ 任一框架的 `AnnotationOverlay`（挂载与事件桥接）。

### 注释约定

代码内注释按下列约定编写，修改时请保持一致：

- **文件头**：每个源文件（含 CSS）顶部有 `@file` 块，说明职责、在架构中的位置、
  对外暴露的能力与依赖关系，必要时列出「注意」事项（踩坑点）与 `@see` 相关文件。
- **导出 API**：函数、工厂、组件、hook、方法均有 JSDoc，包含 `@param`（含义与取值，
  而非仅类型）、`@returns`（含 null / reject 语义）、副作用说明；非平凡者带 `@example`。
- **类型与常量**：接口每个字段、配置每一项都有行内注释，写明含义、单位、默认值。
- **实现细节**：注释解释「为什么」而非复述「做了什么」；长函数用 `// ---- 步骤名 ----`
  分块；框架相关的取舍（`nextTick`、`signal`、`useEffect` 依赖）写清原因。
- **样式**：CSS 以 `/* ===== 区块名 ===== */` 分节，关键类名注明对应模板节点，
  并在文件头说明定位与变量消费关系。

## ⚠️ 修改前必读（Fabric 7 相关坑）

| 现象 | 原因 |
|---|---|
| 画布可见但无法绘制 | `new fabric.Canvas()` 会生成 `.canvas-container`，事件绑在 upper 层；挂载必须用引擎的 `getContainerElement()`（`wrapperEl`），不能只挂 `getElement()` |
| 打开标注后画面发虚 | 不能设 `enableRetinaScaling: false`，也不要手写 `canvasEl.width/height`，否则位图锁死 1x，高 DPI 屏被放大 |
| 导出图比屏幕模糊 | 导出用 `lowerCanvasEl.toDataURL()/toBlob()` 且**不要传 multiplier**，否则 Fabric 按逻辑尺寸重新合成，丢掉高 DPI 采样 |
| 使用方样式缺失 | 包构建把 CSS 抽到 `dist/style.css`，必须显式 `import '@laoliangfe/annotation-overlay-<fw>/style.css'` |
| Angular demo 改了包却不生效 | `.angular/cache` 会缓存旧产物，需删除 `apps/demo-angular/.angular/cache` 后重启 |

## 📁 项目文件清单（节选）

```text
annotation-overlay-fe/
├── packages/
│   ├── core/src/
│   │   ├── engine/createCanvasEngine.ts   # 引擎主实现（生命周期、历史、导出）
│   │   ├── engine/createEventBus.ts       # 轻量事件总线
│   │   ├── engine/createToolManager.ts    # 工具注册表
│   │   ├── tools/createBaseTool.ts        # 工具契约 + ToolContext
│   │   ├── tools/create*Tool.ts           # 画笔/矩形/椭圆/箭头/折线/文字
│   │   ├── primitives/create*.ts          # Fabric 图形构造（坐标→对象）
│   │   ├── history/createHistoryManager.ts# 历史快照管理
│   │   ├── capture/domCapture.ts          # snapdom 截图
│   │   ├── controls/objectControls.ts     # 选中手柄样式
│   │   ├── config/defaults.ts             # 默认颜色/粗细/字号
│   │   ├── types/                         # 公共类型
│   │   └── utils/                         # 指针换算、几何、Fabric 辅助
│   ├── ui/src/
│   │   ├── data.ts                        # 工具与样式预设数据
│   │   ├── icons.ts                       # 图标几何数据（三端共用）
│   │   └── styles/{overlay,tokens}.css    # 组件结构与设计令牌
│   ├── vue/src/                           # AnnotationOverlay.vue + Toolbar/StylePanel/Icon
│   │   └── composables/useAnnotationEngine.ts
│   ├── react/src/                         # AnnotationOverlay.tsx + Toolbar/StylePanel/Icon
│   │   └── hooks/useAnnotationEngine.ts
│   └── angular/src/lib/                   # annotation-overlay/toolbar/style-panel/icon 组件
├── apps/
│   ├── demo-vue/       src/{App.vue,main.ts}（样式写在 SFC 内）
│   ├── demo-react/     src/{App.tsx,main.tsx,styles.css}
│   └── demo-angular/   src/app/app.component.ts, src/styles.css
├── scripts/
│   ├── build-pages.mjs   # 构建三个 demo → docs/ 并生成聚合首页
│   └── serve-docs.mjs    # 零依赖静态预览服务
├── turbo.json / pnpm-workspace.yaml
└── docs/                 # 生成物，勿手改
```
