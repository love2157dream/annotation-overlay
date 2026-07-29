/**
 * 默认配置
 */
export const defaults = {
  /** 默认颜色 */
  color: '#ff3b30',
  /** 默认线条粗细 */
  lineWidth: 4,
  /** 默认文字大小 */
  fontSize: 20,
  /** 预设颜色列表 */
  colors: ['#ff3b30', '#ffb020', '#34c759', '#0a84ff', '#af52de', '#111111', '#ffffff'],
  /** 最小对象尺寸 */
  minObjectSize: 10,
  /** 控制手柄配置 */
  controls: {
    cornerStyle: 'circle' as const,
    cornerSize: 10,
    cornerColor: '#4f6bff',
    cornerStrokeColor: '#4f6bff',
    transparentCorners: false,
    borderColor: '#4f6bff',
    borderDashArray: [4, 4],
    borderOpacityWhenMoving: 0.5,
    selectionBackgroundColor: 'rgba(79, 107, 255, 0.1)',
    padding: 8,
    objectCaching: false,
  },
};