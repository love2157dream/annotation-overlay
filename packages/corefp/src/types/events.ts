import type { CanvasEventData } from './canvas';

export type EventListener = (data: CanvasEventData) => void;

export interface IEventBus {
  on(event: string, listener: EventListener): void;
  off(event: string, listener: EventListener): void;
  emit(event: string, data?: any): void;
  clear(): void;
}