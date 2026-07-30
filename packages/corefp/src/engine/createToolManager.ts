import type { ToolId } from '../types';
import type { IEventBus } from '../types/events';
import type { BaseToolInstance } from '../tools/createBaseTool';

/**
 * 创建工具管理器 (纯函数工厂)
 */
export function createToolManager(eventBus: IEventBus) {
  const tools = new Map<ToolId, BaseToolInstance>();
  let currentToolId: ToolId = '';

  return {
    register(tool: BaseToolInstance): void {
      tools.set(tool.id, tool);
      tool.setEventBus?.(eventBus);
    },

    switchTool(id: ToolId): void {
      const prev = currentToolId ? tools.get(currentToolId) : null;
      if (prev) { prev.deactivate?.(); prev.destroy?.(); }

      currentToolId = id;

      if (id) {
        const next = tools.get(id);
        if (next) {
          next.activate?.();
          eventBus.emit('tool:changed', { toolId: id });
          return;
        }
        console.warn(`工具 "${id}" 未注册`);
      }
      eventBus.emit('tool:changed', { toolId: '' });
    },

    getCurrentTool(): BaseToolInstance | null {
      return tools.get(currentToolId) || null;
    },

    getCurrentToolId(): ToolId {
      return currentToolId;
    },

    isToolActive(id: ToolId): boolean {
      return currentToolId === id;
    },

    destroy(): void {
      for (const tool of tools.values()) {
        tool.deactivate?.();
        tool.destroy?.();
      }
      tools.clear();
      currentToolId = '';
    },
  };
}