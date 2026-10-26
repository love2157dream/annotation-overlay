/**
 * @file 三端共享的工具栏 / 样式面板结构数据（框架无关）
 *
 * 本文件只导出纯数据与字面量类型：工具列表、调色板、尺寸区间、界面文案。
 * vue / react / angular 适配层都从这里取同一份数据，保证三端按钮顺序、
 * 文案、取值范围完全一致；数据本身不依赖任何框架，也不 import core 的类型，
 * ToolKey 与 core 的 ToolId 只是「取值结构兼容」，两者解耦以便 ui 包独立发布。
 *
 * 注意：新增工具时需同步三处——本文件 TOOL_ITEMS、icons.ts 的图标键、
 * core 的 ToolId，缺任意一处都会出现「按钮无图标」或「点击无法派发」。
 *
 * @see ./icons.ts 工具图标数据
 * @see ../../core/src/types/tool.ts 引擎侧 ToolId 定义
 */
import type { AnnoIconName } from './icons';

/**
 * 工具键
 *
 * 与 core 的 ToolId 去掉空串（'' 表示「未选工具 / 退出绘制」）后的子集保持一致，
 * 顺序即工具栏展示顺序。此处重复声明而不直接从 core 引入，是为了让 ui 包零依赖。
 */
export type ToolKey = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';

/** 工具栏单个按钮的结构描述 */
export interface ToolItem {
  /** 工具标识，点击时作为 select-tool 事件的载荷传给适配层 */
  id: ToolKey;
  /** 按钮 title 提示文案（中文，鼠标悬停可见），同时承担无障碍名称 */
  label: string;
  /** 图标名，必须是 icons.ts 中 annoIcons 的键，否则渲染为空 svg */
  icon: AnnoIconName;
}

/**
 * 工具栏按钮清单
 *
 * 数组顺序 = 渲染顺序，画笔在最左、文字在最右；若要调整交互习惯直接改顺序即可。
 * 每个条目同时决定 data-tool 属性值，样式面板据此定位到被点击的按钮下方。
 */
export const TOOL_ITEMS: ToolItem[] = [
  // 自由笔刷：按住拖动画任意曲线，线宽取当前 lineWidth
  { id: 'pen', label: '画笔', icon: 'pen' },
  // 折线：逐点单击落点、双击（或回车）结束，用于圈选多点路径
  { id: 'line', label: '折线', icon: 'line' },
  // 箭头：拖拽起点到终点，箭头头部随长度自适应
  { id: 'arrow', label: '箭头', icon: 'arrow' },
  // 矩形：拖拽出包围盒，用于框选区域
  { id: 'rect', label: '矩形', icon: 'rect' },
  // 椭圆：以拖拽包围盒的内切椭圆呈现
  { id: 'ellipse', label: '椭圆', icon: 'ellipse' },
  // 文字：单击落点后进入行内编辑，字号取当前 fontSize
  { id: 'text', label: '文字', icon: 'text' },
];

/**
 * 预设色板
 *
 * 前 5 个为高饱和彩色，用于在浅色截图（白底文档 / 表格）上突出显示；
 * 末尾追加黑色与白色，用于深色底图或需要低干扰标注的场景。
 * 颜色面板按此顺序渲染圆形色块，值直接写进 fabric 对象的 stroke / fill。
 */
export const COLOR_PRESETS = [
  '#ff3b30', '#ffb020', '#34c759', '#0a84ff', '#af52de', '#111111', '#ffffff',
];

/**
 * 样式面板滑块的取值范围
 *
 * 上下限同时约束 UI（input[type=range] 的 min/max）与引擎侧写入值，
 * 避免用户拖出 0 像素线宽（图形不可见）或过大字号（超出画面）。
 * 单位均为 CSS 像素，随画布缩放一并缩放。
 */
export const SIZE_RANGE = {
  /** 线宽 / 描边宽度区间：1px 最细可辨识，20px 为粗体强调上限 */
  lineWidth: { min: 1, max: 20 },
  /** 文字字号区间：8px 保证小图可读，72px 为标题级标注上限 */
  fontSize: { min: 8, max: 72 },
} as const;

/**
 * 界面文案表
 *
 * 集中放置所有面向用户的字符串，便于后续接入 i18n 或统一改词；
 * 通过 `as const` 让取值成为字面量类型，模板里可直接使用而无需再做判空。
 */
export const LABELS = {
  /** 拖动手柄的 title：提示整条工具栏可拖动 */
  dragHandle: '拖动工具栏',
  /** 撤销按钮 title，同时标注快捷键（Win/Linux 为 Ctrl+Z） */
  undo: '撤销 (Ctrl+Z)',
  /** 重做按钮 title，同时标注快捷键（Ctrl+Shift+Z 与 Ctrl+Y 均可用） */
  redo: '重做 (Ctrl+Shift+Z)',
  /** 取消按钮文本：放弃本次标注并关闭覆盖层 */
  cancel: '取消',
  /** 确认按钮文本：导出带标注的图片并回传 */
  confirm: '确认',
  /** 样式面板中「粗细」行标签，非文字工具时使用 */
  strokeWidth: '粗细',
  /** 样式面板中「大小」行标签，文字工具时使用 */
  fontSize: '大小',
  /** 样式面板中颜色行标签 */
  color: '颜色',
  /** 自定义颜色取色器的 title 提示 */
  customColor: '自定义颜色',
} as const;
