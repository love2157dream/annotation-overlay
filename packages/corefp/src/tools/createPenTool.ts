import type { ToolId, ToolConfig } from '../types';
import { createBaseTool } from './createBaseTool';

export function createPenTool(config: ToolConfig) {
  const tool = createBaseTool('pen' as ToolId, config);
  // 画笔工具完全由 Fabric 的 isDrawingMode 驱动，无需额外逻辑
  return tool;
}