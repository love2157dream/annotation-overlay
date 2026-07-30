import type { ToolId, ToolConfig, Point } from '../types';
import { createBaseTool } from './createBaseTool';
import { getCanvasPointer } from '../utils';
import { createEllipse } from '../primitives';

export function createEllipseTool(config: ToolConfig) {
  let startPoint: Point | null = null;
  let shape: any = null;
  let isDrawing = false;

  const tool = createBaseTool('ellipse' as ToolId, config);

  tool.onMouseDown = (opt: any, canvas: any) => {
    const e = opt.e as MouseEvent;
    if (e.button === 2 || opt.target) return;
    const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    startPoint = p;
    isDrawing = true;
    shape = createEllipse(p, config.color, config.lineWidth);
    canvas.add(shape);
  };

  tool.onMouseMove = (opt: any, canvas: any) => {
    if (!isDrawing || !startPoint || !shape) return;
    const p = getCanvasPointer(opt.e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    const w = p.x - startPoint.x;
    const h = p.y - startPoint.y;
    shape.set({
      left: (startPoint.x + p.x) / 2,
      top: (startPoint.y + p.y) / 2,
      rx: Math.abs(w) / 2 || 1,
      ry: Math.abs(h) / 2 || 1,
    });
    shape.setCoords();
    canvas.renderAll();
  };

  tool.onMouseUp = () => {
    if (isDrawing && shape) {
      shape.set({ selectable: true, evented: true });
      shape.setCoords();
    }
    isDrawing = false;
    startPoint = null;
    shape = null;
  };

  return tool;
}