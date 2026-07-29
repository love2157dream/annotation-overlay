import type { Point } from '../types';
import * as fabric from 'fabric';

/**
 * 确保对象最小包围盒
 * 防止对象退化成扁平矩形，导致控制手柄方向错误
 */
export function ensureMinBoundingBox(obj: any, minSize: number = 10): void {
  if (!obj) return;
  obj.setCoords();
  const w = obj.getScaledWidth?.() || obj.width || 0;
  const h = obj.getScaledHeight?.() || obj.height || 0;

  if (w < minSize) {
    const scaleX = (obj.scaleX || 1) * (minSize / Math.max(w, 0.01));
    obj.set({ scaleX });
  }
  if (h < minSize) {
    const scaleY = (obj.scaleY || 1) * (minSize / Math.max(h, 0.01));
    obj.set({ scaleY });
  }
  obj.setCoords();
}

/**
 * 更新折线对象（重建）
 * 因 Fabric 的 Polyline 更新 points 后不会自动重算，需重建
 */
export function rebuildPolyline(
  canvas: any,
  oldObj: any,
  points: Point[],
  color: string,
  lineWidth: number
): any {
  if (oldObj) canvas.remove(oldObj);
  const newObj = new fabric.Polyline(points, {
    stroke: color,
    fill: 'transparent',
    strokeWidth: lineWidth,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    objectCaching: false,
  });
  canvas.add(newObj);
  return newObj;
}