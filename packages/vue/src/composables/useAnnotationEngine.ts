import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { CanvasEngine, type ToolId, type ConfirmPayload } from '@laoliangfe/annotation-overlay-core';

/**
 * Vue composable 桥接核心引擎
 */
export function useAnnotationEngine() {
  const engine = ref<CanvasEngine | null>(null);
  const isInitialized = ref(false);
  const currentTool = ref<ToolId>('');
  const canUndo = ref(false);
  const canRedo = ref(false);
  const activeObjectType = ref<string | null>(null);

  const init = async (targetEl: HTMLElement): Promise<void> => {
    if (engine.value) return;

    engine.value = new CanvasEngine();
    engine.value.onStateChanged = () => {
      if (engine.value) {
        const state = engine.value.getHistoryState();
        canUndo.value = state.canUndo;
        canRedo.value = state.canRedo;
      }
    };
    engine.value.onSelectionChanged = (obj: any) => {
      activeObjectType.value = obj.type || null;
    };
    engine.value.onSelectionCleared = () => {
      activeObjectType.value = null;
    };

    await engine.value.init(targetEl);
    isInitialized.value = true;
  };

  const selectTool = (toolId: ToolId): void => {
    if (!engine.value) return;
    engine.value.selectTool(toolId);
    currentTool.value = toolId;
  };

  const setStyle = (color: string, lineWidth: number, fontSize: number): void => {
    engine.value?.setStyle(color, lineWidth, fontSize);
  };

  const undo = (): void => {
    engine.value?.undo();
  };

  const redo = (): void => {
    engine.value?.redo();
  };

  const exportImage = (): ConfirmPayload | null => {
    if (!engine.value) return null;
    const result = engine.value.exportImage();
    if (result.blob) {
      return { base64: result.base64, blob: result.blob };
    }
    return null;
  };

  const dispose = (): void => {
    engine.value?.destroy();
    engine.value = null;
    isInitialized.value = false;
    currentTool.value = '';
    canUndo.value = false;
    canRedo.value = false;
    activeObjectType.value = null;
  };

  return {
    engine,
    isInitialized,
    currentTool,
    canUndo,
    canRedo,
    activeObjectType,
    init,
    selectTool,
    setStyle,
    undo,
    redo,
    exportImage,
    dispose,
  };
}