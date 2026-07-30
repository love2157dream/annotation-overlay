import * as fabric from 'fabric';
import type { Point } from '../types';

export function createEllipse(p: Point, color: string, lineWidth: number): fabric.Ellipse {
  return new fabric.Ellipse({
    left: p.x,
    top: p.y,
    rx: 1,
    ry: 1,
    stroke: color,
    fill: 'transparent',
    strokeWidth: lineWidth,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  });
}