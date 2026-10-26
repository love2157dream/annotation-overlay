/**
 * @file Angular demo 的启动入口
 *
 * 用 bootstrapApplication 以 standalone 方式启动根组件（Angular 15+ 推荐写法，
 * 替代旧的 AppModule + platformBrowserDynamic().bootstrapModule）。
 *
 * 关键点：providers 里注入了 provideZonelessChangeDetection()，即 zoneless 模式：
 * - 不再加载 zone.js，包体更小、启动更快；
 * - 变更检测由调度器按需触发（signal 写入、模板事件监听、markForCheck 等），
 *   而不是「任何异步任务结束后全区检查」。
 * 因此演示页的状态必须用 signal（见 app.component.ts 的 previewImg），
 * 若改成普通类字段再赋值，视图不会更新。
 *
 * @see ./app/app.component.ts 根组件
 * @see ../../../packages/angular/src/index.ts 覆盖层组件入口
 */
import { provideZonelessChangeDetection } from '@angular/core';
// 平台无关的启动函数：内部会自动创建浏览器平台并注册错误处理
import { bootstrapApplication } from '@angular/platform-browser';

// 根组件：standalone，无需 NgModule 包装
import { AppComponent } from './app/app.component';

// 启动应用；启动失败（模板编译错误、依赖注入缺 provider 等）会走 catch
bootstrapApplication(AppComponent, {
  // zoneless 变更检测，详见文件头说明
  providers: [provideZonelessChangeDetection()],
}).catch(err => console.error(err));
