/**
 * @file 截图模块出口
 *
 * 对外仅暴露 domCapture 一个能力，供引擎初始化画布时生成背景图，
 * 以及未做任何标注直接确认时复用。
 *
 * @see src/capture/domCapture.ts
 */

/** DOM 截图能力：把目标元素渲染为 PNG 格式 dataURL */
export { domCapture } from './domCapture';
