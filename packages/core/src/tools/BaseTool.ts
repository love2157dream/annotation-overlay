import * as fabric from 'fabric';
import type { ToolId, ToolConfig } from '../types';
import type { EventBus } from '../engine/EventBus';

/**
 * 工具抽象基类
 * 所有绘制工具需继承此类并实现生命周期方法
 */
export abstract class BaseTool {
  public abstract readonly id: ToolId;

  protected config: ToolConfig;
  protected eventBus: EventBus | null = null;
  protected isActive = false;

  constructor(config: ToolConfig) {
    this.config = config;
  }

  /**
   * 设置事件总线
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * 激活工具
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * 停用工具
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * 获取配置
   */
  getConfig(): ToolConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 鼠标按下
   */
  abstract onMouseDown(opt: any, canvas: fabric.Canvas): void;

  /**
   * 鼠标移动
   */
  abstract onMouseMove(opt: any, canvas: fabric.Canvas): void;

  /**
   * 鼠标释放
   */
  abstract onMouseUp(opt: any, canvas: fabric.Canvas): void;

  /**
   * 双击
   */
  onDblClick(opt: any, canvas: fabric.Canvas): void {
    // 默认空实现，子类可覆盖
  }

  /**
   * 销毁工具
   */
  destroy(): void {
    // 默认空实现，子类可覆盖
  }
}