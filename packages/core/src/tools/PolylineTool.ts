import * as fabric from 'fabric';
import type { ToolId, ToolConfig, Point } from '../types';
import { BaseTool } from './BaseTool';
import { getCanvasPointer, rebuildPolyline } from '../utils';

/**
 * 折线工具
 * 支持多点连续绘制，双击或右键结束
 */
export class PolylineTool extends BaseTool {
  readonly id: ToolId = 'line';

  private points: Point[] = [];
  private polyline: fabric.Polyline | null = null;
  private isDrawing = false;

  onMouseDown(opt: any, canvas: fabric.Canvas): void {
    const nativeEvt = opt.e as MouseEvent;
    if (nativeEvt.button === 2) {
      // 右键结束折线
      this.finalize(canvas);
      return;
    }
    if (opt.target && this.polyline) return;

    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

    if (!this.isDrawing) {
      // 第一个点：起点和预览点重合
      this.points = [{ x: p.x, y: p.y }, { x: p.x, y: p.y }];
      this.isDrawing = true;
    } else {
      // 后续点击：将预览点固定为新点，并创建新的预览点
      this.points[this.points.length - 1] = { x: p.x, y: p.y };
      this.points.push({ x: p.x, y: p.y });
    }

    this.polyline = rebuildPolyline(
      canvas,
      this.polyline,
      this.points,
      this.config.color,
      this.config.lineWidth
    );
    canvas.renderAll();
    this.eventBus?.emit('tool:start');
  }

  onMouseMove(opt: any, canvas: fabric.Canvas): void {
    if (!this.isDrawing || !this.polyline || this.points.length === 0) return;

    const nativeEvt = opt.e as MouseEvent;
    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

    this.points[this.points.length - 1] = { x: p.x, y: p.y };
    this.polyline = rebuildPolyline(
      canvas,
      this.polyline,
      this.points,
      this.config.color,
      this.config.lineWidth
    );
    canvas.renderAll();
  }

  onMouseUp(opt: any, canvas: fabric.Canvas): void {
    // 折线工具在 mouse:down 中处理逻辑
  }

  onDblClick(opt: any, canvas: fabric.Canvas): void {
    // 双击结束折线
    this.finalize(canvas);
  }

  /**
   * 完成折线绘制
   */
  private finalize(canvas: fabric.Canvas): void {
    if (this.isDrawing && this.polyline) {
      if (this.points.length > 2) {
        this.points.pop();
        this.polyline = rebuildPolyline(
          canvas,
          this.polyline,
          this.points,
          this.config.color,
          this.config.lineWidth
        );
      }
      this.polyline!.set({ selectable: true, evented: true });
      this.polyline!.setCoords();
      this.eventBus?.emit('tool:end');
    }
    this.isDrawing = false;
    this.points = [];
    this.polyline = null;
  }

  destroy(): void {
    this.isDrawing = false;
    this.points = [];
    this.polyline = null;
  }
}