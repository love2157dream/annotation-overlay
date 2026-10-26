/**
 * @file 图形工厂出口
 *
 * 汇总四类基础图形的构造能力，供工具实现与外部扩展直接复用，
 * 保证「工具绘制的对象」与「外部创建的对象」样式参数一致。
 *
 * @see src/primitives/createRect.ts
 */

/** 矩形：左上角原点、1×1 草稿、只描边 */
export { createRect } from './createRect';
/** 椭圆：中心原点、半径 1 草稿、只描边 */
export { createEllipse } from './createEllipse';
/** 箭头：线段 + 三角组成的可选中 Group */
export { createArrow } from './createArrow';
/** 折线：按点序列绘制的开放折线，无填充 */
export { createPolyline } from './createPolyline';
