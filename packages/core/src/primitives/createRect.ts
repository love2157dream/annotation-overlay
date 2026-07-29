import * as fabric from 'fabric';
import type { Point } from '../types';

/**
 * 创建矩形
 */
export function createRect(
  p: Point,
  color: string,
  lineWidth: number
): fabric.Rect {
  return new fabric.Rect({
    left: p.x,
    top: p.y,
    width: 1,
    height: 1,
    stroke: color,
    fill: 'transparent',
    strokeWidth: lineWidth,
    originX: 'left',
    originY: 'top',
    selectable: false,
    evented: false,
  });
}