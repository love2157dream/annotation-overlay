import * as fabric from 'fabric';
import type { ToolId, ToolConfig, Point, ConfirmPayload, ControlConfig } from '../types';
import { defaults } from '../config/defaults';
import { createEventBus } from './createEventBus';
import { createToolManager } from './createToolManager';
import { createHistoryManager } from '../history/createHistoryManager';
import { domCapture } from '../capture/domCapture';
import { getCanvasPointer, ensureMinBoundingBox } from '../utils';
import {
  createPenTool,
  createRectTool,
  createEllipseTool,
  createArrowTool,
  createPolylineTool,
  createTextTool,
} from '../tools';
import { applyControlConfig } from '../controls/objectControls';

export type CanvasEngineInstance = {
  init: (targetEl: HTMLElement) => Promise<void>;
  selectTool: (toolId: ToolId) => void;
  getCurrentTool: () => ToolId;
  setStyle: (color: string, lineWidth: number, fontSize: number) => void;
  undo: () => void;
  redo: () => void;
  getHistoryState: () => { canUndo: boolean; canRedo: boolean; index: number; length: number };
  createText: (p: Point, text?: string) => fabric.IText | null;
  clearTextCursor: (textObj: fabric.IText) => void;
  exitTextEditing: () => void;
  exportImage: () => { base64: string; blob: Blob | null };
  getCanvasElement: () => HTMLCanvasElement | null;
  getCanvasInstance: () => fabric.Canvas | null;
  getObjects: () => any[];
  getActiveObject: () => any;
  discardActiveObject: () => void;
  renderAll: () => void;
  destroy: () => void;
  setCallbacks: (callbacks: {
    onSelectionChanged?: (obj: any) => void;
    onSelectionCleared?: () => void;
    onTextEditingEntered?: () => void;
    onTextEditingExited?: () => void;
    onStateChanged?: () => void;
  }) => void;
};

/**
 * 创建画布引擎 (纯函数工厂)
 */
export function createCanvasEngine(cfg?: Partial<ToolConfig>): CanvasEngineInstance {
  // ---- 私有状态 (闭包) ----
  let canvas: fabric.Canvas | null = null;
  const eventBus = createEventBus();
  const toolManager = createToolManager(eventBus);
  const historyManager = createHistoryManager();

  const config = {
    color: cfg?.color || defaults.color,
    lineWidth: cfg?.lineWidth || defaults.lineWidth,
    fontSize: cfg?.fontSize || defaults.fontSize,
  };

  let targetEl: HTMLElement | null = null;

  // 回调
  let onSelectionChanged: ((obj: any) => void) | null = null;
  let onSelectionCleared: (() => void) | null = null;
  let onTextEditingEntered: (() => void) | null = null;
  let onTextEditingExited: (() => void) | null = null;
  let onStateChanged: (() => void) | null = null;

  // ---- 内部辅助 ----
  const saveState = () => {
    if (!canvas || historyManager.isRestoring) return;
    const objects = canvas.getObjects().filter(obj => obj !== canvas?.backgroundImage);
    historyManager.saveState(objects);
    eventBus.emit('state:changed');
    onStateChanged?.();
  };

  const restoreState = (state: { objects: any[] }) => {
    if (!canvas) return;
    const objects = canvas.getObjects().filter(obj => obj !== canvas?.backgroundImage);
    objects.forEach(obj => canvas?.remove(obj));
    if (state.objects.length > 0) {
      fabric.util.enlivenObjects(state.objects, (restored: any[]) => {
        restored.forEach(obj => canvas?.add(obj));
        canvas?.renderAll();
      });
    } else {
      canvas.renderAll();
    }
  };

  const updateSelectedObjectStyle = (color: string, lineWidth: number, fontSize: number) => {
    const active = canvas?.getActiveObject();
    if (!active) return;
    if (active.type === 'i-text') {
      (active as fabric.IText).set({ fontSize, fill: color });
    } else if (active.type === 'group') {
      (active as fabric.Group).getObjects().forEach((child: any) => {
        if (child.type === 'line') child.set({ stroke: color, strokeWidth: lineWidth });
        else if (child.type === 'triangle') {
          child.set({ fill: color, width: 10 + lineWidth * 2, height: 12 + lineWidth * 2 });
        }
        child.dirty = true;
      });
      (active as any).dirty = true;
    } else {
      active.set({ stroke: color, strokeWidth: lineWidth });
      active.dirty = true;
    }
    active.setCoords();
    canvas?.renderAll();
  };

  const bindCanvasEvents = () => {
    if (!canvas) return;

    canvas.on('mouse:down', (opt: any) => {
      if (canvas?.isDrawingMode) return;
      const tool = toolManager.getCurrentTool();
      tool?.onMouseDown(opt, canvas);
    });

    canvas.on('mouse:move', (opt: any) => {
      if (canvas?.isDrawingMode) return;
      const tool = toolManager.getCurrentTool();
      tool?.onMouseMove(opt, canvas);
    });

    canvas.on('mouse:up', (opt: any) => {
      if (canvas?.isDrawingMode) return;
      const tool = toolManager.getCurrentTool();
      tool?.onMouseUp(opt, canvas);
    });

    canvas.on('mouse:dblclick', (opt: any) => {
      if (canvas?.isDrawingMode) return;
      const tool = toolManager.getCurrentTool();
      tool?.onDblClick?.(opt, canvas);
    });

    canvas.on('path:created', (e: any) => {
      ensureMinBoundingBox(e.path);
      saveState();
    });

    canvas.on('object:modified', saveState);

    canvas.on('selection:created', (e: any) => {
      const selected = e.selected?.[0];
      if (selected) {
        applyControlConfig(selected);
        onSelectionChanged?.(selected);
        canvas?.renderAll();
      }
    });

    canvas.on('selection:updated', (e: any) => {
      const selected = e.selected?.[0];
      if (selected) {
        applyControlConfig(selected);
        onSelectionChanged?.(selected);
        canvas?.renderAll();
      }
    });

    canvas.on('selection:cleared', () => {
      onSelectionCleared?.();
    });
  };

  // ---- 注册工具 ----
  const registerTools = () => {
    toolManager.register(createPenTool(config));
    toolManager.register(createRectTool(config));
    toolManager.register(createEllipseTool(config));
    toolManager.register(createArrowTool(config));
    toolManager.register(createPolylineTool(config));
    toolManager.register(createTextTool(config));
  };
  registerTools();

  // ---- 公开 API ----
  return {
    async init(target: HTMLElement) {
      targetEl = target;
      const rect = target.getBoundingClientRect();
      const bgDataURL = await domCapture(target);

      canvas = new fabric.Canvas(document.createElement('canvas'), {
        selection: false,
        width: rect.width,
        height: rect.height,
        enableRetinaScaling: false,
      });

      const el = canvas.getElement();
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
      el.width = rect.width;
      el.height = rect.height;

      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = config.color;
      canvas.freeDrawingBrush.width = config.lineWidth;

      if (bgDataURL) {
        try {
          const img = await fabric.FabricImage.fromURL(bgDataURL);
          img.set({
            left: 0,
            top: 0,
            scaleX: rect.width / (img.width || rect.width),
            scaleY: rect.height / (img.height || rect.height),
          });
          canvas.backgroundImage = img;
        } catch (e) { console.warn('背景加载失败', e); }
      }

      canvas.renderAll();
      bindCanvasEvents();
      saveState();
    },

    selectTool(toolId: ToolId) {
      const current = toolManager.getCurrentTool();
      if (current?.id === 'text' && (current as any).exitEditing) {
        (current as any).exitEditing(canvas);
      }
      toolManager.switchTool(toolId);
      if (canvas) {
        canvas.isDrawingMode = toolId === 'pen';
        canvas.selection = toolId === '';
      }
    },

    getCurrentTool: () => toolManager.getCurrentToolId(),

    setStyle(color: string, lineWidth: number, fontSize: number) {
      config.color = color;
      config.lineWidth = lineWidth;
      config.fontSize = fontSize;
      if (canvas?.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = color;
        canvas.freeDrawingBrush.width = lineWidth;
      }
      updateSelectedObjectStyle(color, lineWidth, fontSize);
      canvas?.renderAll();
    },

    undo() {
      if (!canvas || !historyManager.canUndo) return;
      const state = historyManager.undo();
      if (state) { restoreState(state); onStateChanged?.(); }
    },

    redo() {
      if (!canvas || !historyManager.canRedo) return;
      const state = historyManager.redo();
      if (state) { restoreState(state); onStateChanged?.(); }
    },

    getHistoryState: () => ({
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      index: historyManager.currentIndex,
      length: historyManager.length,
    }),

    createText(p: Point, text = '') {
      if (!canvas) return null;
      const obj = new fabric.IText(text, {
        left: p.x,
        top: p.y,
        fill: config.color,
        fontSize: config.fontSize,
        fontFamily: 'Arial',
        selectable: true,
        hasControls: true,
        cursorColor: config.color,
        cursorWidth: 2,
      });
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.renderAll();
      return obj;
    },

    clearTextCursor(textObj: fabric.IText) {
      const obj = textObj as any;
      if (obj.hiddenTextarea) {
        const el = obj.hiddenTextarea as HTMLTextAreaElement;
        el.blur();
        el.style.display = 'none';
        if (el.parentNode) el.parentNode.removeChild(el);
        obj.hiddenTextarea = null;
      }
      textObj.selectionStart = 0;
      textObj.selectionEnd = 0;
      textObj.cursorWidth = 0;
      textObj.cursorColor = 'transparent';
      textObj.isEditing = false;
      textObj.canvas?.renderAll();
    },

    exitTextEditing() {
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (active?.type === 'i-text') {
        const textObj = active as fabric.IText;
        this.clearTextCursor(textObj);
        if (textObj.text === '') {
          canvas.remove(textObj);
          canvas.discardActiveObject();
          canvas.renderAll();
          return;
        }
      }
      canvas.discardActiveObject();
      canvas.renderAll();
      saveState();
    },

    exportImage() {
      if (!canvas) return { base64: '', blob: null };
      const dpr = window.devicePixelRatio || 1;
      const base64 = canvas.toDataURL({ format: 'png', multiplier: dpr });
      let blob: Blob | null = null;
      canvas.getElement().toBlob((b) => { blob = b; }, 'image/png');
      return { base64, blob };
    },

    getCanvasElement: () => canvas?.getElement() || null,
    getCanvasInstance: () => canvas,
    getObjects: () => {
      if (!canvas) return [];
      return canvas.getObjects().filter(obj => obj !== canvas?.backgroundImage);
    },
    getActiveObject: () => canvas?.getActiveObject() || null,
    discardActiveObject: () => { canvas?.discardActiveObject(); canvas?.renderAll(); },
    renderAll: () => canvas?.renderAll(),

    setCallbacks(callbacks) {
      onSelectionChanged = callbacks.onSelectionChanged || null;
      onSelectionCleared = callbacks.onSelectionCleared || null;
      onTextEditingEntered = callbacks.onTextEditingEntered || null;
      onTextEditingExited = callbacks.onTextEditingExited || null;
      onStateChanged = callbacks.onStateChanged || null;
    },

    destroy() {
      toolManager.destroy();
      eventBus.clear();
      historyManager.reset();
      canvas?.dispose();
      canvas = null;
      targetEl = null;
    },
  };
}