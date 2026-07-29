export * from './tool';
export * from './canvas';
export * from './history';
export * from './events';

/**
 * 坐标点
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 矩形区域
 */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 确认输出
 */
export interface ConfirmPayload {
  base64: string;
  blob: Blob;
}

/**
 * 控制手柄配置
 */
export interface ControlConfig {
  cornerStyle: 'rect' | 'circle';
  cornerSize: number;
  cornerColor: string;
  cornerStrokeColor: string;
  transparentCorners: boolean;
  borderColor: string;
  borderDashArray: number[];
  borderOpacityWhenMoving: number;
  selectionBackgroundColor: string;
  padding: number;
  objectCaching: boolean;
}