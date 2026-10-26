/**
 * @file 快照式历史管理器
 *
 * 采用「快照数组 + 指针」模型实现撤销/重做：每次 saveState 把当前全部标注对象
 * 序列化后追加，undo/redo 只移动指针并返回目标快照，不负责重建 Fabric 对象。
 * 引擎 createCanvasEngine 内联了同样的逻辑（并与异步 enliven 流程绑定），
 * 本工厂供独立复用与单测。
 *
 * 注意：返回的快照只是 JSON 数据，调用方需自行用 fabric.util.enlivenObjects
 * 异步还原；isRestoring 为 true 期间 saveState 会被忽略，避免恢复过程写入脏数据。
 *
 * @see src/types/history.ts
 * @see src/engine/createCanvasEngine.ts
 */

import type { IHistoryManager, HistoryState } from '../types';

/**
 * 创建历史管理器实例 (纯函数工厂)
 *
 * @returns 实现 IHistoryManager 的对象；状态全部封装在闭包中，实例间互不影响
 *
 * @example
 * const hm = createHistoryManager();
 * hm.saveState(canvas.getObjects());   // 初始帧
 * hm.saveState(canvas.getObjects());   // 绘制一帧
 * if (hm.canUndo) {
 *   const prev = hm.undo();            // prev.objects 为上一帧的序列化数据
 *   fabric.util.enlivenObjects(prev!.objects);
 * }
 */
export function createHistoryManager(): IHistoryManager {
  // ---- 私有状态 ----
  /** 快照栈，索引 0 通常是初始空画布 */
  let history: HistoryState[] = [];
  /** 当前指针，-1 表示尚无快照 */
  let index = -1;
  /** 恢复标志：为 true 时 saveState 直接返回，防止异步恢复期间产生新撤销点 */
  let isRestoring = false;
  /** 保存重入标志：防止 toJSON 过程中再次触发 saveState 造成递归 */
  let isSaving = false;

  return {
    /** 指针 > 0 才可撤销：索引 0 是初始空快照，撤到它等于清空，无需暴露给 UI */
    get canUndo() { return index > 0; },
    /** 指针未到末尾时可重做（末尾之后的分支已在 saveState 时被截断） */
    get canRedo() { return index < history.length - 1; },
    /** 当前指针，从 0 开始；-1 表示空历史 */
    get currentIndex() { return index; },
    /** 快照总数 */
    get length() { return history.length; },
    /** 是否处于恢复过程中，UI 可据此禁用撤销/重做按钮 */
    get isRestoring() { return isRestoring; },

    /**
     * 追加一帧快照
     *
     * 副作用：序列化入参对象（调用其 toJSON）、可能截断重做分支、移动指针。
     * 处于恢复中或正在保存时直接忽略，避免递归与脏写入。
     *
     * @param objects 当前画布上的标注对象集合（不应包含背景图）
     */
    saveState(objects: any[]) {
      if (isRestoring || isSaving) return;
      isSaving = true;
      try {
        // 必须序列化：直接存对象引用会让后续修改同时改到历史帧
        const serialized = objects.map(o => o.toJSON());
        // 指针不在末尾说明存在「未来分支」，新操作将其丢弃（标准撤销栈语义）
        if (index < history.length - 1) history = history.slice(0, index + 1);
        history.push({ objects: serialized });
        index = history.length - 1;
      } finally { isSaving = false; }
    },

    /**
     * 撤销一步
     * 副作用：指针减一；isRestoring 仅在取快照瞬间为 true，
     * 因此异步 enliven 完成后调用方需自行保证不再触发保存。
     * @returns 目标快照；已在起点时返回 null 且不改变指针
     */
    undo() {
      if (!this.canUndo) return null;
      isRestoring = true;
      index--;
      const state = history[index];
      isRestoring = false;
      return state;
    },

    /**
     * 重做一步
     * @returns 目标快照；已在末尾时返回 null 且不改变指针
     */
    redo() {
      if (!this.canRedo) return null;
      isRestoring = true;
      index++;
      const state = history[index];
      isRestoring = false;
      return state;
    },

    /**
     * 清空历史
     * 副作用：丢弃全部快照、指针复位为 -1，并清除两个运行标志；
     * 用于画布销毁或重新初始化，但不会触碰画布内容。
     */
    reset() {
      history = [];
      index = -1;
      isRestoring = false;
      isSaving = false;
    },
  };
}
