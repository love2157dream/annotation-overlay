/**
 * @file 指针坐标换算
 *
 * 把浏览器事件的视口坐标（clientX/clientY）转换为 Fabric 逻辑坐标。
 * 必要性：画布的 CSS 显示尺寸可能被 100% 宽度、缩放动画等改变，而 Fabric
 * 的逻辑宽高（canvasWidth/canvasHeight）固定；若直接相减会得到错位坐标。
 *
 * 注意：canvasWidth/canvasHeight 必须传 Fabric 的**逻辑**尺寸
 * （canvas.getWidth()/getHeight()，单位 CSS 像素），不能传位图尺寸
 * （canvasEl.width/height，已被 devicePixelRatio 放大），否则坐标会成倍偏移。
 *
 * @see src/tools/createRectTool.ts
 */

import type { Point } from '../types';

/**
 * 把鼠标事件坐标换算为画布逻辑坐标
 *
 * 纯函数，无副作用。换算分两步：先减去画布在视口中的偏移，再按
 * 「逻辑尺寸 / 显示尺寸」的比例缩放。
 *
 * @param e 原生鼠标事件，读取 clientX/clientY
 * @param canvasEl 用于取包围盒的画布元素，通常是 canvas.getElement()（下层画布）；
 *        上下层画布完全重叠，取下层结果一致
 * @param canvasWidth Fabric 逻辑宽度（CSS 像素），一般传 canvas.getWidth()
 * @param canvasHeight Fabric 逻辑高度（CSS 像素），一般传 canvas.getHeight()
 * @returns 画布逻辑坐标点，单位 px；落在画布外时可能为负数或超过宽高
 *
 * @example
 * const p = getCanvasPointer(
 *   event,
 *   canvas.getElement(),
 *   canvas.getWidth(),
 *   canvas.getHeight(),
 * );
 */
export function getCanvasPointer(
  e: MouseEvent,
  canvasEl: HTMLCanvasElement,
  canvasWidth: number,
  canvasHeight: number
): Point {
  // 每帧读取 rect：画布可能随布局变化（滚动、响应式），缓存会失效
  const rect = canvasEl.getBoundingClientRect();
  return {
    // 除以显示尺寸再乘逻辑尺寸，抹平 CSS 缩放带来的偏差
    x: ((e.clientX - rect.left) / rect.width) * canvasWidth,
    y: ((e.clientY - rect.top) / rect.height) * canvasHeight,
  };
}
