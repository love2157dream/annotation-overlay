/**
 * @file 选中态手柄与对象的可交互性控制
 *
 * 统一管理 Fabric 对象选中后的视觉反馈（手柄形状/颜色/边框/虚线）与
 * selectable / evented 开关。引擎在选中对象、绘制结束、回读样式时调用，
 * 保证新绘制对象与历史恢复对象的交互表现完全一致。
 * 注意：applyControlConfig 会强制 `objectCaching = false` 并刷新坐标，
 * 这两步是必须的 —— 否则改色/缩放后可能命中旧缓存或点击区域错位。
 *
 * @see src/config/defaults.ts
 * @see src/engine/createCanvasEngine.ts
 */

import type { ControlConfig } from '../types';
import { defaults } from '../config/defaults';

/**
 * 读取默认手柄配置的浅拷贝
 * 返回拷贝而非 defaults.controls 本身，避免调用方修改后污染全局默认值。
 *
 * @returns 一份新的 ControlConfig，字段含义见类型定义
 *
 * @example
 * const cfg = getDefaultControlConfig();
 * cfg.cornerSize = 14; // 只影响这份拷贝
 */
export function getDefaultControlConfig(): ControlConfig {
  return { ...defaults.controls };
}

/**
 * 将手柄样式应用到某个 Fabric 对象
 *
 * 副作用：修改对象属性、关闭位图缓存、重算包围盒（setCoords），并影响后续
 * 命中检测与控制点绘制。调用方需自行触发重绘。
 *
 * @param obj 任意 Fabric 对象（Rect / Ellipse / Group / Polyline / IText 等）
 * @param config 局部覆盖项，未传的字段回退到默认配置；传空对象等价于纯默认样式
 *
 * @example
 * applyControlConfig(rect, { cornerSize: 12, borderColor: '#ff3b30' });
 * canvas.requestRenderAll();
 */
export function applyControlConfig(obj: any, config: Partial<ControlConfig> = {}): void {
  // 默认值 + 局部覆盖：允许只改其中一两项而不必铺全量配置
  const merged = { ...getDefaultControlConfig(), ...config };
  obj.set(merged);
  // 标注对象会被频繁改色/缩放，缓存位图会导致画面滞后且放大后发虚
  obj.objectCaching = false;
  // set 之后包围盒已变化，必须重算，否则控制点与命中区域仍停在旧位置
  obj.setCoords();
}

/**
 * 让对象可被选中/拖拽，并套用统一手柄样式
 *
 * 副作用：修改 selectable / hasControls / hasBorders / evented，
 * 并转调 applyControlConfig 覆盖手柄样式。
 * 典型用途：把草稿态（不可交互）的对象转为正式对象。
 *
 * @param obj 任意 Fabric 对象
 *
 * @example
 * enableSelectable(shape); // 绘制结束后放开交互
 */
export function enableSelectable(obj: any): void {
  obj.set({ selectable: true, hasControls: true, hasBorders: true, evented: true });
  applyControlConfig(obj);
}

/**
 * 让对象不可选中、不响应事件（仍会参与渲染与导出）
 *
 * 副作用：修改 selectable / hasControls / hasBorders / evented。
 * 注意：这里不调用 applyControlConfig，也不重绘，调用方如需立即生效需自行 render。
 *
 * @param obj 任意 Fabric 对象
 *
 * @example
 * disableSelectable(bgImage); // 背景图不参与交互
 */
export function disableSelectable(obj: any): void {
  obj.set({ selectable: false, hasControls: false, hasBorders: false, evented: false });
}
