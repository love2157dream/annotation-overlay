import * as fabric from 'fabric';
import type { ToolId, ToolConfig, Point } from '../types';
import { BaseTool } from './BaseTool';
import { getCanvasPointer } from '../utils';

/**
 * 文字工具
 */
export class TextTool extends BaseTool {
  readonly id: ToolId = 'text';

  public isEditing = false;

  onMouseDown(opt: any, canvas: fabric.Canvas): void {
    const nativeEvt = opt.e as MouseEvent;
    if (nativeEvt.button === 2) return;
    if (opt.target) return;

    const p = getCanvasPointer(nativeEvt, canvas.getElement(), canvas.getWidth(), canvas.getHeight());

    const text = new fabric.IText('', {
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

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    // 延迟进入编辑模式
    setTimeout(() => {
      text.enterEditing();
      const textarea = (text as any).hiddenTextarea as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = 0;
        textarea.selectionEnd = 0;
      }
      this.isEditing = true;
      this.eventBus?.emit('text:editing:start');
    }, 100);
  }

  onMouseMove(opt: any, canvas: fabric.Canvas): void {
    // 文字工具不需要鼠标移动逻辑
  }

  onMouseUp(opt: any, canvas: fabric.Canvas): void {
    // 文字工具不需要鼠标释放逻辑
  }

  /**
   * 退出文字编辑
   */
  exitEditing(canvas: fabric.Canvas): void {
    if (!this.isEditing) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
      const textObj = activeObj as fabric.IText;
      this.clearTextCursor(textObj);
      if (textObj.text === '') {
        canvas.remove(textObj);
        canvas.discardActiveObject();
        canvas.renderAll();
        this.isEditing = false;
        this.eventBus?.emit('text:editing:end');
        return;
      }
    }
    canvas.discardActiveObject();
    canvas.renderAll();
    this.isEditing = false;
    this.eventBus?.emit('text:editing:end');
  }

  /**
   * 清除文字光标
   */
  private clearTextCursor(textObj: fabric.IText): void {
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

  destroy(): void {
    this.isEditing = false;
  }
}