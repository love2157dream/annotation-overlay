/**
 * @file 工具函数出口
 *
 * 汇总坐标换算、几何计算与 Fabric 对象修正三类纯函数，
 * 供工具实现、图形工厂与引擎共同使用。
 *
 * @see src/utils/pointer.ts
 * @see src/utils/geometry.ts
 * @see src/utils/fabricHelper.ts
 */

/** 指针坐标：把原生鼠标事件换算成画布逻辑坐标 */
export * from './pointer';
/** 几何计算：距离、弧度/角度、区间裁剪 */
export * from './geometry';
/** Fabric 辅助：最小包围盒修正、折线重建 */
export * from './fabricHelper';
