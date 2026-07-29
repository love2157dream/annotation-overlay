import React, { useRef } from 'react';
import type { ToolId } from '@laoliangfe/annotation-overlay-core';
import { IconUndo, IconRedo, ToolIcons } from '../constants/icons';

interface ToolbarProps {
  currentTool: ToolId;
  canUndo: boolean;
  canRedo: boolean;
  onSelectTool: (toolId: ToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const tools = [
  { id: 'pen' as const, label: '画笔' },
  { id: 'line' as const, label: '折线' },
  { id: 'arrow' as const, label: '箭头' },
  { id: 'rect' as const, label: '矩形' },
  { id: 'ellipse' as const, label: '椭圆' },
  { id: 'text' as const, label: '文字' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  canUndo,
  canRedo,
  onSelectTool,
  onUndo,
  onRedo,
  onCancel,
  onConfirm,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);

  return (
    <div className="anno-toolbar" ref={toolbarRef}>
      {/* 拖动手柄 */}
      <div className="anno-drag-handle" title="拖动工具栏">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <defs><circle id="dot" cx="0" cy="0" r="2" /></defs>
          <use href="#dot" x="5" y="5" />
          <use href="#dot" x="12" y="5" />
          <use href="#dot" x="19" y="5" />
          <use href="#dot" x="5" y="12" />
          <use href="#dot" x="12" y="12" />
          <use href="#dot" x="19" y="12" />
          <use href="#dot" x="5" y="19" />
          <use href="#dot" x="12" y="19" />
          <use href="#dot" x="19" y="19" />
        </svg>
      </div>

      <div className="anno-sep" />

      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`anno-tool-btn ${currentTool === tool.id ? 'active' : ''}`}
          title={tool.label}
          onClick={() => onSelectTool(tool.id)}
        >
          {ToolIcons[tool.id]}
        </button>
      ))}

      <div className="anno-sep" />

      <button className="anno-tool-btn" title="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <IconUndo />
      </button>
      <button className="anno-tool-btn" title="重做 (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
        <IconRedo />
      </button>

      <div className="anno-sep" />

      <button className="anno-btn" onClick={onCancel}>取消</button>
      <button className="anno-btn primary" onClick={onConfirm}>确认</button>
    </div>
  );
};