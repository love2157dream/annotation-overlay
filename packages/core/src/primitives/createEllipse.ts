/**
 * @file 椭圆图形工厂
 *
 * 供椭圆工具创建草稿对象，由工具在拖拽过程中改写中心点与 rx/ry。
 * 注意：本工厂把 originX/originY 设为 'center'，此时 Fabric 的 left/top
 * 表示椭圆**中心**而非左上角；工具用 (起点+终点)/2 计算中心，
 * 若误用左上角原点会导致图形整体偏移半个宽高。
 *
 * @see src/tools/createEllipseTool.ts
 */

import * as fabric from 'fabric';
import type { Point } from '../types';

/**
 * 创建一个椭圆草稿对象
 *
 * 注意：返回对象默认不可交互，绘制结束后由工具开启选中并修正最小包围盒。
 *
 * @param p 椭圆中心点，画布逻辑坐标，单位 px
 * @param color 描边色，CSS 颜色字符串
 * @param lineWidth 线宽，单位 px，取值 > 0
 * @returns 半径均为 1 的透明填充椭圆，尚未 add 到画布
 *
 * @example
 * const ellipse = createEllipse({ x: 200, y: 120 }, '#0a84ff', 4);
 * canvas.add(ellipse);
 */
export function createEllipse(p: Point, color: string, lineWidth: number): fabric.Ellipse {
  return new fabric.Ellipse({
    // 中心点坐标：因 originX/originY 为 center，left/top 即椭圆中心
    left: p.x,
    top: p.y,
    // 1×1 半径占位，拖拽时按 |Δ|/2 更新
    rx: 1,
    ry: 1,
    stroke: color,
    fill: 'transparent',
    strokeWidth: lineWidth,
    // 中心原点，与工具的中心点算法一一对应
    originX: 'center',
    originY: 'center',
    // 草稿态不可交互
    selectable: false,
    evented: false,
  });
}
