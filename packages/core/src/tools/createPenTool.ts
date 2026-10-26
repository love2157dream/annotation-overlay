/**
 * @file 画笔工具
 *
 * 自由绘制能力完全由 Fabric 的 isDrawingMode + PencilBrush 提供，工具本身
 * 不处理任何鼠标事件，只提供 id 以满足「工具注册表 + 事件分派」的统一结构。
 *
 * 注意：画笔的路径由 Fabric 在内部创建并触发 `path:created`，历史保存发生在
 * 引擎的该事件回调里（ensureMinBoundingBox + saveState），不要在此重复保存。
 *
 * @see src/engine/createCanvasEngine.ts
 */

import type { ToolConfigLike, ToolContext } from './createBaseTool';

/**
 * 创建画笔工具（空实现）
 *
 * 副作用：无。引擎在 selectTool('pen') 时打开 isDrawingMode 并同步笔刷颜色/宽度，
 * 笔刷设置不在这里完成。
 *
 * @param _ctx 工具上下文，画笔无需读写配置与历史，故不使用（下划线表示有意忽略）
 * @returns 带有 pen id 与三个空事件处理函数的工具对象
 *
 * @example
 * tools.set('pen', createPenTool(ctx));
 * canvas.isDrawingMode = true; // 实际开启绘制由引擎负责
 */
export function createPenTool(_ctx: ToolContext) {
  return {
    id: 'pen' as const,
    // 以下三个事件均为空：绘制由 Fabric 画笔内部驱动，无需逐帧干预
    onMouseDown: () => {},
    onMouseMove: () => {},
    onMouseUp: () => {},
  };
}

/** 画笔工具的配置形状别名，与公共配置保持一致（仅颜色与线宽生效） */
export type PenToolConfig = ToolConfigLike;
