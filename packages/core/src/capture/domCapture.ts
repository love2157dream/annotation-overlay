/**
 * @file DOM 截图实现
 *
 * 基于 @zumer/snapdom 将真实 DOM 序列化为 SVG foreignObject 再绘制到 canvas，
 * 输出 PNG dataURL。引擎 init 时用它生成画布背景，captureOnly 用它支持
 * 「不打标注直接确认」。截图结果包含元素当前滚动位置下的可见内容。
 *
 * 注意：截图是异步的（需等待字体与图片加载），且跨域资源未授权时会静默降级
 * 或缺失，因此调用方必须判空，不能假设一定拿到图。
 *
 * @see src/engine/createCanvasEngine.ts
 */

import { snapdom } from '@zumer/snapdom';

/**
 * 截取指定元素并返回 PNG dataURL
 *
 * 副作用：会读取目标元素的计算样式、触发图片解码；失败时向控制台输出 warn。
 * 本函数不抛异常，失败统一返回空字符串，调用方需按 `if (!base64)` 处理。
 *
 * @param targetEl 待截图的元素，通常是被标注的页面区块；需已挂载到文档中且有非零尺寸
 * @returns 成功为 `data:image/png;base64,...`；失败（元素不可见、跨域资源、浏览器不支持等）为空串
 *
 * @example
 * const base64 = await domCapture(document.querySelector('#card')!);
 * if (base64) {
 *   img.src = base64;
 * } else {
 *   console.warn('截图不可用，退化为纯色背景');
 * }
 */
export async function domCapture(targetEl: HTMLElement): Promise<string> {
  try {
    // toCanvas 内部按元素尺寸创建位图并等待资源加载完成，这里是唯一的耗时点
    const canvas = await snapdom.toCanvas(targetEl);
    // 固定 PNG：后续既要作为 Fabric 背景图，也要能直接转 Blob 上传
    return canvas.toDataURL('image/png');
  } catch (e) {
    // 截图失败不阻断标注流程：引擎会在无背景图的情况下继续创建画布
    console.warn('截图失败:', e);
    return '';
  }
}
