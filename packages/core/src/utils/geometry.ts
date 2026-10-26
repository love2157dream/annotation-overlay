/**
 * @file 基础几何计算
 *
 * 与 Fabric 无关的纯数学工具：两点距离、方向角（弧度/角度）、数值裁剪。
 * 目前箭头工厂用 angleDeg 计算旋转角，其余函数供外部扩展与自定义工具使用。
 * 注意：坐标系与画布一致 —— 原点左上、y 轴向下，因此 atan2 得到的是
 * 「屏幕角」，正角度方向为顺时针。
 *
 * @see src/primitives/createArrow.ts
 */

import type { Point } from '../types';

/**
 * 计算两点间直线距离
 *
 * @param p1 起点，画布坐标，单位 px
 * @param p2 终点，画布坐标，单位 px
 * @returns 欧氏距离，单位 px，恒 >= 0
 *
 * @example
 * distance({ x: 0, y: 0 }, { x: 3, y: 4 }); // 5
 */
export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * 计算 p1 指向 p2 的方向角（弧度）
 *
 * @param p1 起点
 * @param p2 终点
 * @returns 弧度值，范围 (-π, π]；0 表示指向 +x（右），π/2 表示指向 +y（下）
 *
 * @example
 * angle({ x: 0, y: 0 }, { x: 0, y: 10 }); // ≈ 1.5708（Math.PI / 2）
 */
export function angle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * 计算 p1 指向 p2 的方向角（角度）
 *
 * 箭头工厂用它与 Fabric Triangle 的默认朝向（尖角朝上）叠加 +90°，
 * 使三角形尖端对齐线段方向。
 *
 * @param p1 起点
 * @param p2 终点
 * @returns 角度值，范围 (-180, 180]；单位度，正值为顺时针（因 y 轴向下）
 *
 * @example
 * angleDeg({ x: 0, y: 0 }, { x: 10, y: 0 }); // 0
 * angleDeg({ x: 0, y: 0 }, { x: 0, y: 10 }); // 90
 */
export function angleDeg(p1: Point, p2: Point): number {
  return angle(p1, p2) * (180 / Math.PI);
}

/**
 * 把数值限制在闭区间内
 *
 * @param v 待裁剪的数值
 * @param min 下界（含）
 * @param max 上界（含）；min > max 时结果恒为 max
 * @returns 裁剪后的值，范围 [min, max]
 *
 * @example
 * clamp(120, 0, 100); // 100
 * clamp(-5, 0, 100);  // 0
 */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
