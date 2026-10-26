/**
 * @file React 版图标渲染器：把 ui 包的 SVG 几何数据画成 <svg>
 *
 * ui 包只提供纯数据（AnnoIcon：viewBox + 若干 path + 若干 circle），不带框架代码，
 * 三端各自实现渲染。本组件按「有 circles 即为实心图标」的约定切换填充方式：
 * - 线条型（工具、撤销/重做）：stroke=currentColor，fill=none；
 * - 实心型（拖动手柄的圆点）：fill=currentColor，stroke=none。
 * 颜色因此完全由 CSS 的 color 控制，主题切换只需改变父级文字颜色。
 *
 * @see ../../ui/src/icons.ts 图标数据与 AnnoIcon 类型
 * @see ../components/Toolbar.tsx 主要使用方
 */
import type { AnnoIcon } from '@laoliangfe/annotation-overlay-ui';

/**
 * 图标组件
 *
 * @param icon 图标几何数据：viewBox 缺省 '0 0 24 24'，paths 为描边路径，
 *             circles 为实心圆 [cx, cy, r]；两者可同时存在，按 order 先 path 后 circle 渲染
 * @param size 图标边长，单位 px，默认 20；工具栏按钮内实际尺寸由 CSS 变量 --anno-icon-size 再覆盖
 * @returns 内联 SVG 元素，尺寸与颜色继承自 props 与 CSS
 *
 * @example
 * <Icon icon={annoIcons.pen} />
 * <Icon icon={annoIcons.drag} size={24} />
 */
export function Icon({ icon, size = 20 }: { icon: AnnoIcon; size?: number }) {
  // 约定：只要给了 circles 就按实心图标处理（描边路径 + 实心圆不会混用）
  const isFilled = !!icon.circles;
  return (
    <svg
      width={size}
      height={size}
      viewBox={icon.viewBox ?? '0 0 24 24'}
      fill={isFilled ? 'currentColor' : 'none'}
      stroke={isFilled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 描边路径：d 为 SVG path 指令 */}
      {(icon.paths ?? []).map((d, i) => (
        <path key={`p${i}`} d={d} />
      ))}
      {/* 实心圆点：[cx, cy, r] 三元组 */}
      {(icon.circles ?? []).map(([cx, cy, r], i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}
