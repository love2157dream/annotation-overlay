import type { ToolId, ToolConfig, Point } from '../types';
import { createBaseTool } from './createBaseTool';
import { getCanvasPointer, rebuildPolyline } from '../utils';

export function createPolylineTool(config: ToolConfig) {
  let points: Point[] = [];
  let polyline: any = null;
  let isDrawing = false;

  const tool = createBaseTool('line' as ToolId, config);

  const finalize = (canvas: any) => {
    if (isDrawing && polyline) {
      if (points.length > 2) {
        points.pop();
        polyline = rebuildPolyline(canvas, polyline, points, config.color, config.lineWidth);
      }
      polyline.set({ selectable: true, evented: true });
      polyline.setCoords();
    }
    isDrawing = false;
    points = [];
    polyline = null;
  };

  tool.onMouseDown = (opt: any, canvas: any) => {
    const e = opt.e as MouseEvent;
    if (e.button === 2) { finalize(canvas); return; }
    if (opt.target && polyline) return;

    const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

    if (!isDrawing) {
      points = [{ x: p.x, y: p.y }, { x: p.x, y: p.y }];
      isDrawing = true;
    } else {
      points[points.length - 1] = { x: p.x, y: p.y };
      points.push({ x: p.x, y: p.y });
    }

    polyline = rebuildPolyline(canvas, polyline, points, config.color, config.lineWidth);
    canvas.renderAll();
  };

  tool.onMouseMove = (opt: any, canvas: any) => {
    if (!isDrawing || !polyline || points.length === 0) return;
    const p = getCanvasPointer(opt.e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    points[points.length - 1] = { x: p.x, y: p.y };
    polyline = rebuildPolyline(canvas, polyline, points, config.color, config.lineWidth);
    canvas.renderAll();
  };

  tool.onDblClick = (_opt: any, canvas: any) => {
    finalize(canvas);
  };

  tool.destroy = () => {
    isDrawing = false;
    points = [];
    polyline = null;
  };

  return tool;
}