/**
 * @file 事件总线类型
 *
 * 提供与具体框架无关的发布订阅契约，使 UI 层可订阅引擎事件而无需直接持有
 * Fabric 实例。引擎主流程亦可用 CanvasEngineCallbacks 回调，两者互补。
 *
 * @see src/engine/createEventBus.ts
 * @see src/types/canvas.ts
 */

import type { CanvasEventData } from './canvas';

/**
 * 事件监听器
 * @param data 事件数据，type 为事件名，payload 为业务负载
 */
export type EventListener = (data: CanvasEventData) => void;

/** 事件总线接口：同一事件可注册多个监听器，按注册顺序依次触发 */
export interface IEventBus {
  /**
   * 注册监听器
   * @param event 事件名，约定使用 CanvasEventType 中的值
   * @param listener 回调；同一函数重复注册会被调用多次
   */
  on(event: string, listener: EventListener): void;
  /**
   * 移除监听器（仅移除首个匹配项）
   * @param event 事件名
   * @param listener 注册时传入的同一个函数引用
   */
  off(event: string, listener: EventListener): void;
  /**
   * 触发事件
   * 副作用：同步依次调用监听器；单个监听器抛错会被捕获并告警，不影响后续监听器。
   * @param event 事件名
   * @param data 业务负载，可为空
   */
  emit(event: string, data?: any): void;
  /** 清空全部事件及监听器（销毁时调用，防止闭包泄漏） */
  clear(): void;
}
