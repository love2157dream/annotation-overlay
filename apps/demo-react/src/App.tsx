/**
 * @file React 18 演示页：仿 React 官网风格的迷你首页，作为标注覆盖层的靶场
 *
 * 页面结构（与 demo-vue / demo-angular 保持一致）：
 * 1. 上方 .content-area（ref=targetRef）——待标注区域，覆盖层按它的
 *    getBoundingClientRect() 决定画布尺寸，所以必须完整落在视口内；
 * 2. 下方 .preview-area —— 确认后回填导出的 base64 图片；
 * 3. <AnnotationOverlay> —— 覆盖层本体，常驻挂载、默认隐藏，靠 ref 命令式打开；
 * 4. .open-btn —— 右下角固定按钮，触发 open(targetRef.current)。
 *
 * 注意：
 * - 页面样式在 ./styles.css（由 main.tsx 引入），本文件只有结构；
 *   组件库样式必须由 main.tsx 显式 `import '.../style.css'`，漏引则工具条无样式。
 * - 内容高度被刻意压缩，styles.css 里还有 @media (max-height: 800px) 收紧间距，
 *   目标元素一旦超出视口，截图会被裁掉超出部分。
 *
 * @see ./main.tsx 入口（挂载 + 引入两份样式）
 * @see ../../demo-vue/src/App.vue 同一套页面的 Vue 实现
 * @see ../../demo-angular/src/app/app.component.ts 同一套页面的 Angular 实现
 */
import React, { useRef, useState } from 'react';
import { AnnotationOverlay, type AnnotationOverlayRef, type ConfirmPayload } from '@laoliangfe/annotation-overlay-react';

/** 参考 React 官网首页的三个核心卖点 */
const FEATURES = [
  { icon: '⚛️', title: '声明式', desc: '只描述界面应有的样子，状态变化时 React 负责高效更新 DOM。' },
  { icon: '🧱', title: '组件化', desc: '用可组合、可复用的组件搭建界面，逻辑与视图一起维护。' },
  { icon: '🌍', title: '跨平台', desc: 'React DOM 写 Web，React Native 写原生，心智模型保持一致。' },
];

/** 周边生态 */
const ECOSYSTEM = ['Next.js', 'React Router', 'Redux', 'React Native', 'Expo'];

/**
 * 演示页根组件
 *
 * 自身不接收任何 props，状态全部内聚：
 * - targetRef：指向待标注的 DOM 节点，openAnnotation 时读取 .current；
 * - annoRef：覆盖层的命令式句柄（open / close），由 forwardRef +
 *   useImperativeHandle 暴露，因此必须显式声明泛型 AnnotationOverlayRef；
 * - previewImg：确认后用 setState 触发预览区重渲染。
 *
 * @returns 整个演示页的 JSX 树
 */
const App: React.FC = () => {
  /**
   * 覆盖层句柄
   * 挂的是组件实例（不是 DOM）：组件用 forwardRef 暴露 { open, close }，
   * 初次渲染时为 null，所以调用处统一写 annoRef.current?.open(...)。
   */
  const annoRef = useRef<AnnotationOverlayRef>(null);
  /**
   * 待标注区域的 DOM 节点
   * 挂到 .content-area 这个 div 上；useRef 只负责持有引用，不触发重渲染，
   * 因此把它传给组件不会造成额外渲染。
   */
  const targetRef = useRef<HTMLDivElement>(null);
  /**
   * 标注结果图（PNG dataURL）
   * 初始为空串（假值），用于在预览区做三元判断；确认后写入。
   */
  const [previewImg, setPreviewImg] = useState('');

  /**
   * 打开覆盖层
   *
   * 先判空再调用：targetRef.current 在首次渲染前为 null，
   * 把它传给 open() 会在内部取 getBoundingClientRect 时抛错。
   *
   * @returns 无返回值；open() 返回 Promise，这里不 await
   * 副作用：覆盖层显示、开始截图，页面交互被覆盖层接管
   * @example
   * // <button onClick={openAnnotation}>添加标注</button>
   */
  const openAnnotation = () => {
    if (targetRef.current) {
      annoRef.current?.open(targetRef.current);
    }
  };

  /**
   * 确认回调
   *
   * @param payload 导出结果；null 表示截图或导出失败，此时忽略并保留旧预览
   * @returns 无返回值
   * 副作用：setPreviewImg 触发重渲染，把图片渲染到预览区
   */
  const handleConfirm = (payload: ConfirmPayload | null) => {
    if (!payload) {
      console.log('⚠️ 未进行任何标注');
      return;
    }
    // 把导出的标注图显示在下方预览区
    setPreviewImg(payload.base64);
    console.log('✅ 确认标注:', payload);
  };

  /**
   * 取消回调（点取消或按 Esc 触发）
   *
   * @returns 无返回值
   * 副作用：仅打日志；不清空 previewImg，便于与上一次结果对比
   */
  const handleCancel = () => {
    console.log('❌ 取消标注');
  };

  return (
    <div className="app-container">
      {/* 待标注区域：占据主要面积，标注时画布与它等大 */}
      <div className="content-area" ref={targetRef}>
        {/* Hero：左文案 + 右图标，静态内容，仅作为截图素材 */}
        <div className="hero">
          <div className="hero-main">
            {/* eyebrow：全大写小号引导语，颜色取品牌色 */}
            <p className="hero-eyebrow">The Library for Web and Native UI</p>
            {/* 主标题 + 框架胶囊，胶囊用于区分三个 demo */}
            <h2>用于构建用户界面的 JavaScript 库 <span className="fw-tag">React 18</span></h2>
            {/* 简介：max-width 620px 约束行长（见 styles.css） */}
            <p className="hero-desc">
              声明式、组件化，一次学习、随处编写 —— 同一套心智模型既能构建 Web 页面，也能构建原生应用。
            </p>
            {/* 按钮组：无 onClick，纯装饰；不允许换行，避免工具条打开后被压缩断行 */}
            <div className="hero-actions">
              <button type="button" className="btn-primary">快速开始</button>
              <button type="button" className="btn-ghost">API 参考</button>
            </div>
          </div>
          {/* 右侧图标：色块 + 单字母，替代真实 logo 以避开版权素材 */}
          <div className="hero-logo">R</div>
        </div>

        {/* 特性卡：FEATURES 为静态常量，用 title 作 key（唯一且稳定） */}
        <div className="feature-grid">
          {FEATURES.map(item => (
            <div className="feature" key={item.title}>
              <span className="feature-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 生态标签：名称本身唯一，可直接作 key */}
        <div className="eco">
          <span className="eco-label">生态</span>
          {ECOSYSTEM.map(name => (
            <span className="chip" key={name}>{name}</span>
          ))}
        </div>
      </div>

      {/* 标注预览：确认后把导出的图片显示在这里 */}
      <div className="content-area preview-area">
        <h2>标注预览</h2>
        {/* 有图渲染 img，无图渲染占位提示，避免预览区塌成空白 */}
        {previewImg ? (
          <img src={previewImg} alt="标注结果" />
        ) : (
          <p className="preview-empty">点击右下角「添加标注」，完成后标注结果会显示在这里</p>
        )}
      </div>

      {/* 覆盖层：ref 拿命令式句柄，确认/取消通过回调向外抛 */}
      <AnnotationOverlay
        ref={annoRef}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* 唯一入口按钮：目标元素在 openAnnotation 内部解析 */}
      <button className="open-btn" onClick={openAnnotation}>✏️ 添加标注</button>
    </div>
  );
};

export default App;
