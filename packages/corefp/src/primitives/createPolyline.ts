import * as fabric from 'fabric';
import type { Point } from '../types';

export function createPolyline(points: Point[], color: string, lineWidth: number): fabric.Polyline {
  return new fabric.Polyline(points, {
    stroke: color,
    fill: 'transparent',
    strokeWidth: lineWidth,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    objectCaching: false,
  });
}