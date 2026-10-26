/**
 * @file 文字工具
 *
 * 交互：点击空白处 → 在点击位置创建空 IText 并设为选中 → 延迟 100ms 进入编辑。
 * 编辑退出后的「空文字自动删除 / 非空保存历史」由引擎统一处理
 * （exitTextEditing 同步保存 + text:editing:exited 兜底），工具不重复写历史。
 *
 * 注意：enterEditing 必须在下一轮事件循环（此处 100ms）之后调用，否则 Fabric
 * 的隐藏 textarea 尚未挂到 DOM，focus 会失败、输入框无法输入；延迟回调中还要
 * 校验 `text.canvas === canvas`，因为期间画布可能已被销毁或文字已被删除。
 *
 * @see src/engine/createCanvasEngine.ts
 */

import * as fabric from 'fabric';
import type { BaseToolInstance, ToolContext } from './createBaseTool';
import { getCanvasPointer } from '../utils';

/**
 * 文字工具：点击创建 IText → 延迟进入编辑
 * 编辑退出与历史保存由引擎统一处理（exitTextEditing + text:editing:exited 兜底）
 *
 * @param ctx 工具上下文，仅使用 getConfig 读取字号与颜色
 * @returns 实现 BaseToolInstance 的文字工具；onMouseMove/onMouseUp 为空实现
 *
 * @example
 * const tool = createTextTool(ctx);
 * canvas.add(new fabric.IText('')); // 工具内部已完成，无需手动 enterEditing
 */
export function createTextTool(ctx: ToolContext): BaseToolInstance {
  return {
    id: 'text',

    /**
     * 按下：创建空文字并进入编辑
     *
     * 副作用：向画布添加 IText、设为活动对象、注册 100ms 定时器，
     * 定时器回调会聚焦隐藏 textarea（触发 text:editing:entered 事件）。
     *
     * @param opt Fabric 事件信息，opt.e 为原生 MouseEvent，opt.target 为命中的对象
     * @param canvas 当前画布实例
     */
    onMouseDown(opt: any, canvas: any) {
      const e = opt.e as MouseEvent;
      // 右键或点在已有对象上：交给 Fabric 处理选择，不新建文字
      if (e.button === 2 || opt.target) return;

      const p = getCanvasPointer(e, canvas.getElement(), canvas.getWidth(), canvas.getHeight());
      const cfg = ctx.getConfig();
      // 先创建空内容：用户输入什么就是什么，避免出现默认占位文字残留
      const text = new fabric.IText('', {
        left: p.x,
        top: p.y,
        fill: cfg.color,
        fontSize: cfg.fontSize,
        // 固定 Arial：截图场景不引入额外字体资源，跨平台表现稳定
        fontFamily: 'Arial',
        selectable: true,
        hasControls: true,
        // 光标颜色需与文字同色，否则深色文字在深色背景上看不见光标
        cursorColor: cfg.color,
        cursorWidth: 2,
      });

      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.requestRenderAll();

      // 延迟进入编辑模式，确保 DOM 已更新（与原版一致）
      setTimeout(() => {
        // 期间可能已销毁画布或被切走（text.canvas 置空），此时直接放弃
        if (text.canvas !== canvas) return;
        text.enterEditing();
        const ta = text.hiddenTextarea as HTMLTextAreaElement | null;
        if (ta) {
          ta.focus();
          // 光标置到开头，空文本时 selection 需显式复位
          ta.selectionStart = 0;
          ta.selectionEnd = 0;
        }
      }, 100);
    },

    /** 移动不做处理：文字位置由 Fabric 拖拽控制，不跟随鼠标绘制 */
    onMouseMove: () => {},
    /** 抬起不做处理：进入编辑后由 textarea 接管输入 */
    onMouseUp: () => {},

    /** 销毁：无草稿状态需要清理（文字对象由引擎/画布管理） */
    destroy() {},
  };
}
