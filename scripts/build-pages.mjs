/**
 * @file 构建 GitHub Pages 聚合演示站：三个 demo → docs/{vue,react,angular} + docs/index.html
 *
 * 执行流（顺序固定，任一步失败即整体失败）：
 * 1. 用 pnpm --filter 逐个构建 demo，构建脚本是各包里的 build:pages（相对 base）；
 * 2. 删掉旧的 docs/，重新创建，再把三个构建产物整目录拷进来；
 * 3. 用字符串模板生成聚合首页，Tab 切换三个 iframe，主题色随框架变化。
 *
 * 关键约束：
 * - demo 必须用 --base=./（即 build:pages 而非 build）构建。GitHub Pages 把站点
 *   挂在 /<repo>/ 子路径下，绝对 base 会让 JS/CSS 404，页面空白。
 * - docs/ 是生成物，页面结构写在本文件的模板字符串里；改界面要改模板再重建，
 *   直接编辑 docs/index.html 会在下次构建时被覆盖。
 * - Angular 的产物在 dist/browser 子目录（application builder 会把浏览器产物
 *   与 server 产物分开放），路径与其他两个 demo 不同。
 *
 * @see ./serve-docs.mjs 本地预览 docs/ 的零依赖静态服务器
 * @see ../package.json 的 build:pages / docs:build 脚本
 * @see ../docs/index.html 生成结果（不要直接编辑）
 */
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 仓库根目录：本文件在 scripts/ 下，故取其父级；不依赖 process.cwd()，任意目录执行都正确
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// 生成物输出目录，整体由本脚本删除重建
const docsDir = resolve(root, 'docs');

/**
 * 三个 demo 的构建与拷贝描述
 * 数组顺序即 Tab 顺序，也是「首个 iframe 默认 active」的依据（见 frames 生成处）。
 */
const demos = [
  {
    // pnpm --filter 使用的包名，必须与 apps/demo-vue/package.json 的 name 一致
    pkg: '@laoliangfe/annotation-overlay-demo-vue',
    // 构建产物目录（相对仓库根），vite 默认输出到 dist
    dir: 'apps/demo-vue/dist',
    // 拷进 docs 后的子目录名，同时是 URL 段与 data-target 标识
    name: 'vue',
    // Tab 按钮与页面标题上展示的框架名
    title: 'Vue 3',
    // 聚合页底部展示的 npm 包名，仅用于文案
    pkgName: '@laoliangfe/annotation-overlay-vue',
  },
  {
    pkg: '@laoliangfe/annotation-overlay-demo-react',
    dir: 'apps/demo-react/dist',
    name: 'react',
    title: 'React 18',
    pkgName: '@laoliangfe/annotation-overlay-react',
  },
  // Angular application builder 把浏览器产物放在 dist/browser 子目录
  {
    pkg: '@laoliangfe/annotation-overlay-demo-angular',
    dir: 'apps/demo-angular/dist/browser',
    name: 'angular',
    title: 'Angular 21',
    pkgName: '@laoliangfe/annotation-overlay-angular',
  },
];

/**
 * 同步执行子进程命令，失败即抛出（无重试、无降级）
 *
 * 用 spawnSync + shell:true 而不是 exec：输出可以直接继承到当前终端，
 * 构建进度不会被缓冲，出错时也能看到原始 stderr。
 *
 * @param cmd 可执行文件名，如 'pnpm'
 * @param args 参数数组，含空格的值必须作为独立元素传入
 * @param opts 覆盖默认选项的额外 spawn 配置，默认 {}
 * @returns 无返回值；失败时抛出 Error
 * 副作用：子进程继承 stdio，直接往当前终端写日志
 */
function run(cmd, args, opts = {}) {
  // shell:true 让 Windows 也能解析 pnpm.cmd；stdio:'inherit' 实时透传输出
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  // status 非 0 视为失败；null 表示被信号终止，同样按失败处理
  if (r.status !== 0) {
    throw new Error(`命令失败: ${cmd} ${args.join(' ')}`);
  }
}

// ---- 步骤 1：相对 base 构建（保证部署在子路径 /vue 等目录下可用） ----
for (const demo of demos) {
  // 先打分隔标题，三个 demo 的构建日志混在一起时便于定位
  console.log(`\n===== 构建 ${demo.title} demo =====`);
  // 调用各 demo 自己的 build:pages，而不是 build：只有前者带 --base=./
  run('pnpm', ['--filter', demo.pkg, 'run', 'build:pages']);
}

// ---- 步骤 2：组装 docs/ ----
console.log('\n===== 组合 Pages 站点 =====');
// 整个目录删除重建，避免上一次构建遗留的 hash 文件名/多余资源混进站点
if (existsSync(docsDir)) {
  rmSync(docsDir, { recursive: true, force: true });
}
mkdirSync(docsDir, { recursive: true });

for (const demo of demos) {
  // 解析为绝对路径，避免 cpSync 的相对路径受 cwd 影响
  const src = resolve(root, demo.dir);
  // 产物缺失通常意味着该 demo 的构建被跳过或改了输出目录，直接报错比生成残缺站点好
  if (!existsSync(src)) {
    throw new Error(`构建产物不存在: ${src}`);
  }
  // 递归拷贝：dist 下的 assets/ 与 index.html 整体搬到 docs/<name>/
  cpSync(src, resolve(docsDir, demo.name), { recursive: true });
}

// ---- 步骤 3：聚合首页 ----
// Tab 栏按钮：data-target 与 iframe 的 id 后缀（frame-<name>）一一对应
const tabs = demos
  .map(
    (d) =>
      `<button class="tab" type="button" data-target="${d.name}" role="tab"><span class="dot"></span>${d.title}</button>`,
  )
  // 缩进 6 空格，与模板里 <nav> 内部的排版对齐；仅影响生成的 HTML 缩进
  .join('\n      ');

// iframe：全部预先渲染，靠 .active 类切换显隐，避免切换时重新加载页面
// 注意：src 先放在 data-src 里，首次切到该 Tab 时才真正加载——
// 首屏默认展示「使用文档」，此时没必要把三个 demo 各 600KB 的包一起下载。
const frames = demos
  .map(
    (d) =>
      `<iframe class="frame" id="frame-${d.name}" data-src="./${d.name}/index.html" title="${d.title} demo"></iframe>`,
  )
  // 缩进 4 空格，与模板里 <main> 内部的排版对齐
  .join('\n    ');

// 切换脚本用的元数据：name 显示在「当前预览」与角标，pkg 显示在页脚
const meta = Object.fromEntries(
  demos.map((d) => [d.name, { name: d.title, pkg: d.pkgName }]),
);

/**
 * 聚合首页模板（生成物 docs/index.html 的唯一来源）
 *
 * 结构对照表，改样式时按块定位：
 * - 主题变量映射：body 上的 --accent / --accent-2 / --accent-soft / --grad，
 *   由 body[data-theme="vue|react|angular"] 三组规则覆盖，默认 Vue 绿；
 * - 顶部色条 .accent-bar：4px，取 --grad，切换时带 0.35s 过渡；
 * - Tab 栏：<nav class="tabs"> 内插入 ${tabs}，每个 .tab 自带 --c / --g 两个局部变量；
 * - iframe 区：<main> 内插入 ${frames}，绝对定位铺满，只有 .active 可见；
 * - 角标 .frame-badge：浮在 iframe 右上角，pointer-events:none 不挡点击；
 * - 切换脚本：文末 <script>，activate(name) 改 body[data-theme]、文案与 .active 类。
 *
 * 注意：以下内容会原样写进 docs/index.html，写注释必须用各自语法的注释
 *（HTML 用尖括号注释、CSS 与内联脚本用 CSS/JS 注释），否则会渲染到页面上。
 * 模板里不能出现反引号与美元符加花括号的组合，否则会破坏模板字符串。
 */
const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Annotation Overlay - 三框架在线演示</title>
  <style>
    /* ===== 基础重置 ===== */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #0f1115;
      color: #e6e8ee;
      /* 整页固定高度、不出滚动条：iframe 内部自己滚，外层只做容器 */
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;

      /* 主题色：由 body[data-theme] 切换 */
      --accent: #42b883;
      --accent-2: #2f9e72;
      --accent-soft: rgba(66, 184, 131, 0.13);
      --grad: linear-gradient(90deg, #42b883, #2f9e72);
    }
    /* ===== 主题变量映射：React ===== */
    body[data-theme="react"] {
      --accent: #149eca;
      --accent-2: #087ea4;
      --accent-soft: rgba(20, 158, 202, 0.13);
      --grad: linear-gradient(90deg, #149eca, #087ea4);
    }
    /* Angular 对齐官网品牌渐变：粉红 #F6377C → 紫 #8B3FFD */
    body[data-theme="angular"] {
      --accent: #a855f7;
      --accent-2: #8b3ffd;
      --accent-soft: rgba(168, 85, 247, 0.15);
      --grad: linear-gradient(90deg, #f6377c, #b33ae5 55%, #8b3ffd);
    }

    /* ===== 顶部主题色条 ===== */
    /* 顶部主题色条 */
    .accent-bar {
      flex: none;
      height: 4px;
      background: var(--grad);
      /* 切换框架时只过渡背景，不引起布局重排 */
      transition: background 0.35s ease;
    }

    /* ===== 页头：品牌 + 当前框架指示 + Tab 栏 ===== */
    header {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 13px 22px;
      border-bottom: 1px solid #23262e;
      /* 窄屏时 Tab 换行到第二行，而不是被压扁 */
      flex-wrap: wrap;
    }

    /* 品牌区：左侧方块图标 + 右侧两行文案 */
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      width: 34px;
      height: 34px;
      /* 禁止在窄屏下被压扁 */
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 10px;
      font-size: 16px;
      color: #fff;
      background: var(--grad);
      box-shadow: 0 8px 22px -8px var(--accent);
      transition: background 0.35s ease, box-shadow 0.35s ease;
    }
    /* 主标题：em 用主题色强调 Overlay 一词 */
    .brand h1 { font-size: 15px; font-weight: 650; letter-spacing: 0.2px; }
    .brand h1 em { font-style: normal; color: var(--accent); transition: color 0.35s ease; }
    .brand p { margin-top: 2px; font-size: 11.5px; color: #6f7789; }

    /* ===== 指示胶囊：边框与底色取主题变量，内部 .pulse 呼吸点强调「正在预览」 ===== */
    /* 当前框架指示 */
    .now {
      display: flex;
      align-items: center;
      gap: 8px;
      /* margin-left:auto 把它推到 Tab 栏右侧，形成「左品牌 / 右状态 + Tab」布局 */
      margin-left: auto;
      padding: 8px 15px 8px 12px;
      border: 1px solid var(--accent);
      border-radius: 999px;
      background: var(--accent-soft);
      font-size: 12.5px;
      transition: border-color 0.35s ease, background 0.35s ease;
    }
    /* 呼吸点：本体是实心圆，::after 向外扩散做 ping 动画 */
    .now .pulse {
      position: relative;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      transition: background 0.35s ease;
    }
    .now .pulse::after {
      content: "";
      position: absolute;
      /* inset 负值把外圈扩到 16×16，视觉上像光晕 */
      inset: -4px;
      border-radius: 50%;
      border: 1px solid var(--accent);
      opacity: 0;
      animation: ping 2s ease-out infinite;
    }
    @keyframes ping {
      0% { transform: scale(0.7); opacity: 0.9; }
      70%, 100% { transform: scale(1.6); opacity: 0; }
    }
    .now span { color: #8b93a5; }
    .now strong { color: var(--accent); font-weight: 650; transition: color 0.35s ease; }

    /* ===== Tab 栏 ===== */
    /* Tab */
    .tabs { display: flex; gap: 8px; }
    .tab {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border: 1px solid #2c3040;
      border-radius: 10px;
      background: transparent;
      color: #aab1c2;
      font-size: 13.5px;
      font-weight: 500;
      /* 继承 body 字体栈，避免 <button> 回落到系统默认字体 */
      font-family: inherit;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.2s, transform 0.2s;
    }
    /* 每个 Tab 用局部变量 --c/--g 记住自己的主题色，激活时无需逐条覆盖颜色 */
    .tab[data-target="vue"] {
      --c: #42b883;
      --g: linear-gradient(135deg, #42b883, #2f9e72);
    }
    .tab[data-target="react"] {
      --c: #149eca;
      --g: linear-gradient(135deg, #149eca, #087ea4);
    }
    /* Angular 用官网的粉 → 紫渐变 */
    .tab[data-target="angular"] {
      --c: #a855f7;
      --g: linear-gradient(135deg, #f6377c, #b33ae5 55%, #8b3ffd);
    }
    /* 「使用文档」入口：中性灰，避免与三个框架 Tab 抢注意力 */
    .tab[data-target="doc"] {
      --c: #6f7789;
      --g: linear-gradient(135deg, #3a3f52, #2a2e3d);
    }

    /* Tab 左侧小圆点：默认取该 Tab 自己的主题色 */
    .tab .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--c);
      transition: background 0.2s, box-shadow 0.2s;
    }
    .tab:hover {
      color: #fff;
      border-color: var(--c);
      background: rgba(255, 255, 255, 0.035);
      transform: translateY(-1px);
    }
    /* 激活态：渐变底 + 主题色投影，视觉上与下方 iframe 连成一体 */
    .tab.active {
      color: #fff;
      background: var(--g);
      border-color: var(--c);
      box-shadow: 0 10px 22px -10px var(--c);
    }
    .tab.active .dot { background: #fff; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3); }
    /* 指向下方内容区的小三角 */
    .tab.active::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: -8px;
      transform: translateX(-50%);
      /* 用透明边框拼三角形：上边框着色即得到一个朝下的小箭头 */
      border: 5px solid transparent;
      border-top-color: var(--c);
    }

    /* ===== 使用文档面板 ===== */
    /* 与 iframe 共用 main 的绝对定位区域；自己内部滚动，外层页面始终不出滚动条 */
    .doc {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      display: none;
      padding: 38px 24px 60px;
      background:
        radial-gradient(1100px 520px at 50% -8%, rgba(79, 107, 255, 0.13), transparent 62%),
        #0f1115;
    }
    .doc.active { display: block; animation: frameIn 0.3s ease both; }
    .doc-inner { max-width: 980px; margin: 0 auto; }

    /* 首屏 */
    .doc h2 { font-size: 32px; letter-spacing: -0.5px; line-height: 1.3; }
    .doc h2 em { font-style: normal; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .doc .lead { margin-top: 14px; max-width: 760px; font-size: 14.5px; line-height: 1.85; color: #9aa3b5; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .chip { padding: 4px 12px; border: 1px solid #2c3040; border-radius: 999px; font-size: 12px; color: #aab1c2; }
    .chip.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
    .cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    /* 基础按钮样式：同时用于 <a> 与 <button>，所以必须显式重置 UA 默认外观。
       <button> 的用户代理样式带 buttonface 背景（亮色主题下是白色），
       只写 border/color 会出现「白底浅灰字」，深色页面上完全看不清。
       因此 background / font-family / cursor 三项由本类统一兜底，
       具体配色（primary / ghost）由后面的修饰类覆盖。 */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 18px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      text-decoration: none;
      color: #fff;
      cursor: pointer;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s, background 0.2s;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary { background: var(--grad); box-shadow: 0 12px 26px -14px var(--accent); }
    .btn-ghost { border-color: #2c3040; color: #cdd3e0; }
    .btn-ghost:hover { border-color: var(--accent); background: rgba(255, 255, 255, 0.04); color: #fff; }

    /* 二级标题：左侧竖条取主题渐变 */
    .doc h3 {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 42px 0 16px;
      font-size: 17.5px;
      letter-spacing: 0.2px;
    }
    .doc h3::before {
      content: "";
      width: 3px;
      height: 15px;
      border-radius: 2px;
      background: var(--grad);
    }

    /* 特性卡：桌面四列，窄屏两列 / 一列 */
    .feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .feature {
      padding: 15px 16px;
      border: 1px solid #23262e;
      border-radius: 12px;
      background: #151821;
    }
    .feature b { display: block; margin-bottom: 6px; font-size: 13.5px; }
    .feature p { font-size: 12.5px; line-height: 1.7; color: #8b93a5; }

    /* 安装与代码示例：外层圆角框，内部二级 Tab 切框架 */
    .install { border: 1px solid #23262e; border-radius: 12px; overflow: hidden; background: #12151c; }
    .code-tabs { display: flex; gap: 2px; padding: 8px 10px 0; border-bottom: 1px solid #23262e; flex-wrap: wrap; }
    .code-tab {
      padding: 8px 14px;
      border: 0;
      border-radius: 8px 8px 0 0;
      background: transparent;
      color: #8b93a5;
      font-family: inherit;
      font-size: 12.5px;
      cursor: pointer;
    }
    .code-tab.active { color: #fff; background: #1b1f2a; }
    .code-tab:hover { color: #fff; }
    /* 代码块：横向可滚，避免长行把容器撑宽 */
    .install pre {
      margin: 0;
      padding: 16px 18px;
      overflow-x: auto;
      color: #d6dbe6;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12.5px;
      line-height: 1.75;
    }
    .install pre[data-lang] { display: none; }
    .install pre[data-lang].active { display: block; }

    /* API 表：窄屏横向滚动，不挤压文字 */
    .api-wrap { overflow-x: auto; border: 1px solid #23262e; border-radius: 12px; }
    table.api { width: 100%; border-collapse: collapse; font-size: 12.8px; }
    table.api th, table.api td { padding: 10px 14px; border-bottom: 1px solid #23262e; text-align: left; vertical-align: top; }
    table.api th { background: #151821; color: #8b93a5; font-weight: 600; white-space: nowrap; }
    table.api tr:last-child td { border-bottom: 0; }
    table.api td code, table.api td:first-child code {
      color: var(--accent);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }

    /* 提示条：用于「迁移」「注意」这类补充说明 */
    .note {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      padding: 12px 14px;
      border: 1px solid #2c3040;
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      background: #14171f;
      color: #9aa3b5;
      font-size: 12.8px;
      line-height: 1.75;
    }
    .note code { color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

    @media (max-width: 900px) {
      .feature-grid { grid-template-columns: repeat(2, 1fr); }
      .doc h2 { font-size: 26px; }
    }
    @media (max-width: 560px) {
      .doc { padding: 26px 16px 48px; }
      .feature-grid { grid-template-columns: 1fr; }
    }

    /* ===== iframe 容器与切换动画 ===== */
    /* main 用 flex:1 + min-height:0 吃掉剩余高度，否则 iframe 会把页面撑高 */
    main { flex: 1; position: relative; min-height: 0; }
    .frame {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      /* 去掉 iframe 默认边框，避免边缘出现一条灰线 */
      border: 0;
      /* 默认全部隐藏，靠 .active 控制显隐：切换时不重新加载文档 */
      display: none;
      background: #f5f7fb;
    }
    .frame.active { display: block; animation: frameIn 0.3s ease both; }
    @keyframes frameIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: none; }
    }

    /* ===== iframe 上的浮动框架标识（角标） ===== */
    /* iframe 上的浮动框架标识 */
    .frame-badge {
      position: absolute;
      top: 14px;
      right: 14px;
      /* 压在 iframe 之上；pointer-events:none 保证鼠标事件仍能落到演示页 */
      z-index: 2;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      border: 1px solid var(--accent);
      border-radius: 999px;
      background: rgba(15, 17, 21, 0.86);
      backdrop-filter: blur(8px);
      color: #fff;
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.2px;
      box-shadow: 0 10px 26px -12px rgba(0, 0, 0, 0.9);
      transition: border-color 0.35s ease;
    }
    .frame-badge .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      transition: background 0.35s ease;
    }
    .frame-badge b { color: var(--accent); transition: color 0.35s ease; }

    /* ===== 页脚 ===== */
    footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 20px;
      border-top: 1px solid #23262e;
      font-size: 11.5px;
      color: #6b7280;
      /* 窄屏时说明文字与链接换行，不重叠 */
      flex-wrap: wrap;
    }
    /* 包名用等宽字体，长度较长的 scope 包名更易辨认 */
    footer code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: var(--accent);
      transition: color 0.35s ease;
    }
    footer a { color: #8b93a5; text-decoration: none; }
    footer a:hover { color: #fff; }
  </style>
</head>
<!-- 默认主题为 vue：与脚本末尾 activate("vue") 保持一致，避免首帧闪色 -->
<body data-theme="vue">
  <!-- 顶部 4px 主题色条 -->
  <div class="accent-bar"></div>
  <!-- 页头：品牌 → 当前预览指示 → Tab 栏 -->
  <header>
    <div class="brand">
      <div class="brand-mark">◈</div>
      <div>
        <h1>Annotation <em>Overlay</em></h1>
        <p>同一核心 · 三框架组件</p>
      </div>
    </div>

    <!-- 当前预览指示：aria-live 让读屏软件在切换时播报新内容 -->
    <div class="now" aria-live="polite">
      <span class="pulse"></span>
      <span>当前预览</span>
      <strong id="now-name">使用文档</strong>
    </div>

    <!-- Tab 栏：「使用文档」固定在最前，其后由构建脚本按 demos 顺序注入三个框架 -->
    <nav class="tabs" role="tablist">
      <button class="tab active" type="button" data-target="doc" role="tab" aria-selected="true"><span class="dot"></span>使用文档</button>
      ${tabs}
    </nav>
  </header>

  <!-- 内容区：文档面板与三个 iframe 叠在同一位置，只显示 .active 的那个 -->
  <main>
    <!-- 使用文档：首屏默认展示，自身独立滚动（外层 body 不滚） -->
    <section class="doc active" id="panel-doc" role="tabpanel" aria-label="使用文档">
      <div class="doc-inner">
        <h2>网页截图标注组件<br /><em>一次编码，三端复用</em></h2>
        <p class="lead">
          对任意 DOM 元素截图并铺到画布上，直接在页面里圈画、写批注，一键导出带标注的 PNG。
          引擎与样式在构建时内联进每个框架包，Vue 3 / React 18 / Angular 21
          三端共用同一套能力与样式，只有组件外壳不同 —— 装一个包即可使用，无需额外依赖。
        </p>
        <div class="chips">
          <span class="chip on">Vue 3</span>
          <span class="chip on">React 18</span>
          <span class="chip on">Angular 21</span>
          <span class="chip">6 种标注工具</span>
          <span class="chip">撤销 / 重做</span>
          <span class="chip">高 DPI 清晰</span>
          <span class="chip">TypeScript</span>
        </div>
        <div class="cta">
          <button class="btn btn-primary" type="button" data-goto="vue">打开在线演示</button>
          <a class="btn btn-ghost" href="https://github.com/love2157dream/annotation-overlay" target="_blank" rel="noopener">GitHub</a>
          <a class="btn btn-ghost" href="https://www.npmjs.com/package/@laoliangfe/annotation-overlay-vue" target="_blank" rel="noopener">npm</a>
        </div>

        <h3>它能做什么</h3>
        <div class="feature-grid">
          <div class="feature">
            <b>截图即画布</b>
            <p>用 snapdom 把目标元素截成图，铺在 Fabric 画布下层，标注直接画在真实页面内容上。</p>
          </div>
          <div class="feature">
            <b>六种标注工具</b>
            <p>矩形、椭圆、箭头、折线、画笔、文字；可改颜色、线宽、字号，文字支持二次编辑。</p>
          </div>
          <div class="feature">
            <b>撤销 / 重做</b>
            <p>绘制、拖拽缩放、样式提交都会生成撤销点，历史基于 Fabric 对象快照实现。</p>
          </div>
          <div class="feature">
            <b>高分屏清晰</b>
            <p>按 devicePixelRatio 渲染位图，导出图与屏幕一致，不会出现“放大后发虚”。</p>
          </div>
        </div>

        <h3 id="install">安装与最小用法</h3>
        <div class="install">
          <div class="code-tabs" role="tablist">
            <button class="code-tab active" type="button" data-lang="vue">Vue 3</button>
            <button class="code-tab" type="button" data-lang="react">React 18</button>
            <button class="code-tab" type="button" data-lang="angular">Angular 21</button>
          </div>
          <pre data-lang="vue" class="active">npm i @laoliangfe/annotation-overlay-vue

&lt;script setup lang="ts"&gt;
import { ref } from 'vue';
import AnnotationOverlay from '@laoliangfe/annotation-overlay-vue';
import '@laoliangfe/annotation-overlay-vue/style.css';

const card = ref&lt;HTMLElement&gt;();
const overlay = ref&lt;InstanceType&lt;typeof AnnotationOverlay&gt;&gt;();

const open = () =&gt; overlay.value?.open(card.value!);
&lt;/script&gt;

&lt;template&gt;
  &lt;div ref="card"&gt;要标注的内容&lt;/div&gt;
  &lt;button @click="open"&gt;添加标注&lt;/button&gt;

  &lt;AnnotationOverlay
    ref="overlay"
    @confirm="(p) =&gt; p &amp;&amp; console.log(p.blob)"
  /&gt;
&lt;/template&gt;</pre>
          <pre data-lang="react">npm i @laoliangfe/annotation-overlay-react

import { useRef } from 'react';
import {
  AnnotationOverlay,
  type AnnotationOverlayRef,
} from '@laoliangfe/annotation-overlay-react';
import '@laoliangfe/annotation-overlay-react/style.css';

const card = useRef&lt;HTMLDivElement&gt;(null);
const overlay = useRef&lt;AnnotationOverlayRef&gt;(null);

&lt;div ref={card}&gt;要标注的内容&lt;/div&gt;
&lt;button onClick={() =&gt; overlay.current?.open(card.current!)}&gt;
  添加标注
&lt;/button&gt;

&lt;AnnotationOverlay
  ref={overlay}
  onConfirm={(p) =&gt; p &amp;&amp; console.log(p.blob)}
/&gt;</pre>
          <pre data-lang="angular">npm i @laoliangfe/annotation-overlay-angular

// 1. angular.json → build.options.styles 里加一行：
"node_modules/@laoliangfe/annotation-overlay-angular/style.css"

// 2. 组件 imports 中加入 AnnotationOverlayComponent，模板：
&lt;div #card&gt;要标注的内容&lt;/div&gt;
&lt;button (click)="overlay.open(card)"&gt;添加标注&lt;/button&gt;

&lt;annotation-overlay
  #overlay
  (confirm)="onConfirm($event)"
/&gt;</pre>
        </div>
        <div class="note">
          三端都必须显式引入 <code>style.css</code>：包构建会把 CSS 抽成独立文件并从 JS 移除，
          只引组件会出现「组件在、样式全丢」。
        </div>

        <h3>API 速查</h3>
        <div class="api-wrap">
          <table class="api">
            <thead>
              <tr><th>能力</th><th>Vue 3</th><th>React 18</th><th>Angular 21</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>打开并截取</td>
                <td><code>ref.open(el)</code></td>
                <td><code>ref.current.open(el)</code></td>
                <td><code>overlay.open(el)</code></td>
              </tr>
              <tr>
                <td>关闭并丢弃</td>
                <td><code>ref.close()</code></td>
                <td><code>ref.current.close()</code></td>
                <td><code>overlay.close()</code></td>
              </tr>
              <tr>
                <td>确认回调</td>
                <td><code>@confirm</code></td>
                <td><code>onConfirm</code></td>
                <td><code>(confirm)</code></td>
              </tr>
              <tr>
                <td>取消回调</td>
                <td><code>@cancel</code></td>
                <td><code>onCancel</code></td>
                <td><code>(cancel)</code></td>
              </tr>
              <tr>
                <td>截图前 / 后</td>
                <td><code>@beforeCapture</code> / <code>@afterCapture</code></td>
                <td><code>onBeforeCapture</code> / <code>onAfterCapture</code></td>
                <td><code>(beforeCapture)</code> / <code>(afterCapture)</code></td>
              </tr>
              <tr>
                <td>回调数据</td>
                <td colspan="3"><code>{ base64: string; blob: Blob }</code>，截图或导出失败时为 <code>null</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>包结构</h3>
        <div class="api-wrap">
          <table class="api">
            <thead>
              <tr><th>包</th><th>说明</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><code>@laoliangfe/annotation-overlay-vue</code></td>
                <td>Vue 3 组件</td>
              </tr>
              <tr>
                <td><code>@laoliangfe/annotation-overlay-react</code></td>
                <td>React 18 组件</td>
              </tr>
              <tr>
                <td><code>@laoliangfe/annotation-overlay-angular</code></td>
                <td>Angular 21 组件（standalone + signals，兼容 zoneless）</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="note">
          三个包都是「装一个即可用」：引擎（core）与样式（ui）是仓库内部包，构建时已内联进各自产物，
          不需要也不应该单独安装。
          旧包 <code>@laoliangfe/annotation-overlay</code>（1.x 单文件 Vue 组件）已冻结在 1.1.7，
          源码见 tag <code>v1.1.7</code>；新项目请用上表中的 <code>-vue</code> 包，
          API 与旧包完全一致，迁移只需改 import 路径并补一行 <code>style.css</code>。
        </div>

        <h3>在线演示</h3>
        <div class="cta">
          <button class="btn btn-ghost" type="button" data-goto="vue">Vue 3</button>
          <button class="btn btn-ghost" type="button" data-goto="react">React 18</button>
          <button class="btn btn-ghost" type="button" data-goto="angular">Angular 21</button>
        </div>
        <p class="lead" style="margin-top: 14px; font-size: 13px;">
          演示页里的“添加标注”按钮会打开覆盖层：先选工具再画，右上角可撤销 / 重做，确认后标注图显示在下方预览区。
        </p>
      </div>
    </section>

    ${frames}
    <!-- 浮动角标：叠在 iframe 右上角，名称随当前 Tab 更新 -->
    <div class="frame-badge"><span class="dot"></span><b id="badge-name">Vue 3</b>&nbsp;演示</div>
  </main>

  <!-- 页脚：组件库简述 + 当前框架对应的 npm 包名 + 源码地址 -->
  <footer>
    <span>基于 Fabric.js 的网页截图标注组件库</span>
    <code id="footer-pkg">3 个包 · 统一版本</code>
    <a href="https://github.com/love2157dream/annotation-overlay" target="_blank" rel="noopener">GitHub</a>
  </footer>

  <script>
    /* ===== 切换逻辑 ===== */
    /* 元数据由构建脚本 JSON.stringify 注入，形如 { vue: { name, pkg }, ... } */
    var META = ${JSON.stringify(meta)};
    /* 一次性取好节点列表，避免每次切换都重新查询 DOM */
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    var frames = Array.prototype.slice.call(document.querySelectorAll(".frame"));
    var docPanel = document.getElementById("panel-doc");
    var badge = document.querySelector(".frame-badge");

    /**
     * 激活某个视图：文档面板 或 某个框架的演示
     * @param {string} name "doc" 或框架标识 vue / react / angular
     */
    function activate(name) {
      /* 未知标识直接忽略，防止 data-target 写错时把页面切成空白 */
      var isDoc = name === "doc";
      if (!isDoc && !META[name]) return;

      if (isDoc) {
        /* 文档视图不换主题：保留上次的框架配色，从文档点进演示时不会闪一下 */
        document.getElementById("now-name").textContent = "使用文档";
        document.getElementById("footer-pkg").textContent = "3 个包 · 统一版本";
      } else {
        /* 1. 换主题：所有颜色都挂在 body 的 CSS 变量上，改一个属性即可整站换色 */
        document.body.dataset.theme = name;
        /* 2. 同步「当前预览」与右上角角标 */
        document.getElementById("now-name").textContent = META[name].name;
        document.getElementById("badge-name").textContent = META[name].name;
        /* 3. 页脚包名跟着换，方便直接复制对应框架的包名 */
        document.getElementById("footer-pkg").textContent = META[name].pkg;
      }

      /* 4. Tab 的激活态与 aria-selected 一起改，保证可访问性与视觉一致 */
      tabs.forEach(function (t) {
        var on = t.dataset.target === name;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });

      /* 5. 文档面板与演示区互斥显示；角标只在演示视图里出现 */
      docPanel.classList.toggle("active", isDoc);
      badge.style.display = isDoc ? "none" : "flex";

      /* 6. iframe 用 display 切换显隐，不换 src：切回来时演示页状态还在。
             src 采用懒加载——首次显示时才从 data-src 赋值，首屏不为三个 demo 付下载成本 */
      frames.forEach(function (f) {
        var on = !isDoc && f.id === "frame-" + name;
        if (on && !f.getAttribute("src")) f.src = f.dataset.src;
        f.classList.toggle("active", on);
      });
    }

    /* 顶栏 Tab：文档 + 三个框架共用一套逻辑 */
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        activate(t.dataset.target);
      });
    });

    /* 文档正文里的「打开在线演示 / Vue / React / Angular」按钮 */
    Array.prototype.forEach.call(document.querySelectorAll("[data-goto]"), function (el) {
      el.addEventListener("click", function () {
        activate(el.dataset.goto);
      });
    });

    /* 代码示例的二级 Tab：只切 pre 的显隐，不影响主题色 */
    var codeTabs = Array.prototype.slice.call(document.querySelectorAll(".code-tab"));
    codeTabs.forEach(function (t) {
      t.addEventListener("click", function () {
        codeTabs.forEach(function (x) {
          x.classList.toggle("active", x === t);
        });
        Array.prototype.forEach.call(
          document.querySelectorAll(".install pre[data-lang]"),
          function (p) {
            p.classList.toggle("active", p.dataset.lang === t.dataset.lang);
          },
        );
      });
    });

    /* 首屏默认展示使用文档；body 上预设 data-theme="vue" 作为文档视图的配色基调 */
    activate("doc");
  </script>
</body>
</html>
`;

// 写入聚合首页；编码固定 utf8，避免 Windows 下默认编码导致中文乱码
writeFileSync(resolve(docsDir, 'index.html'), indexHtml, 'utf8');

/**
 * .nojekyll：告诉 GitHub Pages 不要用 Jekyll 处理站点。
 * 不加的话，以下划线开头的文件/目录会被 Jekyll 忽略，某些构建产物会 404；
 * 空文件即可，必须与 index.html 一起提交。
 */
writeFileSync(resolve(docsDir, '.nojekyll'), '', 'utf8');

// 成功提示：顺带把预览命令写出来，省去翻 README
console.log(`\n✅ Pages 站点已生成: ${docsDir}`);
console.log('   本地预览: pnpm docs:preview  （或部署到 GitHub Pages）');
