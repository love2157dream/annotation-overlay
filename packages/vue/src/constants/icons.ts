import { h, type VNode } from 'vue';

/**
 * SVG 图标工厂
 */
function svgIcon(d: string, viewBox: string = '0 0 24 24'): () => VNode {
  return (): VNode =>
    h(
      'svg',
      {
        width: 20,
        height: 20,
        viewBox,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      [h('path', { d })]
    );
}

export const IconUndo = svgIcon('M9 14L4 9l5-5M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5h-1');
export const IconRedo = svgIcon('M15 14l5-5-5-5M20 9H9a5 5 0 00-5 5v0a5 5 0 005 5h1');

export const toolIcons = {
  pen: svgIcon('M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'),
  line: svgIcon('M2 20 L8 8 L14 16 L22 4'),
  arrow: svgIcon('M4 20L20 4M20 4h-8M20 4v8'),
  rect: svgIcon('M4 5h16v14H4z'),
  ellipse: svgIcon('M12 6a8 6 0 100 12 8 6 0 000-12z'),
  text: svgIcon('M5 5h14M12 5v14'),
} as const;