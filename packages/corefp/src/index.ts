// ---- 引擎 ----
export { createEventBus } from './engine/createEventBus';
export { createToolManager } from './engine/createToolManager';
export { createCanvasEngine } from './engine/createCanvasEngine';
export type { CanvasEngineInstance } from './engine/createCanvasEngine';

// ---- 工具 ----
export {
  createBaseTool,
  createPenTool,
  createRectTool,
  createEllipseTool,
  createArrowTool,
  createPolylineTool,
  createTextTool,
} from './tools';
export type { BaseToolInstance } from './tools/createBaseTool';

// ---- 历史 ----
export { createHistoryManager } from './history/createHistoryManager';

// ---- 截图 ----
export { domCapture } from './capture';

// ---- 控制手柄 ----
export { getDefaultControlConfig, applyControlConfig, enableSelectable, disableSelectable } from './controls';

// ---- 图形工厂 ----
export { createRect, createEllipse, createArrow, createPolyline } from './primitives';

// ---- 类型 ----
export * from './types';

// ---- 工具函数 ----
export { getCanvasPointer, ensureMinBoundingBox, distance, angle, angleDeg, clamp } from './utils';

// ---- 默认配置 ----
export { defaults } from './config/defaults';