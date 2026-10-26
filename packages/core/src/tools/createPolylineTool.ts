/**
 * @file 折线工具
 *
 * 交互：点击逐点添加 → 移动时末点跟随鼠标形成预览 → 双击 / 右键 / 切换工具
 * 结束绘制并写入一个撤销点。
 *
 * 点集约定：数组最后一个点始终是「预览点」，前面的点才是已确定的顶点。
 * 因此结束时要弹掉预览点，否则会在鼠标最后停留处多出一段重复线段。
 *
 * 注意：折线进行中时，无论点击处是否有对象都应继续加点（引擎在 mouse:down
 * 中优先转发给本工具），这与其它工具「点在对象上即交给 Fabric」的策略不同。
 *
 * @see src/utils/fabricHelper.ts
 * @see src/engine/createCanvasEngine.ts
 */

import type { Point } from '../types';
import type { BaseToolInstance, ToolContext } from './createBaseTool';
import { getCanvasPointer, rebuildPolyline } from '../utils';

/**
 * 折线工具：点击加点 → 移动预览末点 → 双击 / 右键结束并保存历史
 * 进行中的折线在点击时优先于"选中已有对象"处理（与原版一致）
 *
 * @param ctx 工具上下文，用于读取实时颜色/线宽、保存历史、修正包围盒
 * @returns 实现 BaseToolInstance 的折线工具，额外提供 isDrawing 供引擎判断优先级
 *
 * @example
 * const tool = createPolylineTool(ctx);
 * engine.selectTool('line');
 * // 之后每次点击都会追加顶点，双击或右键结束
 */
export function createPolylineTool(ctx: ToolContext): BaseToolInstance {
  // ---- 私有状态：一次绘制的中间数据 ----
  /** 顶点序列，末位为预览点；空数组表示未在绘制 */
  let points: Point[] = [];
  /** 当前折线对象引用，每次重建后指向新对象 */
  let polyline: any = null;
  /** 是否处于「已落首点、未结束」状态（折线可跨多次点击，不是按下-抬起） */
  let drawing = false;

  /**
   * 完成折线：移除多余预览点、修正包围盒、保存历史
   *
   * 副作用：可能重建画布中的折线对象、写历史、重绘；结束后清空全部私有状态。
   * 幂等：未在绘制时调用只做状态复位，不会写历史。
   *
   * @param canvas 当前画布实例，用于重建对象与重绘
   */
  const finalize = (canvas: any) => {
    if (drawing && polyline) {
      // 点数 > 2 说明末位是纯预览点，弹掉后才是真实顶点（2 点是最小合法线段）
      if (points.length > 2) {
        points.pop();
        polyline = rebuildPolyline(canvas, polyline, points, ctx.getConfig().color, ctx.getConfig().lineWidth);
      }
      // 未拖动就结束（两点重合）时包围盒退化，放大后才能被选中
      ctx.ensureMinBoundingBox(polyline);
      polyline.setCoords();
      canvas.requestRenderAll();
      ctx.saveState();
    }
    drawing = false;
    points = [];
    polyline = null;
  };

  return {
    id: 'line',

    /** 是否有未完成的折线；引擎据此在 mouse:down 时优先转发点击 */
    isDrawing: () => drawing,

    /**
     * 按下：添加顶点
     * 首次按下同时放入起点与预览点；后续按下把预览点固定为当前点，再追加新预览点。
     *
     * 副作用：重建（remove + add）画布中的折线对象并重绘。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent
     * @param canvas 当前画布实例
     */
    onMouseDown(opt: any, canvas: any) {
      const e = opt.e as MouseEvent;
      // 右键：结束折线（兜底，通常走 contextmenu 转发）
      if (e.button === 2) { finalize(canvas); return; }

      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

      if (!drawing) {
        // 第一个点：起点和预览点重合
        points = [{ x: p.x, y: p.y }, { x: p.x, y: p.y }];
        drawing = true;
      } else {
        // 后续点击：固定预览点并追加新预览点（无论是否点在已有对象上）
        points[points.length - 1] = { x: p.x, y: p.y };
        points.push({ x: p.x, y: p.y });
      }
      const cfg = ctx.getConfig();
      polyline = rebuildPolyline(canvas, polyline, points, cfg.color, cfg.lineWidth);
      canvas.requestRenderAll();
    },

    /**
     * 移动：让末位预览点跟随鼠标
     *
     * 副作用：每次移动都重建折线对象（Polyline 点集不可原地高效更新），并重绘。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent
     * @param canvas 当前画布实例
     */
    onMouseMove(opt: any, canvas: any) {
      if (!drawing || !polyline || points.length === 0) return;
      const e = opt.e as MouseEvent;
      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      // 预览末点跟随鼠标
      points[points.length - 1] = { x: p.x, y: p.y };
      const cfg = ctx.getConfig();
      polyline = rebuildPolyline(canvas, polyline, points, cfg.color, cfg.lineWidth);
      canvas.requestRenderAll();
    },

    /**
     * 双击：结束折线
     * @param _opt Fabric 事件信息（结束点已在最后一次按下/移动中记录，故忽略）
     * @param canvas 当前画布实例
     */
    onDblClick(_opt: any, canvas: any) {
      finalize(canvas);
    },

    /**
     * 右键：结束折线（由引擎在 contextmenu 捕获阶段转发）
     * @param canvas 当前画布实例
     */
    onContextMenu(canvas: any) {
      finalize(canvas);
    },

    /** 抬起不做处理：折线以「点击」为粒度，抬起不代表结束 */
    onMouseUp: () => {},

    /** 销毁：清理顶点与对象引用，防止闭包持有已销毁画布的对象 */
    destroy() {
      drawing = false;
      points = [];
      polyline = null;
    },
  };
}
