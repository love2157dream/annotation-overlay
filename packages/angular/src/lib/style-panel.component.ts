/**
 * @file Angular 版样式面板：粗细/字号滑条 + 预设色板 + 自定义取色器
 *
 * 纯展示组件：数值全部由父组件通过 input 传入，变更通过 output 上报，
 * 自身不维护草稿状态，也不直接调用引擎。
 *
 * 定位方式：面板由父组件放在 .anno-topbar-group 内，父模板用
 * `[style.left.px]` / `[style.top.px]` 绑定坐标（坐标来自按钮 rect 差值）。
 * 因此本组件的 panelLeft 输入仅用于对外 API 对齐，模板不直接消费。
 *
 * 提交时机：
 * - 滑条拖动期间每次 input 都 emit updateStyle（父组件实时应用样式，不写历史），
 *   松开鼠标 emit commitStyle，由父组件落一个撤销点；
 * - 颜色选择即时 emit setColor，父组件立即应用并提交历史。
 *
 * @see ./annotation-overlay.component.ts 父组件，负责坐标计算与历史提交
 * @see ../../ui/src/data.ts 色板与尺寸区间
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { COLOR_PRESETS, LABELS, SIZE_RANGE } from '@laoliangfe/annotation-overlay-ui';

/**
 * 样式面板：粗细/大小滑条 + 预设色板 + 自定义颜色
 * 结构照 react 版 StylePanel.tsx
 */
@Component({
  // 父模板以 <anno-style-panel> 使用
  selector: 'anno-style-panel',
  // 宿主即面板容器：绝对定位与 .anno-style-panel 样式都作用在宿主上
  host: { class: 'anno-style-panel' },
  // 关闭样式封装：复用 ui 包全局类
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="anno-style-row">
      <span class="anno-label">{{ isTextTool() ? labels.fontSize : labels.strokeWidth }}</span>
      <input
        type="range"
        [min]="sizeRange().min"
        [max]="sizeRange().max"
        [value]="sizeOrWidth()"
        (input)="onSizeInput($event)"
        (mouseup)="commitStyle.emit()"
      />
      <span class="anno-value">{{ sizeOrWidth() }}px</span>
    </div>

    <div class="anno-style-row">
      <span class="anno-label">{{ labels.color }}</span>
      <div class="anno-color-list">
        @for (c of colorPresets; track c) {
          <span
            class="anno-swatch"
            [class.active]="currentColor() === c"
            [style.background]="c"
            (click)="setColor.emit(c)"
          ></span>
        }
        <input
          type="color"
          class="anno-color-picker"
          [title]="labels.customColor"
          [value]="currentColor()"
          (input)="onColorInput($event)"
        />
      </div>
    </div>
  `,
})
export class StylePanelComponent {
  /** 预设色板（7 个），模板按顺序渲染为圆形色块 */
  readonly colorPresets = COLOR_PRESETS;
  /** 界面文案表（粗细/大小、颜色、自定义颜色提示） */
  readonly labels = LABELS;

  /** 当前颜色（CSS 颜色字符串），必填；用于色块高亮与取色器回显 */
  readonly currentColor = input.required<string>();
  /** 当前线宽，单位 px，必填；非文字工具时绑定到滑条 */
  readonly lineWidth = input.required<number>();
  /** 当前字号，单位 px，必填；文字工具时绑定到滑条 */
  readonly fontSize = input.required<number>();
  /** 是否文字工具，默认 false；决定滑条绑定字号还是线宽、标签文案 */
  readonly isTextTool = input(false);
  /** 面板左偏移（px），默认 0；仅用于 API 对齐，实际定位由父模板的 style 绑定完成 */
  readonly panelLeft = input(0);
  /** 工具栏是否已被拖动，默认 false；用于调用方判断是否需要自定义定位 */
  readonly isCustomPosition = input(false);

  /** 滑条数值变化（拖动中高频触发）：父组件只应用样式，不写历史 */
  readonly updateStyle = output<{ size?: number; color?: string }>();
  /** 颜色变更：父组件立即应用并提交历史 */
  readonly setColor = output<string>();
  /** 滑条松开：父组件提交一次历史 */
  readonly commitStyle = output<void>();

  /** 滑条当前值：文字工具取字号，其余取线宽（两者复用同一个 range 控件） */
  readonly sizeOrWidth = computed(() => (this.isTextTool() ? this.fontSize() : this.lineWidth()));

  /** 滑条区间：必须与 sizeOrWidth 成对切换（字号 8–72 / 线宽 1–20） */
  readonly sizeRange = computed(() => (this.isTextTool() ? SIZE_RANGE.fontSize : SIZE_RANGE.lineWidth));

  /**
   * 滑条输入处理
   *
   * @param e 原生 input 事件，target 为 range 输入框
   * @returns 无；emit updateStyle({ size })，由父组件决定改字号还是线宽
   */
  onSizeInput(e: Event): void {
    // range 的 value 是字符串，显式转数字，避免下游字符串参与运算
    const value = Number((e.target as HTMLInputElement).value);
    this.updateStyle.emit({ size: value });
  }

  /**
   * 取色器输入处理
   *
   * @param e 原生 input 事件（拖动取色器时连续触发），target 为 color 输入框
   * @returns 无；emit setColor(颜色字符串)
   */
  onColorInput(e: Event): void {
    this.setColor.emit((e.target as HTMLInputElement).value);
  }
}
