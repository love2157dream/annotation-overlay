import * as fabric from 'fabric';
import type { ToolId, ToolConfig, Point } from '../types';
import { createBaseTool } from './createBaseTool';
import { getCanvasPointer } from '../utils';

export function createTextTool(config: ToolConfig) {
  let isEditing = false;

  const tool = createBaseTool('text' as ToolId, config);

  const clearTextCursor = (textObj: any) => {
    if (textObj.hiddenTextarea) {
      const el = textObj.hiddenTextarea as HTMLTextAreaElement;
      el.blur();
      el.style.display = 'none';
      if (el.parentNode) el.parentNode.removeChild(el);
      textObj.hiddenTextarea = null;
    }
    textObj.selectionStart = 0;
    textObj.selectionEnd = 0;
    textObj.cursorWidth = 0;
    textObj.cursorColor = 'transparent';
    textObj.isEditing = false;
    textObj.canvas?.renderAll();
  };

  const exitEditing = (canvas: any) => {
    if (!isEditing) return;
    const active = canvas.getActiveObject();
    if (active?.type === 'i-text') {
      clearTextCursor(active);
      if (active.text === '') {
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.renderAll();
        isEditing = false;
        return;
      }
    }
    canvas.discardActiveObject();
    canvas.renderAll();
    isEditing = false;
  };

  tool.onMouseDown = (opt: any, canvas: any) => {
    const e = opt.e as MouseEvent;
    if (e.button === 2 || opt.target) return;

    const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
    const text = new fabric.IText('', {
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

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    setTimeout(() => {
      text.enterEditing();
      const ta = text.hiddenTextarea;
      if (ta) { ta.focus(); ta.selectionStart = 0; ta.selectionEnd = 0; }
      isEditing = true;
    }, 100);
  };

  tool.destroy = () => { isEditing = false; };

  // 暴露退出编辑方法供外部调用
  (tool as any).exitEditing = exitEditing;

  return tool;
}