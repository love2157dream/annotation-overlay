/**
 * @file 历史记录相关类型
 *
 * 定义快照结构与历史管理器契约。快照以 Fabric 对象的 toJSON 结果保存，
 * 恢复时需用 fabric.util.enlivenObjects 异步重建实例。
 *
 * @see src/history/createHistoryManager.ts
 * @see src/engine/createCanvasEngine.ts
 */

/**
 * 历史记录状态（一帧快照）
 * 只保存非背景对象，背景截图由画布自身持有，不参与撤销。
 */
export interface HistoryState {
  /** 序列化后的标注对象数组，元素为 Fabric 对象的 toJSON() 结果 */
  objects: any[];
}

/**
 * 历史记录管理器接口
 * 采用「快照数组 + 指针」模型：指针之前为可撤销历史，之后为可重做分支。
 */
export interface IHistoryManager {
  /** 是否可撤销：指针 > 0（索引 0 为初始空快照，撤销到它没有意义） */
  canUndo: boolean;
  /** 是否可重做：指针 < 快照总数 - 1 */
  canRedo: boolean;
  /** 当前指针位置，从 0 开始；-1 表示尚无快照 */
  currentIndex: number;
  /** 快照总数 */
  length: number;
  /** 是否正在恢复状态（恢复期间跳过 saveState） */
  isRestoring: boolean;
  /**
   * 追加一帧快照
   * 副作用：指针不在末尾时会先截断重做分支。
   * @param objects 当前画布上的标注对象，内部逐个调用 toJSON 序列化
   */
  saveState(objects: any[]): void;
  /**
   * 撤销一步
   * @returns 目标快照；已无可撤销内容时返回 null（此时不做任何改动）
   */
  undo(): HistoryState | null;
  /**
   * 重做一步
   * @returns 目标快照；已无可重做内容时返回 null
   */
  redo(): HistoryState | null;
  /** 清空历史并把指针复位到 -1（销毁画布时调用） */
  reset(): void;
}
