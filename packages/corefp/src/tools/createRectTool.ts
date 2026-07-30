import type { ToolId, ToolConfig, Point } from '../types';
import { createBaseTool } from './createBaseTool';
import { getCanvasPointer } from '../utils';
import { createRect } from '../primitives';

export function createRectTool(config: ToolConfig) {
  let startPoint: Point | null = null;
  let shape: any = null;
  let isDrawing = false;

  const tool = createBaseTool('rect' as ToolId, config);

  tool.onMouseDown = (opt: any, canvas: any) => {
    const e = opt.e as MouseEvent;
    if (e.button === 2 || opt.target) return;
    const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    startPoint = p;
    isDrawing = true;
    shape = createRect(p, config.color, config.lineWidth);
    canvas.add(shape);
  };

  tool.onMouseMove = (opt: any, canvas: any) => {
    if (!isDrawing || !startPoint || !shape) return;
    const p = getCanvasPointer(opt.e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    const w = p.x - startPoint.x;
    const h = p.y - startPoint.y;
    shape.set({
      left: w >= 0 ? startPoint.x : p.x,
      top: h >= 0 ? startPoint.y : p.y,
      width: Math.abs(w) || 1,
      height: Math.abs(h) || 1,
    });
    shape.setCoords();
    canvas.renderAll();
  };

  tool.onMouseUp = (_opt: any, canvas: any) => {
    if (isDrawing && shape) {
      shape.set({ selectable: true, evented: true });
      shape.setCoords();
      tool.setEventBus?.(null as any); // emit 通过闭包访问
      // 这里通过闭包触发事件
      const bus = (tool as any).__eventBus;
      bus?.emit('tool:end');
    }
    isDrawing = false;
    startPoint = null;
    shape = null;
  };

  return tool;
}