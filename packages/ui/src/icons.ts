/**
 * @file SVG 图标数据表（框架无关）
 *
 * 图标以「几何描述」而非组件形式存在：每条记录只含 viewBox / paths / circles，
 * 由各框架适配层（本仓库的 Icon.vue、react/angular 各自的图标组件）渲染成 <svg>。
 * 这样 ui 包无需引入任何框架运行时，也能保证三端图标形状完全一致。
 *
 * 注意：这里只存 stroke 型路径与 fill 型圆点两类图元，刻意不支持任意 SVG 标签，
 * 以免适配层难以对齐渲染逻辑；需要新图元时应扩展 AnnoIcon 并同步三个适配层。
 *
 * @see ./data.ts 工具列表按 icon 字段引用本表的键
 * @see ../../vue/src/components/Icon.vue 消费方示例
 */

/** 单个图标的几何描述 */
export interface AnnoIcon {
  /** 画布视野，默认 0 0 24 24 */
  viewBox?: string;
  /** stroke 型路径（配合 fill:none / stroke:currentColor） */
  paths?: string[];
  /** fill 型圆点 [cx, cy, r]（拖动手柄等实心图形） */
  circles?: Array<[number, number, number]>;
}

/**
 * 内置图标表
 *
 * 约定：所有图标统一画在 24×24 网格内、线宽 2（由 Icon 组件设置），
 * 颜色一律用 currentColor 继承按钮文字色，因此这里不出现任何颜色值。
 * 描边型图标沿用 feather icons 的路径习惯（圆头圆角），保证视觉风格一致。
 */
export const annoIcons = {
  // 撤销：向左回转箭头，末端带一个水平甩尾
  undo: { paths: ['M9 14L4 9l5-5M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5h-1'] },
  // 重做：撤销的水平镜像
  redo: { paths: ['M15 14l5-5-5-5M20 9H9a5 5 0 00-5 5v0a5 5 0 005 5h1'] },
  // 画笔：一支倾斜的笔，笔尖落在左下角
  pen: { paths: ['M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'] },
  // 折线：三段折线示意多点路径
  line: { paths: ['M2 20 L8 8 L14 16 L22 4'] },
  // 箭头：主对角线 + 右上角两条短线构成箭头头部
  arrow: { paths: ['M4 20L20 4M20 4h-8M20 4v8'] },
  // 矩形：空心方框
  rect: { paths: ['M4 5h16v14H4z'] },
  // 椭圆：以 (12,12) 为中心、rx=8 / ry=6 的扁椭圆
  ellipse: { paths: ['M12 6a8 6 0 100 12 8 6 0 000-12z'] },
  // 文字：大写字母 T，横杠加竖笔
  text: { paths: ['M5 5h14M12 5v14'] },
  drag: {
    // 拖动手柄：3×3 点阵，用 fill 型圆点表达「可抓取」的网格语义
    circles: [
      [5, 5, 2], [12, 5, 2], [19, 5, 2],
      [5, 12, 2], [12, 12, 2], [19, 12, 2],
      [5, 19, 2], [12, 19, 2], [19, 19, 2],
    ] as Array<[number, number, number]>,
  },
  // satisfies 而非类型断言：既保留每个键的字面量类型供 keyof 推导，又校验形状
} satisfies Record<string, AnnoIcon>;

/** 图标名联合类型，由图标表键名自动推导，新增图标无需改类型 */
export type AnnoIconName = keyof typeof annoIcons;
