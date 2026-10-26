/**
 * @file 矩形工具
 *
 * 交互：按下确定起点并放入一个 1×1 草稿矩形 → 拖动实时改写左上角与宽高 →
 * 抬起时开启选中、修正最小包围盒并写入一个撤销点。
 *
 * 注意：草稿矩形在 mouse:down 时即 add 到画布，是为了让第一帧就有反馈；
 * 拖拽方向任意（支持从右下往左上拉），因此 left/top 需要按 Δ 的正负取较小值。
 *
 * @see src/primitives/createRect.ts
 * @see src/utils/pointer.ts
 */

import type { Point } from '../types';
import type { BaseToolInstance, ToolContext } from './createBaseTool';
import { getCanvasPointer } from '../utils';
import { createRect } from '../primitives';

/**
 * 创建矩形工具
 *
 * 副作用：绘制过程中会向画布添加/修改对象，抬起时通过 ctx.saveState 写历史。
 * 内部状态（起点、草稿对象引用）由闭包保存，每个画布应各自创建一份实例。
 *
 * @param ctx 工具上下文，用于读取实时颜色/线宽、保存历史、修正包围盒
 * @returns 实现 BaseToolInstance 的矩形工具
 *
 * @example
 * const tool = createRectTool({
 *   getConfig: () => ({ color: '#ff3b30', lineWidth: 4, fontSize: 20 }),
 *   saveState: () => {},
 *   ensureMinBoundingBox: (obj) => {},
 * });
 * tool.onMouseDown({ e: event }, canvas);
 */
export function createRectTool(ctx: ToolContext): BaseToolInstance {
  // ---- 私有状态：一次绘制的中间数据 ----
  /** 按下时的画布坐标，null 表示当前没有进行中的绘制 */
  let startPoint: Point | null = null;
  /** 草稿矩形引用，抬起后置空（对象本身留在画布上） */
  let shape: any = null;
  /** 是否处于「按下未抬起」状态，作为各回调的守卫 */
  let drawing = false;

  return {
    id: 'rect',

    /**
     * 按下：记录起点并创建草稿矩形
     * 右键与「点在已有对象上」两种情况直接返回，交给 Fabric 处理选择/拖拽。
     *
     * 副作用：向画布添加一个 1×1 矩形并立即参与渲染。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent，opt.target 为命中的对象
     * @param canvas 当前画布实例，提供 add / 尺寸查询
     */
    onMouseDown(opt: any, canvas: any) {
      const e = opt.e as MouseEvent;
      if (e.button === 2 || opt.target) return;
      // 用下层画布的逻辑尺寸换算，保证高 DPI 下坐标仍为 CSS 像素
      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      startPoint = p;
      drawing = true;
      const cfg = ctx.getConfig();
      shape = createRect(p, cfg.color, cfg.lineWidth);
      canvas.add(shape);
    },

    /**
     * 移动：按起点到当前点的位移更新矩形的左上角与宽高
     * 使用 requestRenderAll 而非 renderAll，避免高频 move 事件阻塞主线程。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent
     * @param canvas 当前画布实例
     */
    onMouseMove(opt: any, canvas: any) {
      if (!drawing || !startPoint || !shape) return;
      const e = opt.e as MouseEvent;
      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      const w = p.x - startPoint.x;
      const h = p.y - startPoint.y;
      shape.set({
        // 反向拖拽时起点在右下，需取较小的坐标作为左上角
        left: w >= 0 ? startPoint.x : p.x,
        top: h >= 0 ? startPoint.y : p.y,
        // 至少 1px：0 宽高会让 Fabric 包围盒退化，控制点方向会翻转
        width: Math.abs(w) || 1,
        height: Math.abs(h) || 1,
      });
      // 尺寸变化后同步包围盒，否则命中区域仍是旧的 1×1
      shape.setCoords();
      canvas.requestRenderAll();
    },

    /**
     * 抬起：定稿并保存历史
     * 副作用：开启对象可选中、可能缩放包围盒到最小尺寸、写历史、重绘。
     *
     * @param _opt Fabric 事件信息（本工具不需要坐标，故忽略）
     * @param canvas 当前画布实例
     */
    onMouseUp(_opt: any, canvas: any) {
      if (drawing && shape) {
        shape.set({ selectable: true, evented: true });
        // 极小矩形（快速点一下）放大到最小尺寸，否则拖不出控制点
        ctx.ensureMinBoundingBox(shape);
        shape.setCoords();
        canvas.requestRenderAll();
        // 绘制完成 → 保存历史（撤销点）
        ctx.saveState();
      }
      drawing = false;
      startPoint = null;
      shape = null;
    },

    /** 销毁：仅清理草稿引用，已落到画布上的图形不受影响 */
    destroy() {
      drawing = false;
      startPoint = null;
      shape = null;
    },
  };
}
