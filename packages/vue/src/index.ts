import AnnotationOverlay from './components/AnnotationOverlay.vue';
import type { ConfirmPayload, ToolId } from '@laoliangfe/annotation-overlay-core';

export { AnnotationOverlay };
export default AnnotationOverlay;

export function install(app: any): void {
  app.component('AnnotationOverlay', AnnotationOverlay);
}

export type { ConfirmPayload, ToolId };