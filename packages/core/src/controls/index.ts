/**
 * @file 控制手柄模块出口
 *
 * 对外暴露选中态手柄样式的读取/应用，以及对象的可选/不可选切换，
 * 供引擎与三端适配层在自定义对象时复用。
 *
 * @see src/controls/objectControls.ts
 */

/** 手柄样式默认值读取、样式应用、可选中开关 */
export { getDefaultControlConfig, applyControlConfig, enableSelectable, disableSelectable } from './objectControls';
