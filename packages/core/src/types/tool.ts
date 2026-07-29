/**
 * 工具类型定义
 * 定义所有支持的绘制工具 ID
 */
export type ToolId = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | '';

/**
 * 工具状态
 */
export interface ToolState {
  currentTool: ToolId;
  isDrawing: boolean;
  isTextEditing: boolean;
}

/**
 * 工具配置
 */
export interface ToolConfig {
  color: string;
  lineWidth: number;
  fontSize: number;
}