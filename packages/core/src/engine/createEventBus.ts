/**
 * @file 事件总线工厂（闭包实现）
 *
 * 以 Map<事件名, 监听器数组> 保存订阅关系，提供与框架无关的 on/off/emit/clear。
 * 适配层可借此订阅引擎事件而不依赖 Fabric 实例，也便于测试时手动触发事件。
 * 注意：emit 是同步的，监听器内不要做重活；单个监听器抛错不会中断其余监听器。
 *
 * @see src/types/events.ts
 */

import type { IEventBus, EventListener, CanvasEventData } from '../types';

/**
 * 创建事件总线实例 (纯函数工厂)
 *
 * 每次调用返回独立实例，监听器集合封装在闭包内，不共享状态。
 *
 * @returns 实现 IEventBus 的对象；无需显式销毁，但长期存活的实例应在卸载时 clear()
 *
 * @example
 * const bus = createEventBus();
 * const off = (d) => console.log(d.type, d.payload);
 * bus.on('tool:changed', off);
 * bus.emit('tool:changed', 'rect');
 * bus.off('tool:changed', off);
 */
export function createEventBus(): IEventBus {
  // ---- 私有状态：事件名 → 监听器数组（保持注册顺序） ----
  const events = new Map<string, EventListener[]>();

  return {
    /**
     * 注册监听器
     * 副作用：向内部 Map 追加一项；首次注册某事件时会创建数组。
     * @param event 事件名
     * @param listener 回调函数，同一引用可重复注册（会被调用多次）
     */
    on(event: string, listener: EventListener): void {
      if (!events.has(event)) events.set(event, []);
      events.get(event)!.push(listener);
    },

    /**
     * 移除监听器
     * 只移除首个匹配项；未注册过的事件或函数直接忽略，不抛错。
     * @param event 事件名
     * @param listener 注册时传入的函数引用（必须是同一引用）
     */
    off(event: string, listener: EventListener): void {
      const listeners = events.get(event);
      if (!listeners) return;
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    },

    /**
     * 触发事件
     * 副作用：同步依次调用监听器。监听器抛出的异常在此拦截，
     * 避免单个订阅方的 bug 阻断整条事件链。
     * @param event 事件名，约定取 CanvasEventType
     * @param data 业务负载，会包进 CanvasEventData.payload
     */
    emit(event: string, data?: any): void {
      const listeners = events.get(event);
      if (!listeners) return;
      // 统一包一层：监听器只关心 type + payload，无需各自解析参数
      const payload: CanvasEventData = { type: event as any, payload: data };
      for (const fn of listeners) {
        try { fn(payload); } catch (e) { console.warn(`事件 ${event} 执行失败`, e); }
      }
    },

    /** 清空全部事件与监听器，释放闭包引用 */
    clear(): void {
      events.clear();
    },
  };
}
