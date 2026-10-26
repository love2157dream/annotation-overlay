/**
 * @file Angular 21 演示页：仿 Angular 官网风格的迷你首页，作为标注覆盖层的靶场
 *
 * 页面结构（与 demo-vue / demo-react 保持一致）：
 * 1. 上方 .content-area（模板引用变量 #target）——待标注区域，覆盖层按它的
 *    getBoundingClientRect() 决定画布尺寸，所以必须完整落在视口内；
 * 2. 下方 .preview-area —— 确认后回填导出的 base64 图片；
 * 3. <annotation-overlay> —— 覆盖层组件，常驻挂载、默认隐藏，靠 #anno 引用打开；
 * 4. .open-btn —— 右下角固定按钮，触发 openAnnotation()。
 *
 * 注意：
 * - 模板与样式分离：页面样式在 src/styles.css（由 angular.json 的 styles 注入），
 *   组件本身没有 styles 段。
 * - `encapsulation: ViewEncapsulation.None` 是刻意的：模板用的是全局类名，
 *   若保留默认的 Emulated 封装，选择器会被加上 _ngcontent 属性而命中不到
 *   styles.css 里的规则，页面会「裸奔」。
 * - 内容高度被刻意压缩（styles.css 另有 max-height 媒体查询），目标元素一旦
 *   超出视口，截图就会缺一块。
 *
 * @see ./main.ts 启动入口（zoneless 变更检测）
 * @see ../styles.css 页面样式
 * @see ../../../demo-react/src/App.tsx 同一套页面的 React 实现
 */
import { Component, ElementRef, ViewEncapsulation, signal, viewChild } from '@angular/core';
// 组件与公共类型同源：Angular 包已重新导出 core 的类型，无需安装内部包
import { AnnotationOverlayComponent, type ConfirmPayload } from '@laoliangfe/annotation-overlay-angular';

/**
 * 演示页根组件（standalone）
 *
 * 状态全部内聚，不接收任何 @Input：
 * - targetRef：待标注元素，openAnnotation 时取 .nativeElement；
 * - annoRef：覆盖层组件实例，调用其 open(el) 方法；
 * - previewImg：signal，确认后 set 触发模板重渲染。
 */
@Component({
  // 与 index.html 中的 <app-root> 对应
  selector: 'app-root',
  // 关闭样式封装：模板依赖 src/styles.css 的全局类名，详见文件头说明
  encapsulation: ViewEncapsulation.None,
  // standalone 组件需要显式声明模板里用到的其它组件
  imports: [AnnotationOverlayComponent],
  template: `
    <!-- 页面根容器：纵向 flex，顶部 4px 品牌色条由 ::before 绘制 -->
    <div class="app-container">
      <!-- 待标注区域：占据主要面积，标注时画布与它等大 -->
      <div class="content-area" #target>
        <!-- Hero：左文案 + 右图标，静态内容，仅作为截图素材 -->
        <div class="hero">
          <div class="hero-main">
            <!-- eyebrow：全大写小号引导语，颜色取品牌色 -->
            <p class="hero-eyebrow">The Web Framework for the Future</p>
            <!-- 主标题 + 框架胶囊，胶囊用于区分三个 demo -->
            <h2>面向未来的 Web 开发框架 <span class="fw-tag">Angular 21</span></h2>
            <!-- 简介：max-width 620px 约束行长（见 styles.css） -->
            <p class="hero-desc">
              路由、表单、HTTP、依赖注入全部内置，TypeScript 优先 —— 让团队把精力放在业务，而不是拼装技术栈。
            </p>
            <!-- 按钮组：无事件绑定，纯装饰；不允许换行（样式里已禁用收缩） -->
            <div class="hero-actions">
              <button type="button" class="btn-primary">立即上手</button>
              <button type="button" class="btn-ghost">查看教程</button>
            </div>
          </div>
          <!-- 右侧图标：色块 + 单字母，替代真实 logo 以避开版权素材 -->
          <div class="hero-logo">A</div>
        </div>

        <!-- 特性卡：@for 需要 track 表达式；title 唯一且稳定，直接用作标识 -->
        <div class="feature-grid">
          @for (item of features; track item.title) {
            <div class="feature">
              <span class="feature-icon">{{ item.icon }}</span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
            </div>
          }
        </div>

        <!-- 生态标签：name 本身唯一，可作为 track 标识 -->
        <div class="eco">
          <span class="eco-label">生态</span>
          @for (name of ecosystem; track name) {
            <span class="chip">{{ name }}</span>
          }
        </div>
      </div>

      <!-- 标注预览：确认后把导出的图片显示在这里 -->
      <div class="content-area preview-area">
        <h2>标注预览</h2>
        <!-- signal 在模板中按函数调用读取；有值渲染图片，无值渲染占位 -->
        @if (previewImg()) {
          <img [src]="previewImg()" alt="标注结果" />
        } @else {
          <p class="preview-empty">点击右下角「添加标注」，完成后标注结果会显示在这里</p>
        }
      </div>

      <!-- 覆盖层：#anno 拿到组件实例；confirm 带 payload，cancel 无参数 -->
      <annotation-overlay #anno (confirm)="handleConfirm($event)" (cancel)="handleCancel()" />

      <!-- 唯一入口按钮：目标元素在 openAnnotation 内部解析 -->
      <button type="button" class="open-btn" (click)="openAnnotation()">✏️ 添加标注</button>
    </div>
  `,
})
export class AppComponent {
  /**
   * 覆盖层组件实例
   * viewChild.required 在视图初始化后返回 signal，读取时必然有值（找不到会抛错），
   * 所以调用处不需要像 Vue/React 那样判空。
   */
  readonly annoRef = viewChild.required<AnnotationOverlayComponent>('anno');
  /**
   * 待标注元素（模板里的 #target）
   * 包一层 ElementRef，取值用 .nativeElement 拿到真实 DOM 节点。
   */
  readonly targetRef = viewChild.required<ElementRef<HTMLElement>>('target');

  /** 确认后的标注图（base64），显示在预览区 */
  readonly previewImg = signal('');

  /** 参考 Angular 官网首页的三个核心卖点 */
  readonly features = [
    { icon: '🛡️', title: '开箱即用', desc: '路由、表单、HTTP、依赖注入官方一体化，无需自行拼装。' },
    { icon: '🎯', title: 'TypeScript 优先', desc: '全链路强类型，模板也能做类型检查，重构更有底气。' },
    { icon: '⚡', title: 'Signals', desc: '细粒度响应式原语，更新更精准，渲染开销更低。' },
  ];

  /** 周边生态 */
  readonly ecosystem = ['Angular CLI', 'RxJS', 'Angular Material', 'Signals', 'DevTools'];

  /**
   * 打开标注覆盖层
   *
   * 把待标注元素的真实 DOM 交给覆盖层；组件内部会截图并把画布尺寸对齐到
   * 该元素的 getBoundingClientRect()。
   *
   * @returns 无返回值；open() 返回 Promise<void>，这里刻意不 await
   * 副作用：覆盖层显示，页面交互被接管
   * @example
   * // 模板中绑定：<button (click)="openAnnotation()">添加标注</button>
   */
  openAnnotation(): void {
    this.annoRef().open(this.targetRef().nativeElement);
  }

  /**
   * 覆盖层「确认」回调
   *
   * @param payload 导出结果；null 表示截图或导出失败，此时保留原有预览
   * @returns 无返回值
   * 副作用：previewImg.set 触发模板重渲染；同时打印日志便于调试
   */
  handleConfirm(payload: ConfirmPayload | null): void {
    if (!payload) {
      console.log('⚠️ 未进行任何标注');
      return;
    }
    this.previewImg.set(payload.base64);
    console.log('✅ 确认标注:', payload);
  }

  /**
   * 覆盖层「取消」回调（点取消或按 Esc 触发）
   *
   * @returns 无返回值
   * 副作用：仅打日志；不清空 previewImg，便于与上一次结果对比
   */
  handleCancel(): void {
    console.log('❌ 取消标注');
  }
}
