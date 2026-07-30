import type { ToolId, ToolConfig } from '../types';
import type { IEventBus } from '../types/events';

/**
 * 工具实例类型
 */
export type BaseToolInstance = {
  id: ToolId;
  isActive: boolean;
  getConfig: () => ToolConfig;
  updateConfig: (cfg: Partial<ToolConfig>) => void;
  setEventBus?: (bus: IEventBus) => void;
  activate?: () => void;
  deactivate?: () => void;
  onMouseDown: (opt: any, canvas: any) => void;
  onMouseMove: (opt: any, canvas: any) => void;
  onMouseUp: (opt: any, canvas: any) => void;
  onDblClick?: (opt: any, canvas: any) => void;
  destroy?: () => void;
};

/**
 * 创建基础工具 (纯函数工厂)
 * 所有工具都基于此工厂创建，实现代码复用
 */
export function createBaseTool(id: ToolId, config: ToolConfig): BaseToolInstance {
  let currentConfig = { ...config };
  let eventBus: IEventBus | null = null;
  let isActive = false;

  return {
    id,
    isActive,

    getConfig: () => currentConfig,
    updateConfig: (cfg: Partial<ToolConfig>) => {
      currentConfig = { ...currentConfig, ...cfg };
    },

    setEventBus: (bus: IEventBus) => { eventBus = bus; },

    activate: () => { isActive = true; },
    deactivate: () => { isActive = false; },

    // 默认空实现，子类通过覆盖来定制
    onMouseDown: () => {},
    onMouseMove: () => {},
    onMouseUp: () => {},

    destroy: () => { isActive = false; },
  };
}