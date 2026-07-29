import type { IHistoryManager, HistoryState } from '../types';

/**
 * 历史记录管理器
 * 管理撤销/重做栈
 */
export class HistoryManager implements IHistoryManager {
  private history: HistoryState[] = [];
  private index: number = -1;
  public isRestoring: boolean = false;
  private isSaving: boolean = false;

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.history.length - 1;
  }

  get currentIndex(): number {
    return this.index;
  }

  get length(): number {
    return this.history.length;
  }

  /**
   * 保存状态
   */
  saveState(objects: any[]): void {
    if (this.isRestoring || this.isSaving) return;
    this.isSaving = true;
    try {
      const serialized = objects.map((obj) => obj.toJSON());
      if (this.index < this.history.length - 1) {
        this.history = this.history.slice(0, this.index + 1);
      }
      this.history.push({ objects: serialized });
      this.index = this.history.length - 1;
    } catch (e) {
      console.warn('保存历史失败:', e);
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 撤销
   */
  undo(): HistoryState | null {
    if (!this.canUndo) return null;
    this.isRestoring = true;
    this.index--;
    const state = this.history[this.index];
    this.isRestoring = false;
    return state;
  }

  /**
   * 重做
   */
  redo(): HistoryState | null {
    if (!this.canRedo) return null;
    this.isRestoring = true;
    this.index++;
    const state = this.history[this.index];
    this.isRestoring = false;
    return state;
  }

  /**
   * 重置
   */
  reset(): void {
    this.history = [];
    this.index = -1;
    this.isRestoring = false;
    this.isSaving = false;
  }
}