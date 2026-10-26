/**
 * @file React 版样式面板：粗细/字号滑条 + 预设色板 + 自定义取色器
 *
 * 纯展示组件：数值全部由父组件传入，变更通过回调上报，自身不维护草稿状态。
 * 面板挂载在 .anno-topbar-group 内部，用绝对定位对齐到当前工具按钮下方；
 * 具体坐标由父组件用 getBoundingClientRect() 差值算出后传入。
 *
 * 数据来源：`@laoliangfe/annotation-overlay-ui` 的 COLOR_PRESETS / SIZE_RANGE / LABELS，
 * 与 Vue / Angular 版共用同一份色板与取值范围。
 *
 * 注意：
 * - 滑条拖动期间只回调 onUpdateStyle（高频、不写历史），松开鼠标才触发
 *   onCommitStyle 落一个撤销点；若在此处提交会在一段拖动中产生大量历史。
 * - 文字工具显示字号，其余工具显示线宽，二者共用同一个 range 输入与数值展示。
 *
 * @see ./AnnotationOverlay.tsx 父组件，传入实时样式并处理提交
 * @see ../../ui/src/data.ts 色板与尺寸区间
 */
import React from 'react';
import { COLOR_PRESETS, SIZE_RANGE, LABELS } from '@laoliangfe/annotation-overlay-ui';

/**
 * 样式面板属性
 */
interface StylePanelProps {
  /** 当前颜色（CSS 颜色字符串，如 '#ff3b30'），用于高亮色块与取色器回显 */
  currentColor: string;
  /** 当前线宽，单位 px，范围取 SIZE_RANGE.lineWidth（1–20） */
  lineWidth: number;
  /** 当前字号，单位 px，范围取 SIZE_RANGE.fontSize（8–72） */
  fontSize: number;
  /** 当前是否为文字工具：决定滑条绑定字号还是线宽、标签显示「大小」还是「粗细」 */
  isTextTool: boolean;
  /** 面板左偏移（px），相对 .anno-topbar-group；由父组件按按钮 rect 差值计算 */
  panelLeft: number;
  /** 面板上偏移（px），相对 .anno-topbar-group；缺省按 54 处理（工具栏高度 + 间距） */
  panelTop?: number;
  /**
   * 工具栏是否已被拖动
   * 拖动后工具栏改为 fixed 定位，子元素坐标基准随之变化，此时面板退回固定位置
   * （left: 0 / top: 52），跟随工具栏一起移动，不再逐按钮对齐。
   */
  isCustomPosition: boolean;
  /** 滑条数值变化（拖动过程中高频触发）：只应用样式，不写历史 */
  onUpdateStyle: (payload: { size?: number; color?: string }) => void;
  /** 点击预设色块或取色器：立即应用颜色并提交一次历史 */
  onSetColor: (color: string) => void;
  /** 滑条松开（mouseup）：把拖动期间累积的样式提交为一个撤销点 */
  onCommitStyle: () => void;
}

/**
 * 样式面板
 *
 * 两行布局：第一行为尺寸滑条（线宽或字号）+ 当前值；第二行为预设色块 + 取色器。
 * 颜色操作即时生效并写历史，尺寸操作拖动时实时生效、松开后才写历史。
 *
 * @example
 * <StylePanel
 *   currentColor={color}
 *   lineWidth={lineWidth}
 *   fontSize={fontSize}
 *   isTextTool={currentTool === 'text'}
 *   panelLeft={panelLeft}
 *   panelTop={panelTop}
 *   isCustomPosition={isCustomPosition}
 *   onUpdateStyle={handleUpdateStyle}
 *   onSetColor={handleSetColor}
 *   onCommitStyle={handleCommitStyle}
 * />
 */
export const StylePanel: React.FC<StylePanelProps> = ({
  currentColor,
  lineWidth,
  fontSize,
  isTextTool,
  panelLeft,
  panelTop,
  isCustomPosition,
  onUpdateStyle,
  onSetColor,
  onCommitStyle,
}) => {
  // 文字工具取字号，其余工具取线宽：两者在 UI 上复用同一个滑条
  const sizeOrWidth = isTextTool ? fontSize : lineWidth;
  // 对应区间不同（字号 8–72，线宽 1–20），必须成对切换
  const sizeRange = isTextTool ? SIZE_RANGE.fontSize : SIZE_RANGE.lineWidth;

  /**
   * 面板定位
   * - 默认：按父组件算出的按钮 rect 差值定位，贴在按钮正下方；
   * - 工具栏被拖动后：基准变化，退回 left:0 / top:52 固定在工具栏左下方。
   */
  const panelStyle: React.CSSProperties = isCustomPosition
    ? { position: 'absolute', left: '0px', top: '52px' }
    : { position: 'absolute', left: `${panelLeft}px`, top: `${panelTop ?? 54}px` };

  // 两行布局：尺寸滑条（拖动实时生效、松开提交）+ 颜色（点击即时提交历史）
  return (
    <div className="anno-style-panel" style={panelStyle}>
      <div className="anno-style-row">
        <span className="anno-label">{isTextTool ? LABELS.fontSize : LABELS.strokeWidth}</span>
        <input
          type="range"
          min={sizeRange.min}
          max={sizeRange.max}
          value={sizeOrWidth}
          onChange={(e) => onUpdateStyle({ size: Number(e.target.value) })}
          onMouseUp={onCommitStyle}
        />
        <span className="anno-value">{sizeOrWidth}px</span>
      </div>
      <div className="anno-style-row">
        <span className="anno-label">{LABELS.color}</span>
        <div className="anno-color-list">
          {COLOR_PRESETS.map((c) => (
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
            title={LABELS.customColor}
          />
        </div>
      </div>
    </div>
  );
};
