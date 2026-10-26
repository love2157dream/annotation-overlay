/**
 * @file Angular 版顶部工具栏：拖动手柄 + 六个绘图工具 + 撤销/重做 + 取消/确认
 *
 * 纯展示组件，自身不持有状态：当前工具、按钮可用性由父组件通过 input 传入，
 * 交互只通过 output 上报。按钮顺序、图标、文案取自
 * `@laoliangfe/annotation-overlay-ui`，与 React / Vue 版逐项对齐。
 *
 * 注意：
 * - 每个工具按钮带 `data-tool` 属性，父组件靠它查询按钮位置来定位样式面板，
 *   改名会导致面板定位失效。
 * - 宿主类名 .anno-toolbar 必须保留：父组件的拖拽判定与样式都依赖它。
 * - 本组件不处理拖拽，拖动由父级 .anno-topbar-group 的 (mousedown)/(touchstart) 接管。
 *
 * @see ./annotation-overlay.component.ts 父组件，负责状态与拖拽
 * @see ../../ui/src/data.ts 工具清单与文案
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';
import type { ToolId } from '@laoliangfe/annotation-overlay-core';
import { annoIcons, LABELS, TOOL_ITEMS } from '@laoliangfe/annotation-overlay-ui';
import { IconComponent } from './icon.component';

/**
 * 顶部工具栏：拖动手柄 + 六个绘图工具 + 撤销/重做 + 取消/确认
 * 结构照 react 版 Toolbar.tsx，类名沿用 ui 包全局样式
 */
@Component({
  // 父模板以 <anno-toolbar> 使用；带连字符前缀避免与业务选择器冲突
  selector: 'anno-toolbar',
  // 把 .anno-toolbar 放到宿主元素上，而非模板内层 div：
  // 父组件的拖拽判定（closest('.anno-toolbar')）与整体布局都依赖宿主即工具栏
  host: { class: 'anno-toolbar' },
  // 关闭样式封装：ui 包的 .anno-tool-btn 等全局类必须能命中
  encapsulation: ViewEncapsulation.None,
  // OnPush：输入 signal 变化才重新渲染
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <!-- 拖动手柄 -->
    <div class="anno-drag-handle" [title]="labels.dragHandle">
      <anno-icon [icon]="annoIcons.drag" />
    </div>

    <div class="anno-sep"></div>

    @for (tool of toolItems; track tool.id) {
      <button
        type="button"
        class="anno-tool-btn"
        [attr.data-tool]="tool.id"
        [class.active]="currentTool() === tool.id"
        [title]="tool.label"
        (click)="selectTool.emit(tool.id)"
      >
        <anno-icon [icon]="annoIcons[tool.icon]" />
      </button>
    }

    <div class="anno-sep"></div>

    <button type="button" class="anno-tool-btn" [title]="labels.undo" [disabled]="!canUndo()" (click)="undo.emit()">
      <anno-icon [icon]="annoIcons.undo" />
    </button>
    <button type="button" class="anno-tool-btn" [title]="labels.redo" [disabled]="!canRedo()" (click)="redo.emit()">
      <anno-icon [icon]="annoIcons.redo" />
    </button>

    <div class="anno-sep"></div>

    <button type="button" class="anno-btn" (click)="cancel.emit()">{{ labels.cancel }}</button>
    <button type="button" class="anno-btn primary" (click)="confirm.emit()">{{ labels.confirm }}</button>
  `,
})
export class ToolbarComponent {
  /** 图标数据表，供模板按名称取用（模板只能访问组件成员，不能直接引用模块常量） */
  readonly annoIcons = annoIcons;
  /** 工具清单，顺序即按钮渲染顺序 */
  readonly toolItems = TOOL_ITEMS;
  /** 界面文案表（撤销/重做 title、取消/确认按钮文本） */
  readonly labels = LABELS;

  /** 当前工具 id，'' 表示选择模式；必填，由父组件传入，用于按钮 active 高亮 */
  readonly currentTool = input.required<ToolId>();
  /** 是否可撤销，默认 false；false 时撤销按钮 disabled */
  readonly canUndo = input(false);
  /** 是否可重做，默认 false；false 时重做按钮 disabled */
  readonly canRedo = input(false);

  /** 点击绘图工具：回传工具 id，父组件负责惰性初始化引擎并切换工具 */
  readonly selectTool = output<ToolId>();
  /** 点击撤销 */
  readonly undo = output<void>();
  /** 点击重做 */
  readonly redo = output<void>();
  /** 点击取消：放弃本次标注并关闭覆盖层 */
  readonly cancel = output<void>();
  /** 点击确认：导出标注图片并关闭覆盖层 */
  readonly confirm = output<void>();
}
