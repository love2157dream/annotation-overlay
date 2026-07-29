import type { Point } from '../types';

/**
 * 获取鼠标在画布上的逻辑坐标
 * @param e - 鼠标事件
 * @param canvasEl - 画布 DOM 元素
 * @param canvasWidth - 画布逻辑宽度
 * @param canvasHeight - 画布逻辑高度
 * @returns 画布逻辑坐标
 */
export function getCanvasPointer(
  e: MouseEvent,
  canvasEl: HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const rect = canvasEl.getBoundingClientRect();
  const relativeX = (e.clientX - rect.left) / rect.width;
  const relativeY = (e.clientY - rect.top) / rect.height;
  return {
    x: relativeX * canvasWidth,
    y: relativeY * canvasHeight,
  };
}

/**
 * 检查点是否在矩形内
 */
export function isPointInRect(point: Point, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
         point.y >= rect.y && point.y <= rect.y + rect.height;
}