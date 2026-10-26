#!/usr/bin/env node
/**
 * @file 本地预览 docs/ 聚合演示站（零依赖，只用 Node 内置模块）
 *
 * 用法：
 *   pnpm docs                # http://localhost:4173 ，并自动打开浏览器
 *   pnpm docs --port 8080    # 指定端口（默认 4173，被占用时自动 +1）
 *   pnpm docs --no-open      # 不自动打开浏览器
 *
 * 说明：
 *   docs/ 由 `pnpm build:pages` 生成（三个 demo 构建产物 + 聚合首页）。
 *   本脚本只做静态托管，不会重新构建。
 *
 * 能力与边界：
 * - 端口被占用时从起始端口逐次 +1，最多尝试 20 次；
 * - 响应头带 no-cache，避免「改了产物刷新还是旧页面」；
 * - 按扩展名给 Content-Type，并给出 Content-Length（iframe 与字体加载更稳）；
 * - 对 URL 做 decode + normalize 后校验前缀，阻断 ../ 目录穿越；
 * - 启动时比较 docs/index.html 与 packages/*、apps/* 下各包的 src 目录 mtime，
 *   产物落后于源码时打印提示（只是提示，不会自动重建）。
 *
 * 注意：脚本名与 pnpm 内置的 `pnpm docs` 命令冲突，裸执行可能被内置命令截获，
 * 报 `required arguments not provided: <PACKAGE>`。请用 `pnpm docs:preview`
 * 或 `pnpm run docs`，二者都会走到本文件。
 *
 * @see ./build-pages.mjs 生成 docs/ 的构建脚本
 * @see ../package.json 的 docs / docs:preview / docs:build 脚本
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// 仓库根目录：本文件位于 scripts/ 下，取父级；与 cwd 无关，任意目录执行都正确
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// 静态托管根目录：所有请求路径都会与它做前缀校验，防止越界读文件
const docsDir = resolve(root, 'docs');

/* ---------------------------------- 参数 ---------------------------------- */

// 去掉 node 可执行文件与脚本路径，只保留用户传入的参数
const argv = process.argv.slice(2);

/**
 * 从参数列表里取值，同时支持 `--flag value` 与 `--flag=value` 两种写法
 *
 * 逐项扫描而不是用正则拼接，避免值里含空格或等号时被截断。
 *
 * @param flags 候选参数名数组，如 ['--port', '-p']
 * @returns 找到的第一个值；未传该参数或后面没有值时返回 undefined
 * @example
 * // node serve-docs.mjs --port 8080   → '8080'
 * // node serve-docs.mjs --port=8080  → '8080'
 * // node serve-docs.mjs              → undefined
 */
function getArgValue(flags) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    for (const flag of flags) {
      // 形式一：--flag value，要求下一个参数存在，否则视为未传值
      if (arg === flag && argv[i + 1]) return argv[i + 1];
      // 形式二：--flag=value，直接切掉前缀
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

// 是否自动开浏览器：默认开，--no-open 或 -O 关闭（CI、远程桌面下常用）
const shouldOpen = !argv.includes('--no-open') && !argv.includes('-O');
// 起始端口：--port/-p 优先，其次环境变量 PORT，最后回落到 4173
const startPort = Number(
  getArgValue(['--port', '-p']) ?? process.env.PORT ?? 4173,
);

/* --------------------------------- 工具函数 -------------------------------- */

/**
 * 扩展名 → Content-Type 映射（键统一小写，含前导点）
 *
 * 缺省回落到 application/octet-stream，浏览器会当下载处理；
 * 新增资源类型（如 .mp3、.pdf）时在这里补一行即可。
 */
const MIME = {
  '.html': 'text/html; charset=utf-8', // 聚合页与各 demo 的 index.html
  '.htm': 'text/html; charset=utf-8', // 旧式扩展名，保持兼容
  '.js': 'text/javascript; charset=utf-8', // Vite/Angular 产物
  '.mjs': 'text/javascript; charset=utf-8', // 少数 ESM 产物会是 .mjs
  '.css': 'text/css; charset=utf-8', // 抽取出的组件样式
  '.json': 'application/json; charset=utf-8', // sourcemap 索引等
  '.map': 'application/json; charset=utf-8', // 构建产物里的 sourcemap
  '.svg': 'image/svg+xml', // 图标（工具栏图标是内联 SVG，多为兜底）
  '.png': 'image/png', // 截图/示例图
  '.jpg': 'image/jpeg', // 位图兜底
  '.jpeg': 'image/jpeg', // 同上
  '.gif': 'image/gif', // 动图
  '.webp': 'image/webp', // 现代位图格式
  '.avif': 'image/avif', // 更高压缩率的位图格式
  '.ico': 'image/x-icon', // favicon
  '.woff': 'font/woff', // 字体（旧格式）
  '.woff2': 'font/woff2', // 字体（主用格式）
  '.ttf': 'font/ttf', // 字体兜底
  '.otf': 'font/otf', // 字体兜底
  '.txt': 'text/plain; charset=utf-8', // 纯文本，404 提示等
  '.wasm': 'application/wasm', // WASM 模块
  '.mp4': 'video/mp4', // 演示视频
  '.webm': 'video/webm', // 演示视频（WebM）
};

/**
 * 用系统默认浏览器打开 URL（尽力而为，失败不影响服务器运行）
 *
 * 三个平台各一条命令，进程全部 detach + unref：浏览器独立存活，
 * 不阻塞当前进程退出（Ctrl+C 停服务器时不会连带关掉浏览器）。
 *
 * @param url 完整地址，如 http://localhost:4173/
 * @returns 无返回值
 * 副作用：启动一个外部进程；异常被吞掉（URL 已打印在终端，用户可手动点开）
 */
function openBrowser(url) {
  // detached + stdio:ignore：让浏览器脱离当前进程组，且不占用管道
  const opts = { detached: true, stdio: 'ignore' };
  try {
    if (process.platform === 'win32') {
      // `start "" <url>`：空的第一个参数是窗口标题，必须保留，否则 URL 会被当成标题
      spawn('cmd.exe', ['/c', 'start', '""', url], {
        ...opts,
        // 关闭参数自动加引号，保证 `""` 原样传给 cmd，start 才不会误判
        windowsVerbatimArguments: true,
      }).unref();
    } else if (process.platform === 'darwin') {
      // macOS 用 open
      spawn('open', [url], opts).unref();
    } else {
      // Linux/其他类 Unix 用 xdg-open（未安装时会抛 ENOENT，由外层 catch 兜住）
      spawn('xdg-open', [url], opts).unref();
    }
  } catch {
    /* 打不开就算了，URL 已打印 */
  }
}

/**
 * 取目录内（递归）最新文件时间，用于粗略判断 docs 产物是否过期
 *
 * 用于「产物是否过期」的粗判：不区分文件类型，也不看 git 状态，
 * 只要源码目录里有比 docs/index.html 更新的文件就认为需要重建。
 *
 * @param dir 起始目录（绝对路径）
 * @returns 最新 mtime 的毫秒值；目录为空或不可读时返回 0
 * 副作用：同步遍历文件系统，仅启动时调用一次，可接受阻塞
 */
function newestMtime(dir) {
  // 0 作为哨兵：任何真实 mtime 都大于它
  let newest = 0;
  // 内部递归函数：先收集条目，再按目录/文件分流
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      // 目录不存在或没有权限：跳过这一层，不影响其他目录
      return;
    }
    for (const entry of entries) {
      // 跳过体积大且与源码无关的目录：node_modules 极慢，其余是构建缓存
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.angular' ||
        entry.name === '.turbo'
      ) {
        continue;
      }
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        try {
          const mtime = statSync(full).mtimeMs;
          // 保留最大值，遍历完即得整棵树的最新时间
          if (mtime > newest) newest = mtime;
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(dir);
  return newest;
}

/**
 * 判断 docs 产物是否早于最新源码
 *
 * 以 docs/index.html 的 mtime 作为「构建时间」基准（它是构建脚本最后写入的文件），
 * 与 packages/ * /src、apps/ * /src 的最新 mtime 比较。
 *
 * @returns true 表示源码更新过、产物可能过期；false 表示无法判断或产物最新
 * 副作用：无（只读文件系统）；调用失败由外层启动流程决定是否提示
 * @example
 * // 启动时：if (checkStale()) console.log('请先 pnpm build:pages')
 */
function checkStale() {
  // 用聚合首页当时间戳锚点：它由 build-pages.mjs 在最后一步写出
  const stamp = resolve(docsDir, 'index.html');
  // 没有产物就谈不上「过期」，交给启动流程报「未构建」
  if (!existsSync(stamp)) return false;
  const builtAt = statSync(stamp).mtimeMs;
  // 待监视的源码目录：各包的 src 与各 demo 的 src（不含配置和文档）
  const watchDirs = [
    ...readdirSync(resolve(root, 'packages'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => resolve(root, 'packages', d.name, 'src')),
    ...readdirSync(resolve(root, 'apps'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => resolve(root, 'apps', d.name, 'src')),
  ];
  // 任一目录比构建时间新即视为过期；目录不存在（新包还没建 src）直接跳过
  return watchDirs.some((dir) => existsSync(dir) && newestMtime(dir) > builtAt);
}

/* --------------------------------- 请求处理 -------------------------------- */

/**
 * 输出 404 纯文本响应
 *
 * @param res Node 的响应对象
 * @param message 返回体内容；通常直接写原因或路径
 * @returns 无返回值
 * 副作用：结束响应流
 */
function notFound(res, message) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

/**
 * 处理单个静态资源请求
 *
 * 流程：解码 URL → 安全校验 → 目录补 index.html → 存在性检查 → 带缓存头输出。
 *
 * @param req Node 的请求对象，只用到 req.url
 * @param res Node 的响应对象
 * @returns 无返回值；文件内容通过流式管道写出
 * 副作用：读文件系统、写响应；异常向上抛给调用方的 try/catch
 */
function handle(req, res) {
  let pathname;
  try {
    // decodeURIComponent：支持中文/空格文件名；new URL 顺带剥掉 query 与 hash
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    // 非法百分号编码会抛 URIError，按 400 处理而不是 500
    return notFound(res, '400 Bad Request');
  }

  // 防目录穿越：解析后必须仍在 docsDir 内
  let filePath = normalize(join(docsDir, pathname));
  // 前缀比较加上分隔符，避免 /docs-other 这类同前缀目录被误放行
  if (filePath !== docsDir && !filePath.startsWith(docsDir + sep)) {
    return notFound(res, '403 Forbidden');
  }

  // 请求的是目录（如 /vue/）时补 index.html，模拟常见静态服务器的行为
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  // 不存在或不是普通文件：给出可操作的提示，而不是裸 404
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return notFound(res, `404 Not Found: ${pathname}\n\n请确认是否已执行 pnpm build:pages`);
  }

  // 取一次 stat：size 用于 Content-Length，避免再次系统调用
  const stat = statSync(filePath);
  res.writeHead(200, {
    // 未知扩展名回落 octet-stream，浏览器会下载而不是尝试渲染
    'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    // 显式长度：让浏览器能显示进度，也避免 chunked 传输的部分兼容问题
    'Content-Length': stat.size,
    // 禁用强缓存：重建产物后普通刷新即可看到新内容
    'Cache-Control': 'no-cache',
  });
  // 流式输出，大文件（截图 PNG、视频）不会一次性读进内存
  createReadStream(filePath).pipe(res);
}

/* ---------------------------------- 启动 ---------------------------------- */

// 没有聚合首页说明从未构建过，直接退出并给出命令，比起一个全 404 的服务器友好
if (!existsSync(resolve(docsDir, 'index.html'))) {
  console.error('\n✗ 未找到 docs/index.html');
  console.error('  请先执行: pnpm build:pages\n');
  process.exit(1);
}

// 包一层统一异常出口：单次请求出错只返回 500，不拖垮整个进程
const server = createServer((req, res) => {
  try {
    handle(req, res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`500 Internal Server Error\n\n${err?.message ?? err}`);
  }
});

// 当前尝试的端口；端口冲突时会在此基础上递增
let port = startPort;

/**
 * 启动并监听端口，遇到 EADDRINUSE 时顺延端口重试
 *
 * 用 server.once 而不是 on：每次 listen 前重新挂一个一次性监听，
 * 避免多次重试后同一个错误被多个处理器重复响应。
 *
 * @returns 无返回值
 * 副作用：占用本地端口、打印访问地址、按需启动浏览器、可能调用 process.exit(1)
 */
function listen() {
  server.once('error', (err) => {
    // 端口被占用且还在容错窗口内（起始端口 + 20）→ 顺延一个端口重试
    if (err.code === 'EADDRINUSE' && port < startPort + 20) {
      port += 1;
      listen();
    } else {
      // 其它错误（权限不足、地址不可用）或重试次数耗尽：直接退出
      console.error(`\n✗ 启动失败: ${err.message}\n`);
      process.exit(1);
    }
  });
  // 只监听回环地址：默认不对外暴露，避免把本地预览变成局域网服务
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/`;
    console.log('\n  Annotation Overlay · docs 预览');
    console.log(`  ➜ 本地:   ${url}`);
    // 三个 demo 的直达地址，省去在聚合页里点 Tab
    console.log(`  ➜ Vue:    ${url}vue/`);
    console.log(`  ➜ React:  ${url}react/`);
    console.log(`  ➜ Angular:${url}angular/`);
    // 产物过期提示（仅启动时检查一次，不监听文件变化）
    if (checkStale()) {
      console.log('\n  ⚠ docs 产物可能早于最新源码，如需更新请执行: pnpm build:pages');
    }
    console.log('\n  按 Ctrl+C 停止\n');
    // 最后再开浏览器：确保端口已经就绪，避免打开时连接被拒
    if (shouldOpen) openBrowser(url);
  });
}

listen();
