/**
 * @file 折线图形工厂
 *
 * 按给定点序列创建一条不填充的折线。注意：内部折线工具为了「每次移动都替换
 * 旧对象」，实际使用的是 utils/rebuildPolyline（带 remove + add），
 * 本工厂保留给外部直接构造折线的场景，两者渲染参数保持一致。
 *
 * 坑点：Fabric 的 Polyline 接收的是绝对坐标点数组，构造时会自行计算
 * left/top 与 points 的相对偏移；因此不要先算好包围盒再传入相对坐标，
 * 否则会出现整体位移。
 *
 * @see src/utils/fabricHelper.ts
 * @see src/tools/createPolylineTool.ts
 */

import * as fabric from 'fabric';
import type { Point } from '../types';

/**
 * 创建一条折线
 *
 * @param points 顶点数组（至少 2 个），画布逻辑坐标，单位 px；顺序即绘制顺序
 * @param color 描边色，CSS 颜色字符串
 * @param lineWidth 线宽，单位 px，取值 > 0；折线无填充，仅描边可见
 * @returns 可选中/可拖拽的 Polyline，尚未 add 到画布
 *
 * @example
 * const line = createPolyline(
 *   [{ x: 20, y: 20 }, { x: 120, y: 80 }, { x: 220, y: 30 }],
 *   '#34c759',
 *   4,
 * );
 * canvas.add(line);
 */
export function createPolyline(points: Point[], color: string, lineWidth: number): fabric.Polyline {
  return new fabric.Polyline(points, {
    stroke: color,
    // 透明填充：避免 Fabric 默认把开放折线首尾相连后填色
    fill: 'transparent',
    strokeWidth: lineWidth,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    // 折线点集在拖拽中频繁变化，缓存位图会导致残影
    objectCaching: false,
  });
}
