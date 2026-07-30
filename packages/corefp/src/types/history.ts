/** 历史记录状态 */
export interface HistoryState {
  objects: any[];
}

/** 历史记录管理器接口 */
export interface IHistoryManager {
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  length: number;
  saveState(objects: any[]): void;
  undo(): HistoryState | null;
  redo(): HistoryState | null;
  reset(): void;
}