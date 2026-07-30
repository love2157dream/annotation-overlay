import * as fabric from 'fabric';
import type { ToolId, Point, ToolConfig, ConfirmPayload, ControlConfig } from '../types';
import { EventBus } from './EventBus';
import { ToolManager } from './ToolManager';
import { HistoryManager } from '../history/HistoryManager';
import { domCapture } from '../capture/domCapture';
import { getCanvasPointer, ensureMinBoundingBox } from '../utils';
import { defaults } from '../config/defaults';
import {
  PenTool,
  RectTool,
  EllipseTool,
  ArrowTool,
  PolylineTool,
  TextTool,
} from '../tools';
import { applyControlConfig } from '../controls/objectControls';

/**
 * 画布引擎
 * 核心入口，管理 Fabric 画布实例、工具、历史和事件
 */
export class CanvasEngine {
  private canvas: fabric.Canvas | null = null;
  private eventBus: EventBus;
  private toolManager: ToolManager;
  private historyManager: HistoryManager;
  private config: ToolConfig;

  private targetEl: HTMLElement | null = null;
  private isInitialized = false;

  // 事件回调
  public onSelectionChanged: ((obj: any) => void) | null = null;
  public onSelectionCleared: (() => void) | null = null;
  public onTextEditingEntered: (() => void) | null = null;
  public onTextEditingExited: (() => void) | null = null;
  public onStateChanged: (() => void) | null = null;

  constructor(config?: Partial<ToolConfig>) {
    this.config = {
      color: config?.color || defaults.color,
      lineWidth: config?.lineWidth || defaults.lineWidth,
      fontSize: config?.fontSize || defaults.fontSize,
    };

    this.eventBus = new EventBus();
    this.toolManager = new ToolManager(this.eventBus);
    this.historyManager = new HistoryManager();

    // 注册所有工具
    this.registerTools();

    // 监听事件总线
    this.setupEventListeners();
  }

  /**
   * 注册所有绘制工具
   */
  private registerTools(): void {
    this.toolManager.register(new PenTool(this.config));
    this.toolManager.register(new RectTool(this.config));
    this.toolManager.register(new EllipseTool(this.config));
    this.toolManager.register(new ArrowTool(this.config));
    this.toolManager.register(new PolylineTool(this.config));
    this.toolManager.register(new TextTool(this.config));
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    this.eventBus.on('tool:start', () => {
      this.historyManager.isRestoring = false;
    });

    this.eventBus.on('tool:end', () => {
      this.saveState();
    });

    this.eventBus.on('text:editing:start', () => {
      this.onTextEditingEntered?.();
    });

    this.eventBus.on('text:editing:end', () => {
      this.saveState();
      this.onTextEditingExited?.();
    });

    this.eventBus.on('object:selected', (data) => {
      this.onSelectionChanged?.(data.payload);
    });

    this.eventBus.on('object:cleared', () => {
      this.onSelectionCleared?.();
    });

    this.eventBus.on('state:changed', () => {
      this.onStateChanged?.();
    });
  }

  /**
   * 初始化画布
   */
  async init(targetEl: HTMLElement): Promise<void> {
    this.targetEl = targetEl;
    const rect = targetEl.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // 截图
    const bgDataURL = await domCapture(targetEl);

    // 创建 Fabric 画布
    this.canvas = new fabric.Canvas(document.createElement('canvas'), {
      selection: false,
      width: displayWidth,
      height: displayHeight,
      enableRetinaScaling: false,
    });

    const canvasEl = this.canvas.getElement();
    canvasEl.style.width = displayWidth + 'px';
    canvasEl.style.height = displayHeight + 'px';
    canvasEl.width = displayWidth;
    canvasEl.height = displayHeight;

    // 设置画笔
    this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
    this.canvas.freeDrawingBrush.color = this.config.color;
    this.canvas.freeDrawingBrush.width = this.config.lineWidth;

    // 加载背景
    if (bgDataURL) {
      try {
        const img = await fabric.FabricImage.fromURL(bgDataURL);
        img.set({
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          scaleX: displayWidth / (img.width || displayWidth),
          scaleY: displayHeight / (img.height || displayHeight),
        });
        this.canvas.backgroundImage = img;
      } catch (e) {
        console.warn('加载背景图失败:', e);
      }
    }

    this.canvas.renderAll();

    // 绑定画布事件
    this.bindCanvasEvents();

    // 保存初始状态
    this.saveState();

    this.isInitialized = true;
  }

  /**
   * 绑定画布事件
   */
  private bindCanvasEvents(): void {
    if (!this.canvas) return;

    // 鼠标按下：委托给当前工具
    this.canvas.on('mouse:down', (opt: any) => {
      if (this.canvas?.isDrawingMode) return;
      const tool = this.toolManager.getCurrentTool();
      if (tool) {
        tool.onMouseDown(opt, this.canvas!);
      }
    });

    // 鼠标移动：委托给当前工具
    this.canvas.on('mouse:move', (opt: any) => {
      if (this.canvas?.isDrawingMode) return;
      const tool = this.toolManager.getCurrentTool();
      if (tool) {
        tool.onMouseMove(opt, this.canvas!);
      }
    });

    // 鼠标释放：委托给当前工具
    this.canvas.on('mouse:up', (opt: any) => {
      if (this.canvas?.isDrawingMode) return;
      const tool = this.toolManager.getCurrentTool();
      if (tool) {
        tool.onMouseUp(opt, this.canvas!);
      }
    });

    // 双击：委托给当前工具
    this.canvas.on('mouse:dblclick', (opt: any) => {
      if (this.canvas?.isDrawingMode) return;
      const tool = this.toolManager.getCurrentTool();
      if (tool) {
        tool.onDblClick(opt, this.canvas!);
      }
    });

    // 路径创建（画笔工具）
    this.canvas.on('path:created', (e: any) => {
      const path = e.path as fabric.Path;
      if (path) ensureMinBoundingBox(path);
      this.saveState();
    });

    // 对象修改完成
    this.canvas.on('object:modified', () => {
      this.saveState();
    });

    // 对象选中
    this.canvas.on('selection:created', (e: any) => {
      const selected = e.selected?.[0];
      if (selected) {
        applyControlConfig(selected);
        this.eventBus.emit('object:selected', selected);
        this.canvas?.renderAll();
      }
    });

    this.canvas.on('selection:updated', (e: any) => {
      const selected = e.selected?.[0];
      if (selected) {
        applyControlConfig(selected);
        this.eventBus.emit('object:selected', selected);
        this.canvas?.renderAll();
      }
    });

    // 取消选中
    this.canvas.on('selection:cleared', () => {
      this.eventBus.emit('object:cleared');
    });
  }

  /**
   * 保存状态到历史
   */
  saveState(): void {
    if (!this.canvas || this.historyManager.isRestoring) return;
    const objects = this.canvas.getObjects().filter((obj) => obj !== this.canvas?.backgroundImage);
    this.historyManager.saveState(objects);
    this.eventBus.emit('state:changed');
  }

  /**
   * 获取画布 DOM 元素
   */
  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvas?.getElement() || null;
  }

  /**
   * 获取画布实例
   */
  getCanvasInstance(): fabric.Canvas | null {
    return this.canvas;
  }

  /**
   * 获取当前工具 ID
   */
  getCurrentTool(): ToolId {
    return this.toolManager.getCurrentToolId();
  }

  /**
   * 切换工具
   */
  selectTool(toolId: ToolId): void {
    const currentTool = this.toolManager.getCurrentTool();
    if (currentTool?.id === 'text' && (currentTool as TextTool).isEditing) {
      (currentTool as TextTool).exitEditing(this.canvas!);
    }
    this.toolManager.switchTool(toolId);
    
    if (this.canvas) {
      this.canvas.isDrawingMode = toolId === 'pen';
      this.canvas.selection = toolId === '';
      
      // 🔥 新增：光标映射
      const cursorMap: Record<string, string> = {
        'pen': 'crosshair',
        'text': 'text',
        'line': 'crosshair',
        'arrow': 'crosshair',
        'rect': 'crosshair',
        'ellipse': 'crosshair',
        '': 'default',
      };
      this.canvas.hoverCursor = cursorMap[toolId] || 'default';
      this.canvas.defaultCursor = cursorMap[toolId] || 'default';
      this.canvas.renderAll();
    }
  }

  /**
   * 设置样式
   */
  setStyle(color: string, lineWidth: number, fontSize: number): void {
    this.config.color = color;
    this.config.lineWidth = lineWidth;
    this.config.fontSize = fontSize;

    // 更新画笔
    if (this.canvas?.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color;
      this.canvas.freeDrawingBrush.width = lineWidth;
    }

    // 更新当前选中的对象
    this.updateSelectedObjectStyle(color, lineWidth, fontSize);

    this.canvas?.renderAll();
  }

  /**
   * 更新选中对象的样式
   */
  private updateSelectedObjectStyle(color: string, lineWidth: number, fontSize: number): void {
    const activeObj = this.canvas?.getActiveObject();
    if (!activeObj) return;

    if (activeObj.type === 'i-text') {
      (activeObj as fabric.IText).set({ fontSize, fill: color });
    } else if (activeObj.type === 'group') {
      const group = activeObj as fabric.Group;
      group.getObjects().forEach((child) => {
        if (child.type === 'line') {
          child.set({ stroke: color, strokeWidth: lineWidth });
        } else if (child.type === 'triangle') {
          child.set({
            fill: color,
            width: 10 + lineWidth * 2,
            height: 12 + lineWidth * 2,
          });
        }
        child.dirty = true;
      });
      (group as any).dirty = true;
    } else {
      (activeObj as any).set({ stroke: color, strokeWidth: lineWidth });
      activeObj.dirty = true;
    }
    activeObj.setCoords();
    this.canvas?.renderAll();
  }

  /**
   * 撤销
   */
  undo(): void {
    if (!this.canvas || !this.historyManager.canUndo) return;
    const state = this.historyManager.undo();
    if (state) {
      this.restoreState(state);
      this.eventBus.emit('state:changed');
    }
  }

  /**
   * 重做
   */
  redo(): void {
    if (!this.canvas || !this.historyManager.canRedo) return;
    const state = this.historyManager.redo();
    if (state) {
      this.restoreState(state);
      this.eventBus.emit('state:changed');
    }
  }

  /**
   * 恢复状态
   */
  private  async restoreState(state: { objects: any[] }): Promise<void> {
    if (!this.canvas) return;
    const objects = this.canvas.getObjects().filter((obj) => obj !== this.canvas?.backgroundImage);
    objects.forEach((obj) => this.canvas?.remove(obj));

    if (state.objects.length > 0) {
      try {
          const restoredObjects = await fabric.util.enlivenObjects(state.objects);
          if (this.canvas) {
              (restoredObjects as any[]).forEach((obj: any) => {
                  if (obj && obj.type) {
                      this.canvas?.add(obj as fabric.FabricObject)
                  }
              });
              this.canvas.requestRenderAll();
          }
      } catch (err) {
          console.warn('恢复对象失败:', err);
      }
    } else {
      this.canvas.requestRenderAll();
    }
  }

  /**
   * 获取历史状态
   */
  getHistoryState(): { canUndo: boolean; canRedo: boolean; index: number; length: number } {
    return {
      canUndo: this.historyManager.canUndo,
      canRedo: this.historyManager.canRedo,
      index: this.historyManager.currentIndex,
      length: this.historyManager.length,
    };
  }

  /**
   * 创建文字
   */
  createText(p: Point, text: string = ''): fabric.IText | null {
    if (!this.canvas) return null;
    const textObj = new fabric.IText(text, {
      left: p.x,
      top: p.y,
      fill: this.config.color,
      fontSize: this.config.fontSize,
      fontFamily: 'Arial',
      selectable: true,
      hasControls: true,
      cursorColor: this.config.color,
      cursorWidth: 2,
    });
    this.canvas.add(textObj);
    this.canvas.setActiveObject(textObj);
    this.canvas.renderAll();
    return textObj;
  }

  /**
   * 清除文字光标
   */
  clearTextCursor(textObj: fabric.IText): void {
    const obj = textObj as any;
    if (obj.hiddenTextarea) {
      const textarea = obj.hiddenTextarea as HTMLTextAreaElement;
      textarea.blur();
      textarea.style.display = 'none';
      if (textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
      obj.hiddenTextarea = null;
    }
    textObj.selectionStart = 0;
    textObj.selectionEnd = 0;
    textObj.cursorWidth = 0;
    textObj.cursorColor = 'transparent';
    textObj.isEditing = false;
    textObj.canvas?.renderAll();
  }

  /**
   * 退出文字编辑
   */
  exitTextEditing(): void {
    if (!this.canvas) return;
    const activeObj = this.canvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      const textObj = activeObj as fabric.IText;
      this.clearTextCursor(textObj);
      if (textObj.text === '') {
        this.canvas.remove(textObj);
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
        return;
      }
    }
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    this.saveState();
  }

  /**
   * 导出图片
   */
  exportImage(): { base64: string; blob: Blob | null } {
    if (!this.canvas) return { base64: '', blob: null };
    const dpr = window.devicePixelRatio || 1;
    const base64 = this.canvas.toDataURL({ format: 'png', multiplier: dpr });
    let blob: Blob | null = null;
    this.canvas.getElement().toBlob((b) => { blob = b; }, 'image/png');
    return { base64, blob };
  }

  /**
   * 获取对象列表
   */
  getObjects(): any[] {
    if (!this.canvas) return [];
    return this.canvas.getObjects().filter((obj) => obj !== this.canvas?.backgroundImage);
  }

  /**
   * 获取当前选中的对象
   */
  getActiveObject(): any {
    return this.canvas?.getActiveObject() || null;
  }

  /**
   * 取消选中
   */
  discardActiveObject(): void {
    this.canvas?.discardActiveObject();
    this.canvas?.renderAll();
  }

  /**
   * 渲染
   */
  renderAll(): void {
    this.canvas?.renderAll();
  }

  /**
   * 销毁
   */
  destroy(): void {
    // 1. 停止所有工具
    this.toolManager.destroy();
    
    // 2. 清除事件总线
    this.eventBus.clear();
    
    // 3. 重置历史
    this.historyManager.reset();
    
    // 4. 销毁画布
    if (this.canvas) {
      try {
        // 移除所有对象（释放内存）
        const objects = this.canvas.getObjects();
        objects.forEach(obj => this.canvas?.remove(obj));
        
        // 移除背景
        if (this.canvas.backgroundImage) {
          this.canvas.remove(this.canvas.backgroundImage as any);
          this.canvas.backgroundImage = undefined;
        }
        
        // 清除事件
        this.canvas.off();
        
        // 从 DOM 移除 canvas 元素
        const canvasEl = this.canvas.getElement();
        if (canvasEl && canvasEl.parentNode) {
          canvasEl.parentNode.removeChild(canvasEl);
        }
        
        // 释放 Fabric 实例
        this.canvas.dispose();
      } catch (e) {
        // 忽略销毁过程中的错误
        console.debug('销毁画布时出错:', e);
      }
      this.canvas = null;
    }
    
    this.isInitialized = false;
    this.targetEl = null;
  }
}