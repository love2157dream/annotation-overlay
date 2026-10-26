/**
 * @file 全局默认配置
 *
 * 引擎、控制手柄、图形工厂共用的默认值来源：颜色、线宽、字号、调色板、
 * 最小对象尺寸、选中态手柄样式。三端适配层的默认 props 也与本文件保持一致。
 * 注意：`as const` 只作用于 controls.cornerStyle，其余字段为可变推导类型；
 * 使用方应拷贝（getDefaultControlConfig 已做浅拷贝）而非直接改写本对象。
 *
 * @see src/controls/objectControls.ts
 * @see src/engine/createCanvasEngine.ts
 */

export const defaults = {
  /** 默认绘制色，iOS 系统红；同时作为画笔笔刷与文字光标颜色 */
  color: '#ff3b30',
  /** 默认线宽，单位 px；箭头三角尺寸会随该值线性放大 */
  lineWidth: 4,
  /** 默认字号，单位 px；仅文字工具使用 */
  fontSize: 20,
  /** 调色板预设色板，顺序即 UI 展示顺序：红/橙/绿/蓝/紫/黑/白 */
  colors: ['#ff3b30', '#ffb020', '#34c759', '#0a84ff', '#af52de', '#111111', '#ffffff'],
  /** 对象最小包围盒边长，单位 px；小于该值时按比例放大，避免控制点方向异常 */
  minObjectSize: 10,
  /** 选中态手柄与选框样式，字段含义见 ControlConfig */
  controls: {
    /** 圆形手柄，与标注场景的轻量视觉更协调 */
    cornerStyle: 'circle' as const,
    /** 手柄边长 px，10 在触屏上偏小但不易遮挡细线 */
    cornerSize: 10,
    /** 手柄填充色（品牌蓝） */
    cornerColor: '#4f6bff',
    /** 手柄描边色，与填充同色形成实心块 */
    cornerStrokeColor: '#4f6bff',
    /** 关闭透明手柄，深色截图上仍可辨认 */
    transparentCorners: false,
    /** 选中边框色，与手柄同色 */
    borderColor: '#4f6bff',
    /** 边框虚线：实线 4px / 间隔 4px */
    borderDashArray: [4, 4],
    /** 拖动时边框半透明，减少对标注内容的遮挡 */
    borderOpacityWhenMoving: 0.5,
    /** 框选矩形填充：品牌蓝 10% 透明度 */
    selectionBackgroundColor: 'rgba(79, 107, 255, 0.1)',
    /** 手柄外扩 8px，避免贴边对象的手柄溢出画布太多 */
    padding: 8,
    /** 关闭对象位图缓存，保证缩放/改色后立即重绘且不发虚 */
    objectCaching: false,
  },
};
