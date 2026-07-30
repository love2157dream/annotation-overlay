import type { ToolId, ToolConfig, Point } from '../types';
import { createBaseTool } from './createBaseTool';
import { getCanvasPointer } from '../utils';
import { createArrow } from '../primitives';

export function createArrowTool(config: ToolConfig) {
  let startPoint: Point | null = null;
  let shape: any = null;
  let isDrawing = false;

  const tool = createBaseTool('arrow' as ToolId, config);

  tool.onMouseDown = (opt: any, canvas: any) => {
    const e = opt.e as MouseEvent;
    if (e.button === 2 || opt.target) return;
    const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    startPoint = p;
    isDrawing = true;
    shape = createArrow(p, p, config.color, config.lineWidth);
    canvas.add(shape);
  };

  tool.onMouseMove = (opt: any, canvas: any) => {
    if (!isDrawing || !startPoint || !shape) return;
    const p = getCanvasPointer(opt.e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    canvas.remove(shape);
    shape = createArrow(startPoint, p, config.color, config.lineWidth);
    canvas.add(shape);
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