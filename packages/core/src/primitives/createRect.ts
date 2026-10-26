/**
 * @file 矩形图形工厂
 *
 * 供矩形工具在 mouse:down 时创建草稿对象，后续由工具在 mouse:move 中改写
 * left/top/width/height。所有样式取引擎实时配置，不在此处读全局默认值。
 * 注意：初始尺寸固定为 1×1，避免 Fabric 对 0 宽高对象计算包围盒时出现
 * NaN/除零；origin 取左上角，与拖拽时的 left/top 语义一致（无需减半宽高）。
 *
 * @see src/tools/createRectTool.ts
 */

import * as fabric from 'fabric';
import type { Point } from '../types';

/**
 * 创建一个矩形草稿对象
 *
 * 注意：返回对象默认 `selectable:false / evented:false`，绘制过程中不响应
 * 选择与拖拽；工具在 mouse:up 时会改回 true 并套用手柄样式。
 *
 * @param p 起始点（左上角），画布逻辑坐标，单位 px
 * @param color 描边色，CSS 颜色字符串
 * @param lineWidth 线宽，单位 px，取值 > 0
 * @returns 初始为 1×1 的透明的矩形，已加入渲染但尚未 add 到画布
 *
 * @example
 * const rect = createRect({ x: 40, y: 60 }, '#ff3b30', 4);
 * canvas.add(rect);
 */
export function createRect(p: Point, color: string, lineWidth: number): fabric.Rect {
  return new fabric.Rect({
    // 起点即左上角，工具后续用拖拽方向修正
    left: p.x,
    top: p.y,
    // 1×1：占位尺寸，避免零尺寸导致包围盒计算异常
    width: 1,
    height: 1,
    // 只描边不填充，保证下方截图内容可见
    stroke: color,
    fill: 'transparent',
    strokeWidth: lineWidth,
    // 左上角原点，拖拽时无需换算中心点
    originX: 'left',
    originY: 'top',
    // 草稿态不可交互，避免绘制过程中被误选中
    selectable: false,
    evented: false,
  });
}
