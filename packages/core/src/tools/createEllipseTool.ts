/**
 * @file 椭圆工具
 *
 * 交互：按下确定起点并放入半径 1 的草稿椭圆 → 拖动更新中心点与 rx/ry →
 * 抬起时开启选中、修正最小包围盒并写入一个撤销点。
 *
 * 注意：createEllipse 把 originX/originY 设为 center，此时 left/top 表示
 * **中心点**，所以拖动时既要取 `(起点+当前点)/2` 作为中心，也要用 `|Δ|/2`
 * 作为半径；拖拽方向任意。
 *
 * @see src/primitives/createEllipse.ts
 * @see src/utils/pointer.ts
 */

import type { Point } from '../types';
import type { BaseToolInstance, ToolContext } from './createBaseTool';
import { getCanvasPointer } from '../utils';
import { createEllipse } from '../primitives';

/**
 * 创建椭圆工具
 *
 * 副作用：绘制过程中修改画布对象，抬起时通过 ctx.saveState 写历史。
 *
 * @param ctx 工具上下文，用于读取实时颜色/线宽、保存历史、修正包围盒
 * @returns 实现 BaseToolInstance 的椭圆工具
 *
 * @example
 * const tool = createEllipseTool(ctx);
 * engine.selectTool('ellipse'); // 之后鼠标事件由引擎转发到 tool
 */
export function createEllipseTool(ctx: ToolContext): BaseToolInstance {
  // ---- 私有状态：一次绘制的中间数据 ----
  /** 按下时的画布坐标（椭圆的包围盒起点，非中心），null 表示未在绘制 */
  let startPoint: Point | null = null;
  /** 草稿椭圆引用，抬起后置空 */
  let shape: any = null;
  /** 是否处于「按下未抬起」状态 */
  let drawing = false;

  return {
    id: 'ellipse',

    /**
     * 按下：记录起点并创建草稿椭圆
     * 右键与点在已有对象上时直接返回，交给 Fabric 处理选择/拖拽。
     *
     * 副作用：向画布添加一个半径 1 的椭圆并立即参与渲染。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent，opt.target 为命中的对象
     * @param canvas 当前画布实例
     */
    onMouseDown(opt: any, canvas: any) {
      const e = opt.e as MouseEvent;
      if (e.button === 2 || opt.target) return;
      // 逻辑坐标换算：与画布 CSS 尺寸解耦，兼容高 DPI
      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      startPoint = p;
      drawing = true;
      const cfg = ctx.getConfig();
      shape = createEllipse(p, cfg.color, cfg.lineWidth);
      canvas.add(shape);
    },

    /**
     * 移动：以起点与当前点的中点为圆心，半边长作为 rx/ry
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
        // 中心点：两点中位，与 createEllipse 的 center 原点对应
        left: (startPoint.x + p.x) / 2,
        top: (startPoint.y + p.y) / 2,
        // 半径取位移绝对值的一半；`|| 1` 防止单轴未移动时半径为 0
        rx: Math.abs(w) / 2 || 1,
        ry: Math.abs(h) / 2 || 1,
      });
      // 半径变化后必须重算包围盒，否则选中框与命中区域滞后
      shape.setCoords();
      canvas.requestRenderAll();
    },

    /**
     * 抬起：定稿并保存历史
     * 副作用：开启对象可选中、可能缩放包围盒、写历史、重绘。
     *
     * @param _opt Fabric 事件信息（本工具不需要坐标，故忽略）
     * @param canvas 当前画布实例
     */
    onMouseUp(_opt: any, canvas: any) {
      if (drawing && shape) {
        shape.set({ selectable: true, evented: true });
        // 极小椭圆（单击未拖动）放大到最小尺寸，避免控制点退化
        ctx.ensureMinBoundingBox(shape);
        shape.setCoords();
        canvas.requestRenderAll();
        // 一次绘制对应一个撤销点
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
