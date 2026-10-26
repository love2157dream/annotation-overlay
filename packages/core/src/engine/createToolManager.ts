/**
 * @file 工具管理器工厂
 *
 * 维护「工具 id → 工具实例」注册表与当前工具 id，是引擎内部工具分派的
 * 轻量替代实现（引擎 createCanvasEngine 出于历史原因内联了同样的逻辑）。
 * 供自定义场景或单测单独使用，不直接创建画布。
 *
 * 注意：这里只切换 id，不做任何收尾动作；折线结束、文字退出等副作用
 * 由调用方（引擎 selectTool）负责，否则会丢历史或残留正在编辑的空文字。
 *
 * @see src/engine/createCanvasEngine.ts
 * @see src/tools/createBaseTool.ts
 */

import type { ToolId } from '../types';
import type { BaseToolInstance } from '../tools/createBaseTool';

/**
 * 创建工具管理器 (纯函数工厂)
 * 负责工具注册表与当前工具 id 的维护；
 * 工具切换时的收尾逻辑（折线结束 / 文字退出）由引擎的 selectTool 统一处理。
 *
 * @returns 管理器对象：注册、切换、查询当前工具、销毁
 *
 * @example
 * const tm = createToolManager();
 * tm.register(createRectTool(ctx));
 * tm.switchTool('rect');
 * tm.getCurrentTool()?.onMouseDown(opt, canvas);
 */
export function createToolManager() {
  // ---- 私有状态 ----
  /** 工具注册表，key 为工具自身声明的 id */
  const tools = new Map<ToolId, BaseToolInstance>();
  /** 当前工具 id，'' 表示选择模式（无激活工具） */
  let currentToolId: ToolId = '';

  return {
    /**
     * 注册工具
     * 副作用：写入注册表；同一 id 重复注册会覆盖旧实例（旧实例的清理需自行负责）。
     * 注意：这里用入参 tool 覆盖，而不是先 destroy 旧实例，注册顺序由调用方保证。
     * @param tool 工具实例，必须带有唯一的 id
     */
    register(tool: BaseToolInstance): void {
      tools.set(tool.id, tool);
    },

    /**
     * 切换当前工具 id
     * 副作用：修改闭包内的 currentToolId；不会调用旧工具的清理逻辑，
     * 也不校验 id 是否已注册（未注册时 getCurrentTool 返回 null）。
     * @param id 目标工具 id，'' 表示退出到选择模式
     */
    switchTool(id: ToolId): void {
      currentToolId = id;
    },

    /**
     * 取当前工具实例
     * @returns 当前 id 对应的实例；未注册或处于选择模式（''）时为 null
     */
    getCurrentTool(): BaseToolInstance | null {
      return tools.get(currentToolId) || null;
    },

    /** 取当前工具 id（'' 表示选择模式） */
    getCurrentToolId(): ToolId {
      return currentToolId;
    },

    /**
     * 判断某工具是否为当前工具
     * @param id 待比较的工具 id
     * @returns 与当前 id 完全相等时为 true
     */
    isToolActive(id: ToolId): boolean {
      return currentToolId === id;
    },

    /**
     * 销毁管理器
     * 副作用：依次调用各工具的 destroy（清理草稿对象引用等），清空注册表并复位当前 id。
     */
    destroy(): void {
      for (const tool of tools.values()) {
        tool.destroy?.();
      }
      tools.clear();
      currentToolId = '';
    },
  };
}
