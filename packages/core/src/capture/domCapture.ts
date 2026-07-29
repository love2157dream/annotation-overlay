import { snapdom } from '@zumer/snapdom';

/**
 * DOM 截图
 * 使用 snapdom 捕获 HTML 元素为图片
 */
export async function domCapture(targetEl: HTMLElement): Promise<string> {
  try {
    const canvas = await snapdom.toCanvas(targetEl);
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('截图失败:', error);
    return '';
  }
}