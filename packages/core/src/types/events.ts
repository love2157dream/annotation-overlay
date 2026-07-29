import type { CanvasEventData } from './canvas';

/**
 * 事件监听器类型
 */
export type EventListener = (data: CanvasEventData) => void;

/**
 * 事件总线接口
 */
export interface IEventBus {
  on(event: string, listener: EventListener): void;
  off(event: string, listener: EventListener): void;
  emit(event: string, data?: any): void;
  clear(): void;
}