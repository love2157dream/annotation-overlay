import * as fabric from 'fabric';
import type { ToolId, ToolConfig, Point } from '../types';
import { BaseTool } from './BaseTool';
import { getCanvasPointer } from '../utils';
import { createArrow } from '../primitives';

/**
 * 箭头工具
 */
export class ArrowTool extends BaseTool {
  readonly id: ToolId = 'arrow';

  private startPoint: Point | null = null;
  private shape: fabric.Group | null = null;
  private isDrawing = false;

  onMouseDown(opt: any, canvas: fabric.Canvas): void {
    const nativeEvt = opt.e as MouseEvent;
    if (nativeEvt.button === 2) return;
    if (opt.target) return;

    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    this.startPoint = p;
    this.isDrawing = true;

    this.shape = createArrow(p, p, this.config.color, this.config.lineWidth);
    canvas.add(this.shape);
  }

  onMouseMove(opt: any, canvas: fabric.Canvas): void {
    if (!this.isDrawing || !this.startPoint || !this.shape) return;

    const nativeEvt = opt.e as MouseEvent;
    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

    canvas.remove(this.shape);
    this.shape = createArrow(this.startPoint, p, this.config.color, this.config.lineWidth);
    canvas.add(this.shape);
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