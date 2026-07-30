import * as fabric from 'fabric';
import type { Point } from '../types';
import { angleDeg } from '../utils';

export function createArrow(start: Point, end: Point, color: string, lineWidth: number): fabric.Group {
  const line = new fabric.Line([start.x, start.y, end.x, end.y], {
    stroke: color,
    strokeWidth: lineWidth,
    selectable: false,
    evented: false,
  });

  const head = new fabric.Triangle({
    left: end.x,
    top: end.y,
    originX: 'center',
    originY: 'center',
    angle: angleDeg(start, end) + 90,
    width: 10 + lineWidth * 2,
    height: 12 + lineWidth * 2,
    fill: color,
    evented: false,
    selectable: false,
  });

  return new fabric.Group([line, head], {
    selectable: true,
    hasControls: true,
    hasBorders: true,
    evented: true,
  });
}