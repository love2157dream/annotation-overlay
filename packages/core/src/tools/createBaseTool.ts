/**
 * @file 工具公共契约与基础骨架
 *
 * 定义所有绘图工具的统一形状：ToolContext（引擎注入的通信接口）、
 * ToolConfigLike（避免循环依赖的配置形状）、BaseToolInstance（事件处理契约）。
 * 引擎按 currentToolId 取出实例，把 Fabric 的 mouse:down/move/up 转发过来，
 * 因此每个工具只需关心「如何画」，历史、收尾、UI 通知由引擎统一处理。
 *
 * 注意：工具实例用闭包保存绘制中间态（起点、草稿对象），不持有画布引用；
 * canvas 由事件回调传入，保证多画布场景下不会串台。
 *
 * @see src/tools/createRectTool.ts
 * @see src/engine/createCanvasEngine.ts
 */

import type { ToolId } from '../types';

/**
 * 工具运行上下文：由引擎注入，工具通过它与引擎通信
 * （读取实时配置、保存历史、修正包围盒等）
 */
export interface ToolContext {
  /** 读取引擎当前的实时样式配置（颜色 / 粗细 / 字号） */
  getConfig(): ToolConfigLike;
  /** 请求引擎保存一次历史状态（产生一个撤销点） */
  saveState(): void;
  /** 保证对象包围盒不小于最小尺寸，避免退化导致 Fabric 控制点方向异常 */
  ensureMinBoundingBox(obj: any): void;
}

/** 避免循环依赖的轻量配置形状 */
export interface ToolConfigLike {
  /** 描边/填充色，CSS 颜色字符串 */
  color: string;
  /** 线宽，单位 px，取值 > 0 */
  lineWidth: number;
  /** 字号，单位 px，仅文字工具使用 */
  fontSize: number;
}

/**
 * 工具实例类型
 * 所有回调都由引擎在对应 Fabric 事件中调用，canvas 为当前画布实例。
 */
export type BaseToolInstance = {
  /** 工具标识，与 UI 按钮一一对应 */
  id: ToolId;
  /**
   * 按下：通常用于记录起点并创建草稿对象
   * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent，opt.target 为命中的对象
   * @param canvas 当前 Fabric 画布
   */
  onMouseDown: (opt: any, canvas: any) => void;
  /** 移动：更新草稿对象尺寸或折线末点预览 */
  onMouseMove: (opt: any, canvas: any) => void;
  /** 抬起：定稿对象（开启选中、修正包围盒）并写入一个撤销点 */
  onMouseUp: (opt: any, canvas: any) => void;
  /** 双击：目前仅折线用于结束绘制 */
  onDblClick?: (opt: any, canvas: any) => void;
  /** 右键（引擎在 upperCanvasEl 的 contextmenu 捕获阶段转发） */
  onContextMenu?: (canvas: any) => void;
  /** 是否有未完成的绘制（如折线进行中），引擎据此决定 mouse:down 的转发策略 */
  isDrawing?: () => boolean;
  /** 销毁工具：清理草稿引用，防止闭包持有已销毁画布的对象 */
  destroy?: () => void;
};

/**
 * 创建基础工具（公共骨架）
 *
 * 当前仅返回带 id 的对象，供扩展工具继承其标识约定；实际绘图能力由
 * 各具体工具工厂实现。
 *
 * @param id 工具标识，须与 ToolId 联合类型中的值一致
 * @returns 仅含 id 的最小工具对象
 *
 * @example
 * const tool = createBaseTool('rect');
 * console.log(tool.id); // 'rect'
 */
export function createBaseTool(id: ToolId): { id: ToolId } {
  return { id };
}
