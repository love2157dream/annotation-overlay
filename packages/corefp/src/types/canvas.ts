import type { ToolId } from './tool';

/** 画布事件类型 */
export type CanvasEventType =
  | 'tool:changed'
  | 'tool:start'
  | 'tool:move'
  | 'tool:end'
  | 'object:selected'
  | 'object:modified'
  | 'state:changed'
  | 'text:editing:start'
  | 'text:editing:end';

/** 画布事件数据 */
export interface CanvasEventData {
  type: CanvasEventType;
  payload?: any;
}

/** 画布状态 */
export interface CanvasState {
  toolId: ToolId;
  canUndo: boolean;
  canRedo: boolean;
  objectCount: number;
  isDrawing: boolean;
}