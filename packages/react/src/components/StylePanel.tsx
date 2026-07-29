import React from 'react';

interface StylePanelProps {
  currentColor: string;
  lineWidth: number;
  fontSize: number;
  isTextTool: boolean;
  panelLeft: number;
  isCustomPosition: boolean;
  onUpdateStyle: (payload: { size?: number; color?: string }) => void;
  onSetColor: (color: string) => void;
  onCommitStyle: () => void;
}

const presetColors = ['#ff3b30', '#ffb020', '#34c759', '#0a84ff', '#af52de', '#111111', '#ffffff'];

export const StylePanel: React.FC<StylePanelProps> = ({
  currentColor,
  lineWidth,
  fontSize,
  isTextTool,
  panelLeft,
  isCustomPosition,
  onUpdateStyle,
  onSetColor,
  onCommitStyle,
}) => {
  const sizeOrWidth = isTextTool ? fontSize : lineWidth;
  const min = isTextTool ? 8 : 1;
  const max = isTextTool ? 72 : 20;

  const panelStyle: React.CSSProperties = isCustomPosition
    ? { position: 'absolute', left: '0px', top: '52px' }
    : { position: 'absolute', left: `${panelLeft}px`, top: '54px' };

  return (
    <div className="anno-style-panel" style={panelStyle}>
      <div className="anno-style-row">
        <span className="anno-label">{isTextTool ? '大小' : '粗细'}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={sizeOrWidth}
          onChange={(e) => onUpdateStyle({ size: Number(e.target.value) })}
          onMouseUp={onCommitStyle}
        />
        <span className="anno-value">{sizeOrWidth}{isTextTool ? 'px' : 'px'}</span>
      </div>
      <div className="anno-style-row">
        <span className="anno-label">颜色</span>
        <div className="anno-color-list">
          {presetColors.map((c) => (
            <span
              key={c}
              className={`anno-swatch ${currentColor === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => onSetColor(c)}
            />
          ))}
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onSetColor(e.target.value)}
            className="anno-color-picker"
            title="自定义颜色"
          />
        </div>
      </div>
    </div>
  );
};