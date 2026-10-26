/**
 * @file React 版顶部工具栏：拖动条 + 六个绘图工具 + 撤销/重做 + 取消/确认
 *
 * 纯展示组件，不持有任何状态：当前工具、按钮可用性全部来自父组件（AnnotationOverlay），
 * 交互只通过回调上报。按钮顺序、图标、文案统一取自
 * `@laoliangfe/annotation-overlay-ui`，与 Vue / Angular 版逐项对齐。
 *
 * 注意：
 * - 每个工具按钮带 `data-tool` 属性，样式面板靠它查询按钮位置完成对齐；
 *   改名会导致面板定位失效。
 * - 本组件不处理样式（类名见 ui 包 overlay.css），也不负责拖拽逻辑，
 *   拖拽由父级 .anno-topbar-group 上的 onMouseDown 统一接管。
 *
 * @see ./AnnotationOverlay.tsx 父组件，负责状态与拖拽
 * @see ../../ui/src/data.ts 工具清单与文案
 */
import type { ToolId } from '@laoliangfe/annotation-overlay-core';
import { annoIcons, TOOL_ITEMS, LABELS } from '@laoliangfe/annotation-overlay-ui';
import { Icon } from './Icon';

/**
 * 工具栏属性
 * 所有回调均为必填：工具栏自身不做任何状态变更，完全受控。
 */
interface ToolbarProps {
  /** 当前工具 id，'' 表示选择模式；用于给对应按钮加 active 高亮 */
  currentTool: ToolId;
  /** 是否可撤销（历史指针 > 0），false 时撤销按钮置灰 */
  canUndo: boolean;
  /** 是否可重做（历史指针未到末尾），false 时重做按钮置灰 */
  canRedo: boolean;
  /** 点击绘图工具：回传该工具 id，父组件负责惰性初始化引擎并切换工具 */
  onSelectTool: (toolId: ToolId) => void;
  /** 点击撤销：回退一步历史 */
  onUndo: () => void;
  /** 点击重做：前进一步历史 */
  onRedo: () => void;
  /** 点击取消：放弃本次标注并关闭覆盖层 */
  onCancel: () => void;
  /** 点击确认：导出标注图片并关闭覆盖层 */
  onConfirm: () => void;
}

/**
 * 顶部工具栏
 *
 * 结构从左到右：拖动手柄 → 六个绘图工具 → 撤销/重做 → 取消/确认，
 * 各组之间用 .anno-sep 竖线分隔。
 *
 * @example
 * <Toolbar
 *   currentTool={currentTool}
 *   canUndo={canUndo}
 *   canRedo={canRedo}
 *   onSelectTool={handleSelectTool}
 *   onUndo={undo}
 *   onRedo={redo}
 *   onCancel={handleCancel}
 *   onConfirm={handleConfirm}
 * />
 */
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
  // 按钮顺序与文案全部来自 ui 包，这里只负责布局与事件转发
  return (
    <div className="anno-toolbar">
      {/* 拖动手柄 */}
      <div className="anno-drag-handle" title={LABELS.dragHandle}>
        <Icon icon={annoIcons.drag} />
      </div>

      <div className="anno-sep" />

      {TOOL_ITEMS.map((tool) => (
        <button
          key={tool.id}
          className={`anno-tool-btn ${currentTool === tool.id ? 'active' : ''}`}
          data-tool={tool.id}
          title={tool.label}
          onClick={() => onSelectTool(tool.id)}
        >
          <Icon icon={annoIcons[tool.icon]} />
        </button>
      ))}

      <div className="anno-sep" />

      <button className="anno-tool-btn" title={LABELS.undo} disabled={!canUndo} onClick={onUndo}>
        <Icon icon={annoIcons.undo} />
      </button>
      <button className="anno-tool-btn" title={LABELS.redo} disabled={!canRedo} onClick={onRedo}>
        <Icon icon={annoIcons.redo} />
      </button>

      <div className="anno-sep" />

      <button className="anno-btn" onClick={onCancel}>{LABELS.cancel}</button>
      <button className="anno-btn primary" onClick={onConfirm}>{LABELS.confirm}</button>
    </div>
  );
};
