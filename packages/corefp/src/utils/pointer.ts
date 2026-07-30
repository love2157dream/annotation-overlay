import type { Point } from '../types';

export function getCanvasPointer(
  e: MouseEvent,
  canvasEl: HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvasWidth,
    y: ((e.clientY - rect.top) / rect.height) * canvasHeight,
  };
}