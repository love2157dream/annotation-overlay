import type { IHistoryManager, HistoryState } from '../types';

export function createHistoryManager(): IHistoryManager {
  let history: HistoryState[] = [];
  let index = -1;
  let isRestoring = false;
  let isSaving = false;

  return {
    get canUndo() { return index > 0; },
    get canRedo() { return index < history.length - 1; },
    get currentIndex() { return index; },
    get length() { return history.length; },

    saveState(objects: any[]) {
      if (isRestoring || isSaving) return;
      isSaving = true;
      try {
        const serialized = objects.map(o => o.toJSON());
        if (index < history.length - 1) history = history.slice(0, index + 1);
        history.push({ objects: serialized });
        index = history.length - 1;
      } finally { isSaving = false; }
    },

    undo() {
      if (!this.canUndo) return null;
      isRestoring = true;
      index--;
      const state = history[index];
      isRestoring = false;
      return state;
    },

    redo() {
      if (!this.canRedo) return null;
      isRestoring = true;
      index++;
      const state = history[index];
      isRestoring = false;
      return state;
    },

    reset() {
      history = [];
      index = -1;
      isRestoring = false;
      isSaving = false;
    },
  };
}