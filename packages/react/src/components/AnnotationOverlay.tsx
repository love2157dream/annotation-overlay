import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { type ToolId, type ConfirmPayload, domCapture } from '@laoliangfe/annotation-overlay-core';
import { useAnnotationEngine } from '../hooks/useAnnotationEngine';
import { Toolbar } from './Toolbar';
import { StylePanel } from './StylePanel';

// ============================================================
// 类型
// ============================================================
export interface AnnotationOverlayRef {
  open: (targetEl: HTMLElement) => Promise<void>;
  close: () => void;
}

export interface AnnotationOverlayProps {
  onConfirm?: (payload: ConfirmPayload | null) => void;
  onCancel?: () => void;
  onBeforeCapture?: (targetEl: HTMLElement) => void;
  onAfterCapture?: (targetEl: HTMLElement) => void;
}

// ============================================================
// 组件
// ============================================================
export const AnnotationOverlay = forwardRef<AnnotationOverlayRef, AnnotationOverlayProps>(
  (props, ref) => {
    const {
      onConfirm,
      onCancel,
      onBeforeCapture,
      onAfterCapture,
    } = props;

    // 状态
    const [visible, setVisible] = useState(false);
    const [color, setColor] = useState('#ff3b30');
    const [lineWidth, setLineWidth] = useState(4);
    const [fontSize, setFontSize] = useState(20);
    const [overlayRect, setOverlayRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
    const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
    const [isCustomPosition, setIsCustomPosition] = useState(false);
    const [panelLeft, setPanelLeft] = useState(0);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const toolbarGroupRef = useRef<HTMLDivElement>(null);
    const pendingTargetRef = useRef<HTMLElement>(document.body);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // 引擎
    const {
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
      getCanvasElement,
      dispose,
    } = useAnnotationEngine();

    // ============================================================
    // 计算属性
    // ============================================================
    const isTextTool = currentTool === 'text';
    const sizeOrWidth = isTextTool ? fontSize : lineWidth;

    const showStylePanel =
      (['pen', 'line', 'arrow', 'rect', 'ellipse', 'text'] as ToolId[]).includes(currentTool) ||
      activeObjectType !== null;

    const overlayStyle: React.CSSProperties = {
      left: overlayRect.left + 'px',
      top: overlayRect.top + 'px',
      width: overlayRect.width + 'px',
      height: overlayRect.height + 'px',
      pointerEvents: isInitialized ? 'auto' : 'none',
    };

    const toolbarGroupStyle: React.CSSProperties = isCustomPosition
      ? { position: 'fixed', left: toolbarPosition.x + 'px', top: toolbarPosition.y + 'px', transform: 'none', zIndex: 3 }
      : { position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 3 };

    // ============================================================
    // 核心方法
    // ============================================================
    const open = useCallback(async (targetEl: HTMLElement) => {
      pendingTargetRef.current = targetEl;
      const rect = targetEl.getBoundingClientRect();
      setOverlayRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      setVisible(true);
      await new Promise(resolve => setTimeout(resolve, 0));
    }, []);

    const close = useCallback(() => {
      dispose();
      setVisible(false);
    }, [dispose]);

    const initEngine = useCallback(async (targetEl: HTMLElement) => {
      onBeforeCapture?.(targetEl);
      await new Promise(resolve => setTimeout(resolve, 50));

      await init(targetEl);

      const canvasEl = getCanvasElement();
      if (canvasEl && canvasRef.current) {
        const parent = canvasRef.current.parentNode;
        if (parent) {
          parent.replaceChild(canvasEl, canvasRef.current);
          canvasRef.current = canvasEl;
        }
      }

      onAfterCapture?.(targetEl);
    }, [init, getCanvasElement, onBeforeCapture, onAfterCapture]);

    const handleSelectTool = useCallback(async (toolId: ToolId) => {
      if (toolId !== '' && !engine.current) {
        await initEngine(pendingTargetRef.current);
      }
      selectTool(toolId);
    }, [engine, initEngine, selectTool]);

    const handleUpdateStyle = useCallback((payload: { size?: number; color?: string }) => {
      if (payload.size !== undefined) {
        if (isTextTool) setFontSize(payload.size);
        else setLineWidth(payload.size);
      }
      setStyle(color, lineWidth, fontSize);
    }, [isTextTool, color, lineWidth, fontSize, setStyle]);

    const handleSetColor = useCallback((c: string) => {
      setColor(c);
      setStyle(c, lineWidth, fontSize);
    }, [lineWidth, fontSize, setStyle]);

    const handleConfirm = useCallback(async () => {
      if (!engine.current) {
        const base64 = await domCapture(pendingTargetRef.current);
        const blob = await fetch(base64).then(r => r.blob());
        onConfirm?.({ base64, blob });
        close();
        return;
      }

      const payload = exportImage();
      onConfirm?.(payload);
      close();
    }, [engine, exportImage, onConfirm, close]);

    const handleCancel = useCallback(() => {
      onCancel?.();
      close();
    }, [onCancel, close]);

    // ============================================================
    // 拖拽
    // ============================================================
    const startDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.anno-drag-handle') && !target.closest('.anno-toolbar')) return;
      if (target.closest('button')) return;
      isDraggingRef.current = true;
      const rect = toolbarGroupRef.current?.getBoundingClientRect();
      if (rect) {
        dragOffsetRef.current.x = e.clientX - rect.left;
        dragOffsetRef.current.y = e.clientY - rect.top;
      }
      if (!isCustomPosition && toolbarGroupRef.current) {
        const rect = toolbarGroupRef.current.getBoundingClientRect();
        setToolbarPosition({ x: rect.left, y: rect.top });
        setIsCustomPosition(true);
      }
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', endDrag);
      e.preventDefault();
    }, [isCustomPosition]);

    const onDrag = useCallback((e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = Math.max(0, e.clientX - dragOffsetRef.current.x);
      const newY = Math.max(0, e.clientY - dragOffsetRef.current.y);
      const toolbarEl = toolbarGroupRef.current;
      if (toolbarEl) {
        const rect = toolbarEl.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        setToolbarPosition({ x: Math.min(newX, maxX), y: Math.min(newY, maxY) });
      } else {
        setToolbarPosition({ x: newX, y: newY });
      }
    }, []);

    const endDrag = useCallback(() => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', endDrag);
    }, [onDrag]);

    // ============================================================
    // 快捷键
    // ============================================================
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancel();
          return;
        }
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        if (key === 'y') { e.preventDefault(); redo(); }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, handleCancel]);

    // ============================================================
    // Expose
    // ============================================================
    useImperativeHandle(ref, () => ({ open, close }), [open, close]);

    // ============================================================
    // Render
    // ============================================================
    if (!visible) return null;

    return createPortal(
      <div className="anno-overlay" style={overlayStyle}>
        <div
          className="anno-topbar-group"
          ref={toolbarGroupRef}
          style={toolbarGroupStyle}
          onMouseDown={startDrag}
        >
          <Toolbar
            currentTool={currentTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onSelectTool={handleSelectTool}
            onUndo={undo}
            onRedo={redo}
            onCancel={handleCancel}
            onConfirm={handleConfirm}
          />

          {showStylePanel && (
            <StylePanel
              currentColor={color}
              lineWidth={lineWidth}
              fontSize={fontSize}
              isTextTool={isTextTool}
              panelLeft={panelLeft}
              isCustomPosition={isCustomPosition}
              onUpdateStyle={handleUpdateStyle}
              onSetColor={handleSetColor}
              onCommitStyle={() => {}}
            />
          )}
        </div>

        <div className="anno-canvas-wrap">
          <canvas ref={canvasRef} />
        </div>
      </div>,
      document.body
    );
  }
);

AnnotationOverlay.displayName = 'AnnotationOverlay';

export default AnnotationOverlay;