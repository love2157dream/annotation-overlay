import { snapdom } from '@zumer/snapdom';

export async function domCapture(targetEl: HTMLElement): Promise<string> {
  try {
    const canvas = await snapdom.toCanvas(targetEl);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('截图失败:', e);
    return '';
  }
}