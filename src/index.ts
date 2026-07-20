import AnnotationOverlay from './AnnotationOverlay.vue';
import type { 
  ToolId, 
  ToolDef, 
  ConfirmPayload,
  AnnotationOverlayProps,
  AnnotationOverlayExpose 
} from './types';

// 导出组件
export { AnnotationOverlay };

// 默认导出
export default AnnotationOverlay;

// 导出类型
export type {
  ToolId,
  ToolDef,
  ConfirmPayload,
  AnnotationOverlayProps,
  AnnotationOverlayExpose
};

// 如果需要在全局注册
export function install(app: any) {
  app.component('AnnotationOverlay', AnnotationOverlay);
}