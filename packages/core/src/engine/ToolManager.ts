import type { ToolId } from '../types';
import type { BaseTool } from '../tools/BaseTool';
import { EventBus } from './EventBus';

/**
 * 工具管理器
 * 负责工具的注册、切换和调度
 */
export class ToolManager {
  private tools: Map<ToolId, BaseTool> = new Map();
  private currentToolId: ToolId = '';
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 注册工具
   */
  register(tool: BaseTool): void {
    this.tools.set(tool.id, tool);
    tool.setEventBus(this.eventBus);
  }

  /**
   * 切换工具
   */
  switchTool(id: ToolId): void {
    // 退出当前工具
    if (this.currentToolId) {
      const current = this.tools.get(this.currentToolId);
      if (current) {
        current.deactivate();
        current.destroy();
      }
    }

    this.currentToolId = id;

    // 激活新工具
    if (id) {
      const tool = this.tools.get(id);
      if (tool) {
        tool.activate();
        this.eventBus.emit('tool:changed', { toolId: id });
        return;
      }
      console.warn(`工具 "${id}" 未注册`);
    }
    this.eventBus.emit('tool:changed', { toolId: '' });
  }

  /**
   * 获取当前工具
   */
  getCurrentTool(): BaseTool | null {
    return this.tools.get(this.currentToolId) || null;
  }

  /**
   * 获取当前工具 ID
   */
  getCurrentToolId(): ToolId {
    return this.currentToolId;
  }

  /**
   * 检查工具是否激活
   */
  isToolActive(id: ToolId): boolean {
    return this.currentToolId === id;
  }

  /**
   * 销毁所有工具
   */
  destroy(): void {
    this.tools.forEach(tool => {
      tool.deactivate();
      tool.destroy();
    });
    this.tools.clear();
    this.currentToolId = '';
  }
}