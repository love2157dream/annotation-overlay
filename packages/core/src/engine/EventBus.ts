import type { IEventBus, EventListener, CanvasEventData } from '../types';

/**
 * 事件总线
 * 用于组件间解耦通信
 */
export class EventBus implements IEventBus {
  private events: Map<string, EventListener[]> = new Map();

  /**
   * 注册事件监听
   */
  on(event: string, listener: EventListener): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  /**
   * 移除事件监听
   */
  off(event: string, listener: EventListener): void {
    const listeners = this.events.get(event);
    if (!listeners) return;
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  emit(event: string, data?: any): void {
    const listeners = this.events.get(event);
    if (!listeners) return;
    const eventData: CanvasEventData = { type: event as any, payload: data };
    listeners.forEach(listener => {
      try {
        listener(eventData);
      } catch (e) {
        console.warn(`事件监听器执行失败: ${event}`, e);
      }
    });
  }

  /**
   * 清除所有事件
   */
  clear(): void {
    this.events.clear();
  }
}