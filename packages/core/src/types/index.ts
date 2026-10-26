/**
 * @file 公共类型出口与基础几何/交互类型定义
 *
 * 汇总 tool / canvas / history / events 四组子类型，并定义跨模块复用的
 * Point、Rect、ConfirmPayload、ControlConfig、SelectionStyleInfo、HistoryInfo。
 * 三端适配层的 props、emits 直接复用此处类型，保证 API 形状一致。
 *
 * @see src/types/tool.ts
 * @see src/types/canvas.ts
 */

import type { ToolId } from './tool';

/** 工具相关类型：ToolId（工具标识）与 ToolConfig（颜色/线宽/字号） */
export * from './tool';
/** 画布相关类型：CanvasEventType、CanvasEventData、CanvasState */
export * from './canvas';
/** 历史相关类型：HistoryState、IHistoryManager */
export * from './history';
/** 事件总线类型：EventListener、IEventBus */
export * from './events';

/**
 * 画布坐标系中的二维点
 * 单位为 CSS 像素（Fabric 逻辑坐标），原点在画布左上角，y 轴向下为正。
 */
export interface Point {
  /** 横坐标，单位 px，取值范围 [0, canvas.getWidth()] */
  x: number;
  /** 纵坐标，单位 px，取值范围 [0, canvas.getHeight()] */
  y: number;
}

/**
 * 轴对齐矩形区域
 * 用于描述截图目标元素的包围盒，全部为 CSS 像素。
 */
export interface Rect {
  /** 左上角横坐标，单位 px，可为负（元素部分在视口左侧时） */
  left: number;
  /** 左上角纵坐标，单位 px，可为负（元素部分在视口上方时） */
  top: number;
  /** 宽度，单位 px，取值 >= 0；为 0 时画布会退化为不可绘制 */
  width: number;
  /** 高度，单位 px，取值 >= 0；为 0 时画布会退化为不可绘制 */
  height: number;
}

/**
 * 确认（导出）结果
 * 同时给出 dataURL 与 Blob，方便适配层按场景选择：前者可直接塞进 img，
 * 后者适合走上传接口或 File 构造。
 */
export interface ConfirmPayload {
  /** PNG 格式 dataURL，形如 `data:image/png;base64,...`；失败时可能为空串 */
  base64: string;
  /** 与 base64 内容一致的二进制对象，用于上传/下载；由 dataURL 转换而来 */
  blob: Blob;
}

/**
 * 选中对象时控制手柄与选框的样式
 * 字段与 Fabric 对象的同名属性一一对应，applyControlConfig 会整体 set 到对象上。
 */
export interface ControlConfig {
  /** 手柄形状，'circle' 圆形 / 'rect' 方形，默认 'circle' */
  cornerStyle: 'rect' | 'circle';
  /** 手柄边长，单位 px，默认 10；过大会遮挡细线图形 */
  cornerSize: number;
  /** 手柄填充色，CSS 颜色字符串（十六进制或 rgba），默认 '#4f6bff' */
  cornerColor: string;
  /** 手柄描边色，默认 '#4f6bff'；与填充色一致时视觉上为实心块 */
  cornerStrokeColor: string;
  /** 手柄是否透明填充，默认 false；true 时仅描边可见 */
  transparentCorners: boolean;
  /** 选中边框颜色，默认 '#4f6bff' */
  borderColor: string;
  /** 边框虚线样式，单位 px，数组交替表示实线段与间隔长度，默认 [4, 4] */
  borderDashArray: number[];
  /** 拖动对象时边框透明度，取值 0~1，默认 0.5 */
  borderOpacityWhenMoving: number;
  /** 框选（marquee）矩形填充色，rgba 字符串，默认 'rgba(79, 107, 255, 0.1)' */
  selectionBackgroundColor: string;
  /** 手柄相对对象包围盒的外扩距离，单位 px，默认 8 */
  padding: number;
  /** 是否缓存对象位图；引擎强制写为 false，避免缩放后位图模糊 */
  objectCaching: boolean;
}

/**
 * 选中对象时回读并同步给 UI 的样式信息
 * 由引擎 handleSelection 生成，供样式面板高亮当前颜色/粗细/字号。
 */
export interface SelectionStyleInfo {
  /** Fabric 对象类型（rect / ellipse / group / polyline / path / i-text） */
  objectType: string;
  /** 映射回的工具 id */
  toolId: ToolId;
  /** 描边或填充色，CSS 颜色字符串；文字取 fill，图形取 stroke */
  color: string;
  /** 线宽，单位 px；文字对象沿用上一条线宽（不参与渲染） */
  lineWidth: number;
  /** 字号，单位 px；仅文字对象有效，其余对象回退为当前配置值 */
  fontSize: number;
}

/** 历史状态信息（驱动撤销/重做按钮） */
export interface HistoryInfo {
  /** 是否可撤销：历史指针 > 0 时为 true（首帧为初始空快照） */
  canUndo: boolean;
  /** 是否可重做：历史指针 < 快照总数 - 1 时为 true */
  canRedo: boolean;
  /** 当前历史指针，从 0 开始；-1 表示尚未写入任何快照 */
  index: number;
  /** 快照总数（含初始空快照），用于调试与展示进度 */
  length: number;
}
