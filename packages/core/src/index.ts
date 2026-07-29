// 引擎
export { CanvasEngine, EventBus, ToolManager } from './engine';

// 工具
export { BaseTool, PenTool, RectTool, EllipseTool, ArrowTool, PolylineTool, TextTool } from './tools';

// 历史
export { HistoryManager } from './history';

// 截图
export { domCapture } from './capture';

// 控制手柄
export { getDefaultControlConfig, applyControlConfig, enableSelectable, disableSelectable } from './controls';

// 图形工厂
export { createRect, createEllipse, createArrow, createPolyline } from './primitives';

// 类型
export * from './types';

// 工具函数
export { getCanvasPointer, ensureMinBoundingBox, distance, angle, angleDeg, clamp, lerp } from './utils';

// 默认配置
export { defaults } from './config/defaults';