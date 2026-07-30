/** 工具类型 */
export type ToolId = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | '';

/** 工具配置 */
export interface ToolConfig {
  color: string;
  lineWidth: number;
  fontSize: number;
}