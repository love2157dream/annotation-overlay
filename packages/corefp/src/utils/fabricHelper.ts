import type { Point } from '../types';

export function ensureMinBoundingBox(obj: any, minSize: number = 10): void {
  if (!obj) return;
  obj.setCoords();
  const w = obj.getScaledWidth?.() || obj.width || 0;
  const h = obj.getScaledHeight?.() || obj.height || 0;
  if (w < minSize) obj.set({ scaleX: (obj.scaleX || 1) * (minSize / Math.max(w, 0.01)) });
  if (h < minSize) obj.set({ scaleY: (obj.scaleY || 1) * (minSize / Math.max(h, 0.01)) });
  obj.setCoords();
}

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