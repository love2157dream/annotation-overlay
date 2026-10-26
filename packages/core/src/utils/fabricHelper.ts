/**
 * @file Fabric 对象辅助操作
 *
 * 两个与 Fabric 数据结构强相关的工具函数：
 * ensureMinBoundingBox 解决「极小对象选不中/控制点翻转」，rebuildPolyline 解决
 * 「Polyline 点集无法原地高效更新」。二者都被工具层与引擎直接调用。
 *
 * @see src/primitives/createPolyline.ts
 * @see src/engine/createCanvasEngine.ts
 */

import * as fabric from 'fabric';
import type { Point } from '../types';

/**
 * 保证对象包围盒不小于最小尺寸
 *
 * 通过放大 scaleX/scaleY 实现，而不是改写 width/height —— 这样不破坏原始
 * 几何数据，序列化与后续缩放都保持可预期。
 *
 * 副作用：修改对象 scaleX/scaleY 并两次调用 setCoords（getScaledWidth 依赖
 * 当前坐标缓存，set 之后需重算才能得到新值）。
 *
 * @param obj 任意 Fabric 对象；为 null/undefined 时直接返回（用于容错恢复流程）
 * @param minSize 最小边长，单位 px，默认 10（与 defaults.minObjectSize 保持一致）
 *
 * @example
 * const rect = createRect(p, color, 4); // 初始 1×1
 * ensureMinBoundingBox(rect);           // 放大到 10×10
 */
export function ensureMinBoundingBox(obj: any, minSize: number = 10): void {
  if (!obj) return;
  // 先同步坐标，否则下面的 getScaledWidth 读到的是旧包围盒
  obj.setCoords();
  const w = obj.getScaledWidth?.() || obj.width || 0;
  const h = obj.getScaledHeight?.() || obj.height || 0;
  // 按缺口比例乘到现有 scale 上：0.01 兜底防止除零（宽高为 0 的退化对象）
  if (w < minSize) obj.set({ scaleX: (obj.scaleX || 1) * (minSize / Math.max(w, 0.01)) });
  if (h < minSize) obj.set({ scaleY: (obj.scaleY || 1) * (minSize / Math.max(h, 0.01)) });
  // scale 变化后重算包围盒，保证命中检测与控制点位置一致
  obj.setCoords();
}

/**
 * 用新的点集重建折线对象
 *
 * 做法是「移除旧对象 → 新建 Polyline → 加回画布」。相比直接改 points，
 * 重建能让 Fabric 重新计算 left/top 与包围盒，避免拖动选框错位。
 *
 * 副作用：从画布移除 oldObj，并向画布添加新对象；调用方必须使用返回值
 * 替换旧引用，否则后续操作会作用在已被移除的对象上。
 *
 * @param canvas 当前画布实例，需支持 remove / add
 * @param oldObj 旧的折线对象，可为 null（首次创建）
 * @param points 新点集（绝对画布坐标），至少 2 个点，末位通常是预览点
 * @param color 描边色，CSS 颜色字符串
 * @param lineWidth 线宽，单位 px，取值 > 0
 * @returns 新建的 Polyline 实例（已加入画布）
 *
 * @example
 * points.push(pointer);
 * polyline = rebuildPolyline(canvas, polyline, points, color, lineWidth);
 * canvas.requestRenderAll();
 */
export function rebuildPolyline(
  canvas: any,
  oldObj: any,
  points: Point[],
  color: string,
  lineWidth: number
): any {
  // 先移除：同一位置同时存在两只折线会出现重影，且包围盒叠加干扰命中
  if (oldObj) canvas.remove(oldObj);
  // 参数需与 primitives/createPolyline 保持一致，否则预览态与最终态样式不一致
  const newObj = new fabric.Polyline(points, {
    stroke: color,
    // 透明填充：否则 Fabric 会把开放折线首尾相连填色
    fill: 'transparent',
    strokeWidth: lineWidth,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    // 点集每帧变化，缓存位图会留下残影
    objectCaching: false,
  });
  canvas.add(newObj);
  return newObj;
}
