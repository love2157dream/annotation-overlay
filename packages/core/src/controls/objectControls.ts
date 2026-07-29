import type { ControlConfig } from '../types';
import { defaults } from '../config/defaults';

/**
 * 获取控制手柄配置
 */
export function getDefaultControlConfig(): ControlConfig {
  return { ...defaults.controls };
}

/**
 * 应用控制手柄配置到对象
 */
export function applyControlConfig(obj: any, config: Partial<ControlConfig> = {}): void {
  const defaultConfig = getDefaultControlConfig();
  const merged = { ...defaultConfig, ...config };
  obj.set(merged);
  obj.objectCaching = false;
  obj.setCoords();
}

/**
 * 启用对象可选中
 */
export function enableSelectable(obj: any): void {
  obj.set({
    selectable: true,
    hasControls: true,
    hasBorders: true,
    evented: true,
  });
  applyControlConfig(obj);
}

/**
 * 禁用对象可选中
 */
export function disableSelectable(obj: any): void {
  obj.set({
    selectable: false,
    hasControls: false,
    hasBorders: false,
    evented: false,
  });
}