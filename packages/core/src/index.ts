/**
 * @file 核心包统一出口
 *
 * 汇总引擎、工具、历史、截图、控制手柄、图形工厂、类型与工具函数，
 * 供 Vue3 / React / Angular 三端适配层以 `@laoliangfe/annotation-overlay-core`
 * 单一入口引入，避免适配层深入 src 内部路径。
 * 注意：本文件只做 re-export，不产生任何运行时代码与副作用。
 *
 * @see src/engine/createCanvasEngine.ts
 * @see src/types/index.ts
 */

// ---- 引擎 ----
/** 事件总线工厂：跨端 UI 与引擎解耦的轻量发布订阅实现 */
export { createEventBus } from './engine/createEventBus';
/** 工具管理器工厂：维护工具注册表与当前工具 id（通用版，引擎内部自有一份实现） */
export { createToolManager } from './engine/createToolManager';
/** 画布引擎工厂：本包核心，负责截图、画布生命周期、工具分派、历史与导出 */
export { createCanvasEngine, captureOnly } from './engine/createCanvasEngine';
/** 引擎对外类型：实例契约 CanvasEngineInstance 与回调集合 CanvasEngineCallbacks */
export type { CanvasEngineInstance, CanvasEngineCallbacks } from './engine/createCanvasEngine';

// ---- 工具 ----
/** 六个绘图工具的工厂函数（画笔 / 矩形 / 椭圆 / 箭头 / 折线 / 文字）及公共骨架 */
export {
  createBaseTool,
  createPenTool,
  createRectTool,
  createEllipseTool,
  createArrowTool,
  createPolylineTool,
  createTextTool,
} from './tools';
/** 工具实例契约：引擎按该接口分派鼠标事件 */
export type { BaseToolInstance } from './tools/createBaseTool';

// ---- 历史 ----
/** 历史管理器工厂：快照式撤销/重做（引擎内部另行内联实现，此工厂供独立使用） */
export { createHistoryManager } from './history/createHistoryManager';

// ---- 截图 ----
/** DOM 截图：借助 @zumer/snapdom 把目标元素渲染成 PNG dataURL */
export { domCapture } from './capture';

// ---- 控制手柄 ----
/** 选中态手柄样式配置与可选中/禁选中开关 */
export { getDefaultControlConfig, applyControlConfig, enableSelectable, disableSelectable } from './controls';

// ---- 图形工厂 ----
/** 基础图形构造：矩形 / 椭圆 / 箭头（Group）/ 折线，均按给定样式初始化 */
export { createRect, createEllipse, createArrow, createPolyline } from './primitives';

// ---- 类型 ----
/** 全部公共类型（含 Point / Rect / ToolId / CanvasState / IHistoryManager 等） */
export * from './types';

// ---- 工具函数 ----
/** 坐标换算、包围盒修正、距离/角度/取整等纯函数 */
export { getCanvasPointer, ensureMinBoundingBox, distance, angle, angleDeg, clamp } from './utils';

// ---- 默认配置 ----
/** 默认配色、线宽、字号、调色板与控制手柄参数 */
export { defaults } from './config/defaults';
