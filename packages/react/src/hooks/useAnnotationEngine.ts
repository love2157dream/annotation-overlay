import { useRef, useState, useCallback } from 'react';
import { CanvasEngine, type ToolId, type ConfirmPayload } from '@laoliangfe/annotation-overlay-core';

/**
 * React Hook 桥接核心引擎
 */
export function useAnnotationEngine() {
  const engineRef = useRef<CanvasEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolId>('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [activeObjectType, setActiveObjectType] = useState<string | null>(null);

  const init = useCallback(async (targetEl: HTMLElement): Promise<void> => {
    if (engineRef.current) return;

    const engine = new CanvasEngine();
    engine.onStateChanged = () => {
      if (engineRef.current) {
        const state = engineRef.current.getHistoryState();
        setCanUndo(state.canUndo);
        setCanRedo(state.canRedo);
      }
    };
    engine.onSelectionChanged = (obj: any) => {
      setActiveObjectType(obj.type || null);
    };
    engine.onSelectionCleared = () => {
      setActiveObjectType(null);
    };

    await engine.init(targetEl);
    engineRef.current = engine;
    setIsInitialized(true);
  }, []);

  const selectTool = useCallback((toolId: ToolId): void => {
    if (!engineRef.current) return;
    engineRef.current.selectTool(toolId);
    setCurrentTool(toolId);
  }, []);

  const setStyle = useCallback((color: string, lineWidth: number, fontSize: number): void => {
    engineRef.current?.setStyle(color, lineWidth, fontSize);
  }, []);

  const undo = useCallback((): void => {
    engineRef.current?.undo();
  }, []);

  const redo = useCallback((): void => {
    engineRef.current?.redo();
  }, []);

  const exportImage = useCallback((): ConfirmPayload | null => {
    if (!engineRef.current) return null;
    const result = engineRef.current.exportImage();
    if (result.blob) {
      return { base64: result.base64, blob: result.blob };
    }
    return null;
  }, []);

  const getCanvasElement = useCallback((): HTMLCanvasElement | null => {
    return engineRef.current?.getCanvasElement() || null;
  }, []);

  const dispose = useCallback((): void => {
    engineRef.current?.destroy();
    engineRef.current = null;
    setIsInitialized(false);
    setCurrentTool('');
    setCanUndo(false);
    setCanRedo(false);
    setActiveObjectType(null);
  }, []);

  return {
    engine: engineRef,
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
    getCanvasElement,
    dispose,
  };
}