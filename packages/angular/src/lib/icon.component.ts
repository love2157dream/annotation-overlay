/**
 * @file Angular 版图标渲染器：把 ui 包的 SVG 几何数据画成内联 <svg>
 *
 * ui 包只提供纯数据（AnnoIcon：viewBox + path 列表 + circle 列表），
 * 三端各自渲染。填充规则按「存在 circles 即视为实心图标」：
 * - 线条型（工具、撤销/重做）：fill=none，stroke=currentColor；
 * - 实心型（拖动手柄圆点）：fill=currentColor，stroke=none。
 * 颜色完全由 CSS 的 color 控制，主题切换只需改父级文字颜色。
 *
 * 注意：SVG 属性必须用 [attr.*] 绑定，直接写 [width] 会被当成 DOM property，
 * 在 SVG 元素上不生效。
 *
 * @see ../../ui/src/icons.ts 图标数据与 AnnoIcon 类型
 * @see ./toolbar.component.ts 主要使用方
 */
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import type { AnnoIcon } from '@laoliangfe/annotation-overlay-ui';

/**
 * 图标组件：渲染 ui 包的框架无关 SVG 图标数据
 * circles（实心圆点）用 fill=currentColor，paths（线条）用 stroke=currentColor
 */
@Component({
  // 父模板以 <anno-icon [icon]="..."> 使用
  selector: 'anno-icon',
  // 无自带样式，关闭封装避免引入无意义的属性前缀
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="icon().viewBox ?? '0 0 24 24'"
      [attr.fill]="isFilled ? 'currentColor' : 'none'"
      [attr.stroke]="isFilled ? 'none' : 'currentColor'"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @for (d of icon().paths ?? []; track $index) {
        <path [attr.d]="d" />
      }
      @for (c of icon().circles ?? []; track $index) {
        <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2]" />
      }
    </svg>
  `,
})
export class IconComponent {
  /** 图标几何数据，必填；viewBox 缺省 0 0 24 24，paths 为描边路径，circles 为 [cx, cy, r] */
  readonly icon = input.required<AnnoIcon>();
  /** 图标边长，单位 px，默认 20；按钮内实际显示尺寸由 CSS 变量 --anno-icon-size 覆盖 */
  readonly size = input(20);

  /**
   * 是否按实心图标渲染
   *
   * 约定：只要提供了 circles 就整体走 fill 模式（图标不会混用两种填充）；
   * 每次变更检测读取 input signal，无需缓存。
   * @returns true 表示用填充、不描边
   */
  get isFilled(): boolean {
    return !!this.icon().circles;
  }
}
