/**
 * @file 箭头工具
 *
 * 交互：按下记录起点并放置一个「零长度」箭头 → 每次移动丢弃旧 Group 并按
 * 起点/当前点整只重建 → 抬起时开启选中、修正最小包围盒并写入撤销点。
 *
 * 注意：这里选择「删除 + 新建 Group」而不是更新 Line 端点。因为箭头由
 * Line + Triangle 组成，改动子对象坐标后 Group 的包围盒与内部相对坐标会
 * 失去同步，表现为选中框错位、拖拽跳动。
 *
 * @see src/primitives/createArrow.ts
 */

import type { Point } from '../types';
import type { BaseToolInstance, ToolContext } from './createBaseTool';
import { getCanvasPointer } from '../utils';
import { createArrow } from '../primitives';

/**
 * 创建箭头工具
 *
 * 副作用：移动过程中反复 remove/add 画布对象，抬起时写历史。
 * 高频重建会产生较多临时对象，但箭头元素体积小，实测开销可接受。
 *
 * @param ctx 工具上下文，用于读取实时颜色/线宽、保存历史、修正包围盒
 * @returns 实现 BaseToolInstance 的箭头工具
 *
 * @example
 * const tool = createArrowTool(ctx);
 * tool.onMouseDown({ e: downEvent }, canvas);
 * tool.onMouseMove({ e: moveEvent }, canvas);
 * tool.onMouseUp({ e: upEvent }, canvas);
 */
export function createArrowTool(ctx: ToolContext): BaseToolInstance {
  // ---- 私有状态：一次绘制的中间数据 ----
  /** 箭头起点（尾端），null 表示未在绘制 */
  let startPoint: Point | null = null;
  /** 当前箭头 Group 引用，每次移动都会被替换 */
  let shape: any = null;
  /** 是否处于「按下未抬起」状态 */
  let drawing = false;

  return {
    id: 'arrow',

    /**
     * 按下：记录起点并创建一个起终点重合的箭头
     * 起终点重合时线段长度为 0，仅作为占位；下一次 move 就会被替换。
     *
     * 副作用：向画布添加一个 Group。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent，opt.target 为命中的对象
     * @param canvas 当前画布实例
     */
    onMouseDown(opt: any, canvas: any) {
      const e = opt.e as MouseEvent;
      if (e.button === 2 || opt.target) return;
      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      startPoint = p;
      drawing = true;
      const cfg = ctx.getConfig();
      shape = createArrow(p, p, cfg.color, cfg.lineWidth);
      canvas.add(shape);
    },

    /**
     * 移动：重建箭头以跟随鼠标
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent
     * @param canvas 当前画布实例
     */
    onMouseMove(opt: any, canvas: any) {
      if (!drawing || !startPoint) return;
      const e = opt.e as MouseEvent;
      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      // Fabric 的 Group 重建比逐点更新更可靠，与原版行为一致
      if (shape) canvas.remove(shape);
      const cfg = ctx.getConfig();
      shape = createArrow(startPoint, p, cfg.color, cfg.lineWidth);
      canvas.add(shape);
      canvas.requestRenderAll();
    },

    /**
     * 抬起：定稿并保存历史
     * 副作用：开启对象可选中、可能缩放包围盒、写历史、重绘。
     *
     * @param _opt Fabric 事件信息（终点已在最后一次 move 中体现，故忽略）
     * @param canvas 当前画布实例
     */
    onMouseUp(_opt: any, canvas: any) {
      if (drawing && shape) {
        shape.set({ selectable: true, evented: true });
        // 单击未拖动时 Group 退化，按最小尺寸放大以便后续能选中
        ctx.ensureMinBoundingBox(shape);
        shape.setCoords();
        canvas.requestRenderAll();
        ctx.saveState();
      }
      drawing = false;
      startPoint = null;
      shape = null;
    },

    /** 销毁：仅清理草稿引用，已落到画布上的箭头不受影响 */
    destroy() {
      drawing = false;
      startPoint = null;
      shape = null;
    },
  };
}
