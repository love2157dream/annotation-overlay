/**
 * @file 工具模块出口
 *
 * 汇总工具公共契约与六个具体工具工厂。引擎在创建时按 ToolId 各实例化一份，
 * 通过统一事件契约接收鼠标事件，因此新增工具只需实现 BaseToolInstance
 * 并在此处导出即可接入。
 *
 * @see src/tools/createBaseTool.ts
 * @see src/engine/createCanvasEngine.ts
 */

/** 公共骨架与上下文/事件契约（ToolContext / BaseToolInstance） */
export { createBaseTool } from './createBaseTool';
/** 画笔工具：空实现，绘制由 Fabric isDrawingMode 驱动 */
export { createPenTool } from './createPenTool';
/** 矩形工具：拖拽绘制，抬起写历史 */
export { createRectTool } from './createRectTool';
/** 椭圆工具：拖拽绘制，中心原点 */
export { createEllipseTool } from './createEllipseTool';
/** 箭头工具：拖拽绘制，每次移动重建 Group */
export { createArrowTool } from './createArrowTool';
/** 折线工具：逐点点击，双击/右键结束 */
export { createPolylineTool } from './createPolylineTool';
/** 文字工具：点击创建 IText 并延迟进入编辑 */
export { createTextTool } from './createTextTool';
