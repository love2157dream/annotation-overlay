import * as fabric from 'fabric';
import type { ToolId, ToolConfig } from '../types';
import { BaseTool } from './BaseTool';

/**
 * 画笔工具
 * 实现自由绘制
 */
export class PenTool extends BaseTool {
  readonly id: ToolId = 'pen';

  onMouseDown(opt: any, canvas: fabric.Canvas): void {
    // 画笔工具由 Fabric 的 isDrawingMode 处理
    // 这里不需要额外逻辑
  }

  onMouseMove(opt: any, canvas: fabric.Canvas): void {
    // 画笔工具由 Fabric 的 isDrawingMode 处理
  }

  onMouseUp(opt: any, canvas: fabric.Canvas): void {
    // 画笔工具由 Fabric 的 isDrawingMode 处理
  }
}