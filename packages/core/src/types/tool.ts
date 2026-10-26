/**
 * @file 工具标识与工具配置类型
 *
 * 工具 id 是全链路（UI 按钮 → 引擎 selectTool → 工具实现 → 历史回读）的约定值。
 * 注意：'line' 对外表示折线工具（内部实现见 tools/createPolylineTool.ts），
 * 不是两点直线，命名沿用原版以免破坏适配层已有 API。
 *
 * @see src/types/canvas.ts
 * @see src/tools/createBaseTool.ts
 */

/**
 * 工具类型
 *
 * - `'pen'`：自由画笔，由 Fabric 的 isDrawingMode 驱动，落笔即生成 Path；
 * - `'line'`：折线，点击逐点添加，双击/右键结束；
 * - `'arrow'`：箭头，按下起点拖到终点；
 * - `'rect'`：矩形，按下拖拽绘制；
 * - `'ellipse'`：椭圆，按下拖拽绘制；
 * - `'text'`：文字，点击生成 IText 并进入编辑；
 * - `''`：无工具（普通选择模式），此时仅允许框选与拖拽已有对象。
 */
export type ToolId = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | '';

/**
 * 工具配置
 * 引擎持有唯一实例，工具每次落笔时通过 ToolContext.getConfig 读取实时值。
 */
export interface ToolConfig {
  /** 颜色，CSS 颜色字符串（默认 '#ff3b30'）；同时写回文字 cursorColor */
  color: string;
  /** 线宽，单位 px，默认 4；作用于描边与画笔笔刷宽度，箭头三角随其放大 */
  lineWidth: number;
  /** 字号，单位 px，默认 20；仅文字工具使用 */
  fontSize: number;
}
