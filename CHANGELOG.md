```markdown
# Changelog

## [1.0.0] - 2026-07-14

### Added
- 初始版本发布
- 支持画笔、折线、箭头、矩形、椭圆、文字工具
- 撤销/重做功能
- 可拖动工具栏
- 截图前/后事件回调
- TypeScript 支持
- 键盘快捷键支持 (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, ESC)

### Fixed
- 矩形和椭圆绘制位置精确
- 文字编辑后光标清除
- 折线绘制连续点击
- 控制手柄方向正确显示

## [1.0.0-rc.1] - 2026-07-15

### Added
- 添加 snapdom 支持，提升截图速度
- 添加 beforeCapture/afterCapture 事件
- 添加 isRestoring 保护，防止 undo/redo 竞态

### Changed
- 优化性能
- 统一控制手柄配置
- 改进历史记录管理

### Fixed
- 修复工具栏位置偏移问题
- 修复文字编辑保存状态问题