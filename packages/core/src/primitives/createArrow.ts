/**
 * @file 箭头图形工厂
 *
 * 箭头由「线段 + 三角箭头」两个子对象组成一个 Group，便于整体选中、拖拽、
 * 缩放和旋转；颜色/粗细在引擎回读样式时分别落到线段的 stroke 与三角的 fill。
 * 注意：Group 内子对象的 selectable / evented 均为 false，交互只发生在 Group
 * 层；箭头工具在拖拽过程中会丢弃旧 Group 并整只重建（逐点改 line 端点会
 * 导致 Group 包围盒与子对象坐标错位）。
 *
 * @see src/tools/createArrowTool.ts
 */

import * as fabric from 'fabric';
import type { Point } from '../types';
import { angleDeg } from '../utils';

/**
 * 创建一个箭头（线段 + 三角箭头）
 *
 * @param start 起点，画布逻辑坐标，单位 px（线段起点、尾巴）
 * @param end 终点，画布逻辑坐标，单位 px（箭头尖所在位置）
 * @param color 颜色，CSS 颜色字符串；线段取 stroke，三角形取 fill
 * @param lineWidth 线宽，单位 px；三角形尺寸随其线性放大（宽 10+2×线宽，高 12+2×线宽）
 * @returns 已被设为可选中的 Group，可整体拖拽/缩放
 *
 * @example
 * const arrow = createArrow({ x: 20, y: 20 }, { x: 180, y: 90 }, '#ff3b30', 4);
 * canvas.add(arrow);
 *
 * // 拖拽预览：先移除旧 Group 再重建，避免子对象坐标与包围盒不同步
 * canvas.remove(oldArrow);
 * const next = createArrow(start, pointer, color, lineWidth);
 */
export function createArrow(start: Point, end: Point, color: string, lineWidth: number): fabric.Group {
  const line = new fabric.Line([start.x, start.y, end.x, end.y], {
    stroke: color,
    strokeWidth: lineWidth,
    // 交互交给外层 Group，子对象自身不参与命中检测
    selectable: false,
    evented: false,
  });

  const head = new fabric.Triangle({
    // 三角以终点为中心，箭头尖正好落在鼠标释放位置
    left: end.x,
    top: end.y,
    originX: 'center',
    originY: 'center',
    // Fabric 的 Triangle 默认尖角朝上（-90° 方向），
    // 加上 +90 后即可对齐「起点 → 终点」的实际朝向
    angle: angleDeg(start, end) + 90,
    // 尺寸与线宽联动：粗线配小箭头会显得比例失调
    width: 10 + lineWidth * 2,
    height: 12 + lineWidth * 2,
    fill: color,
    evented: false,
    selectable: false,
  });

  return new fabric.Group([line, head], {
    // Group 从创建起就可选中：箭头工具在 mouse:up 时只需修正包围盒
    selectable: true,
    hasControls: true,
    hasBorders: true,
    evented: true,
  });
}
