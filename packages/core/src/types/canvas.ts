/**
 * @file 画布事件类型与画布状态类型
 *
 * 描述引擎对外可广播的事件名（供事件总线/适配层订阅）以及适配层渲染工具栏
 * 所需的最小状态快照。注意：引擎主流程实际以 CanvasEngineCallbacks 回调形式
 * 通知 UI，这里的枚举为事件总线与自定义扩展保留。
 *
 * @see src/engine/createCanvasEngine.ts
 * @see src/types/events.ts
 */

import type { ToolId } from './tool';

/**
 * 画布事件类型
 *
 * - `'tool:changed'`：当前工具切换完成，payload 为新 ToolId；
 * - `'tool:start'`：一次绘制开始（按下），payload 为起点坐标；
 * - `'tool:move'`：绘制过程移动，payload 为当前坐标；
 * - `'tool:end'`：一次绘制结束（抬起/双击/右键），payload 为终点坐标；
 * - `'object:selected'`：选中对象，payload 为 SelectionStyleInfo；
 * - `'object:modified'`：对象被拖拽/缩放/旋转，payload 为该对象；
 * - `'state:changed'`：历史状态变化，payload 为 HistoryInfo；
 * - `'text:editing:start'`：文字进入编辑；
 * - `'text:editing:end'`：文字退出编辑。
 */
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

/** 画布事件数据：事件总线 emit 时统一包装成该结构交给监听器 */
export interface CanvasEventData {
  /** 事件名，取自 CanvasEventType；自定义事件可传任意字符串 */
  type: CanvasEventType;
  /** 事件负载，形状由具体事件决定（见 CanvasEventType 各项说明），无负载时为 undefined */
  payload?: any;
}

/**
 * 画布状态快照
 * 用于适配层渲染工具栏可用性；非响应式对象，需每次重新获取。
 */
export interface CanvasState {
  /** 当前工具 id，'' 表示选择模式 */
  toolId: ToolId;
  /** 是否可撤销（历史指针 > 0） */
  canUndo: boolean;
  /** 是否可重做（历史指针未到末尾） */
  canRedo: boolean;
  /** 画布上的标注对象数量，不含背景截图 */
  objectCount: number;
  /** 是否正处在一次绘制过程中（按下未抬起） */
  isDrawing: boolean;
}
