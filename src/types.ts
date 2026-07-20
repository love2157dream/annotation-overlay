/**
 * 工具类型
 */
/** 工具类型：画笔 | 折线 | 箭头 | 矩形 | 椭圆 | 文字 | 无 */
export type ToolId = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | ''

/**
 * 工具定义
 * id、显示标签、图标渲染函数 
 */
export interface ToolDef {
  id: ToolId
  label: string
  render: () => any // VNode
}

/**
 * 确认事件返回的数据结构：base64 图片 + Blob 对象
 * 验证失败时返回 null
 */
export interface ConfirmPayload {
  /** Base64 格式的图片数据 */
  base64: string
  /** Blob 格式的图片数据 */
  blob: Blob
}

/**
 * 组件 Props
 */
export interface AnnotationOverlayProps {
  // 目前没有 props，保留以便将来扩展
}

/**
 * 组件暴露的方法
 */
export interface AnnotationOverlayExpose {
  /** 打开标注组件 */
  open: (targetEl?: HTMLElement) => Promise<void>
  /** 关闭标注组件 */
  close: () => void
}