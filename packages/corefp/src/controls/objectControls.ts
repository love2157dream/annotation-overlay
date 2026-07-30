import type { ControlConfig } from '../types';
import { defaults } from '../config/defaults';

export function getDefaultControlConfig(): ControlConfig {
  return { ...defaults.controls };
}

export function applyControlConfig(obj: any, config: Partial<ControlConfig> = {}): void {
  const merged = { ...getDefaultControlConfig(), ...config };
  obj.set(merged);
  obj.objectCaching = false;
  obj.setCoords();
}

export function enableSelectable(obj: any): void {
  obj.set({ selectable: true, hasControls: true, hasBorders: true, evented: true });
  applyControlConfig(obj);
}

export function disableSelectable(obj: any): void {
  obj.set({ selectable: false, hasControls: false, hasBorders: false, evented: false });
}