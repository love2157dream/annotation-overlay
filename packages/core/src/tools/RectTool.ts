import * as fabric from 'fabric';
import type { ToolId, ToolConfig, Point } from '../types';
import { BaseTool } from './BaseTool';
import { getCanvasPointer } from '../utils';
import { createRect } from '../primitives';

/**
 * 矩形工具
 */
export class RectTool extends BaseTool {
  readonly id: ToolId = 'rect';

  private startPoint: Point | null = null;
  private shape: fabric.Rect | null = null;
  private isDrawing = false;

  onMouseDown(opt: any, canvas: fabric.Canvas): void {
    const nativeEvt = opt.e as MouseEvent;
    if (nativeEvt.button === 2) return;
    if (opt.target) return;

    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    this.startPoint = p;
    this.isDrawing = true;

    this.shape = createRect(p, this.config.color, this.config.lineWidth);
    canvas.add(this.shape);
  }

  onMouseMove(opt: any, canvas: fabric.Canvas): void {
    if (!this.isDrawing || !this.startPoint || !this.shape) return;

    const nativeEvt = opt.e as MouseEvent;
    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

    const width = p.x - this.startPoint.x;
    const height = p.y - this.startPoint.y;
    const left = width >= 0 ? this.startPoint.x : p.x;
    const top = height >= 0 ? this.startPoint.y : p.y;

    this.shape.set({
      left,
      top,
      width: Math.abs(width) || 1,
      height: Math.abs(height) || 1,
    });
    this.shape.setCoords();
    canvas.renderAll();
  }

  onMouseUp(opt: any, canvas: fabric.Canvas): void {
    if (this.isDrawing && this.shape) {
      this.shape.set({ selectable: true, evented: true });
      this.shape.setCoords();
      this.eventBus?.emit('tool:end');
    }
    this.isDrawing = false;
    this.startPoint = null;
    this.shape = null;
  }
}