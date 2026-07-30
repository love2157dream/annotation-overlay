import type { IEventBus, EventListener, CanvasEventData } from '../types';

/**
 * 创建事件总线实例 (纯函数工厂)
 */
export function createEventBus(): IEventBus {
  const events = new Map<string, EventListener[]>();

  return {
    on(event: string, listener: EventListener): void {
      if (!events.has(event)) events.set(event, []);
      events.get(event)!.push(listener);
    },

    off(event: string, listener: EventListener): void {
      const listeners = events.get(event);
      if (!listeners) return;
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    },

    emit(event: string, data?: any): void {
      const listeners = events.get(event);
      if (!listeners) return;
      const payload: CanvasEventData = { type: event as any, payload: data };
      for (const fn of listeners) {
        try { fn(payload); } catch (e) { console.warn(`事件 ${event} 执行失败`, e); }
      }
    },

    clear(): void {
      events.clear();
    },
  };
}