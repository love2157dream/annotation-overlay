<!--
  @file Vue 3 演示页：仿 Vue 官网风格的迷你首页，同时是标注覆盖层的测试靶场

  页面自上而下由四部分组成：
  1. .content-area（ref="targetRef"）——待标注区域。覆盖层会按它的
     getBoundingClientRect() 决定画布尺寸，因此它必须完整落在视口内；
  2. .preview-area —— 标注预览区，确认后把导出的 base64 图片塞进 <img>；
  3. <AnnotationOverlay> —— 覆盖层组件本体，常驻挂载、默认隐藏，靠 ref 打开；
  4. .open-btn —— 右下角固定按钮，调用覆盖层的 open()。

  注意：
  - 演示页的内容高度是刻意压缩的，并有 @media (max-height: 800px) 二次收紧；
    一旦目标元素超出视口，截图会被裁掉超出部分，看起来像「标注跑偏」。
  - 第一段 <style> 不带 scoped，负责 html/body 归零；第二段 scoped 里定义
    --brand* 品牌变量，改主题色只需动 .app-container 顶部那几个变量。

  @see ./main.ts 应用入口（挂载 + 引入组件样式）
  @see ../../demo-react/src/App.tsx 同一套页面的 React 实现
  @see ../../demo-angular/src/app/app.component.ts 同一套页面的 Angular 实现
-->
<template>
    <!-- 页面根容器：纵向 flex，顶部 4px 品牌色条由 ::before 绘制 -->
    <div class="app-container">
        <!-- 待标注区域：占据主要面积，标注时画布与它等大 -->
        <div class="content-area" ref="targetRef">
            <!-- Hero：仿官网首屏，文案纯静态，只作为截图素材 -->
            <div class="hero">
                <div class="hero-main">
                    <!-- eyebrow：全大写的小号引导语，颜色取品牌色 -->
                    <p class="hero-eyebrow">The Progressive Framework</p>
                    <!-- 主标题 + 框架胶囊：胶囊用于在三个 demo 之间做视觉区分 -->
                    <h2>渐进式 JavaScript 框架 <span class="fw-tag">Vue 3</span></h2>
                    <!-- 简介：max-width 620px 约束行长，避免宽屏下一行过长 -->
                    <p class="hero-desc">
                        易学易用、性能出色、灵活多变 —— 用单文件组件构建现代 Web 界面，从一行 CDN 到大型 SPA 都能胜任。
                    </p>
                    <!-- 按钮组：按钮不绑事件，仅作为可标注的视觉元素存在 -->
                    <div class="hero-actions">
                        <button type="button" class="btn-primary">开始使用</button>
                        <button type="button" class="btn-ghost">查看文档</button>
                    </div>
                </div>
                <!-- 右侧方形图标：纯色块 + 单字母，代替真实 logo 以避开版权素材 -->
                <div class="hero-logo">V</div>
            </div>

            <!-- 特性卡：数据来自 script 里的 features，三列等宽网格 -->
            <div class="feature-grid">
                <div v-for="item in features" :key="item.title" class="feature">
                    <span class="feature-icon">{{ item.icon }}</span>
                    <h3>{{ item.title }}</h3>
                    <p>{{ item.desc }}</p>
                </div>
            </div>

            <!-- 生态标签：一行小胶囊，用品牌色的浅底 + 描边强调 -->
            <div class="eco">
                <span class="eco-label">生态</span>
                <span v-for="name in ecosystem" :key="name" class="chip">{{ name }}</span>
            </div>
        </div>

        <!-- 标注预览：确认后把导出的图片显示在这里 -->
        <div class="content-area preview-area">
            <h2>标注预览</h2>
            <!-- 有结果就渲染图片，dataURL 直接可用，无需再转 Blob -->
            <img v-if="previewImg" :src="previewImg" alt="标注结果" />
            <!-- 无结果时的占位提示，避免预览区塌成空白 -->
            <p v-else class="preview-empty">点击右下角「添加标注」，完成后标注结果会显示在这里</p>
        </div>

        <!-- 覆盖层组件：ref 拿命令式句柄，confirm/cancel 由组件内部按钮触发 -->
        <AnnotationOverlay ref="annoRef" @confirm="handleConfirm" @cancel="handleCancel" />

        <!-- 唯一入口按钮：不传目标元素，targetRef 在方法内部解析 -->
        <button class="open-btn" @click="openAnnotation">✏️ 添加标注</button>
    </div>
</template>

<script setup lang="ts">
/**
 * @file Vue 演示页逻辑：持有目标元素与预览图状态，把覆盖层事件接到页面上
 *
 * 组件本身不渲染触发按钮，打开时机与目标元素都由使用方决定：
 * 通过 ref 调用 open(el)，覆盖层内部会截图并接管交互，
 * 确认时回传 { base64, blob }，取消时不回传任何数据。
 *
 * 注意：payload 为 null 是兜底分支（截图或导出失败），必须判空，
 * 直接读 payload.base64 会在运行时报错。
 *
 * @see ./App.vue 模板与样式
 * @see packages/core/src/types/index.ts ConfirmPayload 定义
 */
import { ref } from 'vue';
// 组件与公共类型都从框架包取：使用方不应安装 core / ui 这类内部包
import AnnotationOverlay, { type ConfirmPayload } from '@laoliangfe/annotation-overlay-vue';

/**
 * 覆盖层组件实例引用
 * 模板中通过 ref="annoRef" 赋值，挂载完成前为 undefined，故调用处用可选链。
 * 类型交给组件自身推导——这里不写泛型，避免和组件内部导出的句柄类型耦合。
 */
const annoRef = ref();

/**
 * 待标注的 DOM 元素（模板里 ref="targetRef" 的那个 .content-area）
 * 首次渲染后赋值；只在 openAnnotation 中读取，传给覆盖层作为截图目标。
 */
const targetRef = ref<HTMLElement>();

/**
 * 标注结果图（PNG dataURL），空串表示尚未确认过
 * 赋值时机：handleConfirm 收到非空 payload 时；取消时保持不变。
 */
const previewImg = ref('');

/** 参考 Vue 官网首页的三个核心卖点 */
const features = [
    { icon: '⚡', title: '极速响应', desc: '基于 Proxy 的细粒度响应式系统，依赖追踪精确到属性。' },
    { icon: '🧩', title: '组件化', desc: '单文件组件把模板、逻辑与样式收敛在同一个文件里。' },
    { icon: '🌱', title: '渐进式', desc: '从一行 CDN 引入到大型应用，按需采纳、平滑演进。' },
];

/** 周边生态 */
const ecosystem = ['Vite', 'Pinia', 'Vue Router', 'Nuxt', 'DevTools'];

/**
 * 打开标注覆盖层
 *
 * 目标元素取自 targetRef；若组件尚未挂载或目标被条件渲染移除则直接跳过，
 * 避免把 undefined 传给 open() 导致内部 getBoundingClientRect 抛错。
 *
 * 副作用：覆盖层变为可见，页面滚动被锁定（由组件内部处理）。
 *
 * @returns 无返回值；open() 内部是异步的（返回 Promise），这里刻意不等待
 * @example
 * // 模板中绑定：<button @click="openAnnotation">添加标注</button>
 * // 与下面等价，但更推荐用 ref 由页面决定目标：
 * // annoRef.value?.open(document.querySelector('.content-area')!)
 */
const openAnnotation = () => {
    if (targetRef.value) {
        annoRef.value?.open(targetRef.value);
    }
};

/**
 * 覆盖层「确认」回调
 *
 * @param payload 导出结果；null 表示截图或导出失败，此时不更新预览区
 * @returns 无返回值
 * 副作用：写入 previewImg 驱动 <img> 重新渲染；同时打印日志便于调试
 */
const handleConfirm = (payload: ConfirmPayload | null) => {
    if (!payload) {
        console.log('⚠️ 未进行任何标注');
        return;
    }
    // 取 base64（dataURL）直出预览；payload.blob 留给上传场景使用
    previewImg.value = payload.base64;
    console.log('✅ 确认标注:', payload);
};

/**
 * 覆盖层「取消」回调（点击取消按钮或按 Esc 触发）
 *
 * @returns 无返回值
 * 副作用：仅打日志；预览区保留上一次的标注结果，方便对比
 */
const handleCancel = () => {
    console.log('❌ 取消标注');
};
</script>

<style>
/*
 * 全局基线样式（无 scoped）
 *
 * 这一段会作用到整个文档：demo 是独立页面，没有外部样式表兜底，
 * 所以必须自己清掉浏览器默认的 body 边距，否则目标元素会整体偏移，
 * 截图区域与视觉区域对不上。
 */
html,
body {
    /* 清掉默认外边距与内边距，让 .app-container 顶到视口边缘 */
    margin: 0;
    padding: 0;
    min-height: 100%;
}

body {
    /* 字体栈按平台优先级排列：先系统 UI 字体，再回落到中文黑体系 */
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
        'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    /* 正文色 slate-800，与设计稿保持同一灰阶 */
    color: #1e293b;
    background: #fff;
}
</style>

<style scoped>
/*
 * 演示页布局与主题（scoped）
 *
 * 所有尺寸都围绕一个目标设计：让 .content-area 在常见窗口高度下
 * 完整可见。间距、字号因此普遍偏小，不要按常规落地页的标准去调大。
 */

/* ========== 布局骨架 ========== */
.app-container {
    /* 框架品牌色（Vue 绿） */
    --brand: #42b883; /* 主品牌色：eyebrow 文字、浅色系强调 */
    --brand-2: #2f9e72; /* 深一档的品牌色，备用；现有渐变里仍直接写同色值 */
    --brand-grad: linear-gradient(135deg, #42b883, #2f9e72); /* 主按钮与图标块的渐变底 */
    --brand-soft: rgba(66, 184, 131, 0.12); /* 12% 透明度的品牌色，用作 chip 底色 */
    --brand-ring: rgba(66, 184, 131, 0.28); /* chip 描边色，比底色略实 */
    --brand-ink: #2f8f68; /* chip 文字色，保证在浅底上仍有对比度 */
    --brand-shadow: rgba(66, 184, 131, 0.55); /* 彩色投影基色，营造「发光」感 */

    /* 相对定位：给顶部的 ::before 色条做定位参照 */
    position: relative;
    display: flex;
    flex-direction: column;
    /* 区域之间 18px：既区分层次，又不会把内容顶出视口 */
    gap: 18px;
    /* border-box 很关键：min-height 含 padding，避免 100vh 溢出出现滚动条 */
    box-sizing: border-box;
    /* 撑满视口，让两个 .content-area 有足够高度可分配 */
    min-height: 100vh;
    /* 顶部留 24px 给那条 4px 色条留呼吸空间 */
    padding: 24px 20px 20px;
}

/* 顶部框架主题色条：切换 demo 时一眼能看出区别 */
.app-container::before {
    content: '';
    /* 绝对定位贴住视口顶部，不占文档流高度 */
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    /* 4px 厚：与 docs/index.html 的 .accent-bar 保持一致 */
    height: 4px;
    background: linear-gradient(90deg, #42b883, #2f9e72);
}

/* ========== 框架标识 ========== */
/* 框架标识胶囊 */
.fw-tag {
    /* inline-block：让 padding 与 border-radius 在行内文本中生效 */
    display: inline-block;
    /* 与主标题文字拉开距离，又不会换行到独立一行 */
    margin-left: 10px;
    padding: 3px 11px;
    border-radius: 999px;
    background: linear-gradient(135deg, #42b883, #2f9e72);
    color: #fff;
    /* 比主标题小一档，视觉上从属于标题 */
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.3px;
    /* 以文字中线对齐，避免基线对齐产生的高低位错 */
    vertical-align: middle;
    box-shadow: 0 4px 12px -4px rgba(66, 184, 131, 0.9);
}

/* ========== 待标注区域 / 预览区 ========== */
/* 待标注区域：flex 子项，与预览区按 1:1 分享剩余高度 */
.content-area {
    /* 相对定位：内部绝对定位元素（如有）以它为参照 */
    position: relative;
    /* flex:1 1 0 → 上下两块等高；高度不足时允许收缩，但受 min-height 兜底 */
    flex: 1 1 0;
    box-sizing: border-box;
    /* 300px 下限：太矮时画布几乎不可绘制，也会把内容挤到溢出 */
    min-height: 300px;
    padding: 20px 24px;
    background: #f8fafc;
    /* 虚线边框：明确暗示「这块是截图目标」 */
    border: 2px dashed #e2e8f0;
    border-radius: 12px;
    /* 裁掉可能溢出的内容，同时避免圆角处露出直角背景 */
    overflow: hidden;
}

/* ---- Hero：仿框架官网首屏介绍 ---- */
/* Hero 区：左文案 + 右图标，垂直居中 */
.hero {
    display: flex;
    align-items: center;
    /* 文案与图标之间 20px */
    gap: 20px;
    margin-bottom: 16px;
}

/* 文案容器：flex:1 吃掉剩余宽度 */
.hero-main {
    flex: 1;
    /* min-width:0 允许在 flex 容器中被压缩，否则长文本会把图标挤出容器 */
    min-width: 0;
}

/* eyebrow 小标题：全大写 + 大字距，模仿官网的首屏引导语 */
.hero-eyebrow {
    margin: 0 0 4px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: var(--brand);
}

/* 主标题：22px / 1.25，兼顾可读性与纵向占用 */
.hero h2 {
    margin: 0 0 6px;
    font-size: 22px;
    line-height: 1.25;
}

/* 简介段落：浅灰正文色，行高 1.6 提升小字号下的可读性 */
.hero-desc {
    margin: 0;
    /* 限制行长，超过 620px 后换行，避免超宽屏一行过长 */
    max-width: 620px;
    font-size: 12.5px;
    line-height: 1.6;
    color: #64748b;
}

/* 按钮行：不换行，保持两个按钮始终并排 */
.hero-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: nowrap;
}

/* 按钮公共样式：主按钮与次要按钮共享尺寸与交互反馈 */
.btn-primary,
.btn-ghost {
    /* flex:0 0 auto + nowrap：打开工具条后页面宽度可能变化，禁止按钮被压缩后断行 */
    flex: 0 0 auto;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    /* 继承 body 字体栈，避免 <button> 回落到浏览器默认字体 */
    font-family: inherit;
    white-space: nowrap;
    cursor: pointer;
    /* 只过渡位移与投影，避免颜色过渡带来的迟滞感 */
    transition: transform 0.2s, box-shadow 0.2s;
}

/* 主按钮：品牌渐变底 + 彩色投影 */
.btn-primary {
    border: none;
    color: #fff;
    background: var(--brand-grad);
    box-shadow: 0 6px 14px -6px var(--brand-shadow);
}

/* 次要按钮：白底 + 细描边，弱化存在感 */
.btn-ghost {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #475569;
}

/* 悬停位移：只上移 1px，克制的手感反馈 */
.btn-primary:hover,
.btn-ghost:hover {
    transform: translateY(-1px);
}

/* 右侧图标块：固定 64×64，不参与压缩 */
.hero-logo {
    /* grid + place-items 让单字母在块内水平垂直居中 */
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    /* flex:none：禁止在窄容器里被压扁 */
    flex: none;
    border-radius: 18px;
    background: var(--brand-grad);
    color: #fff;
    font-size: 26px;
    font-weight: 800;
    box-shadow: 0 16px 30px -16px var(--brand-shadow);
}

/* ---- 特性卡片 ---- */
/* 三列等宽网格：minmax(0,1fr) 防止长单词撑破列宽 */
.feature-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}

/* 单张卡片：白底 + 极浅投影，与 .content-area 的灰底形成层次 */
.feature {
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

/* 卡片图标：emoji 渲染，行高 1 避免 emoji 自带行距把标题推低 */
.feature-icon {
    font-size: 15px;
    line-height: 1;
}

/* 卡片标题 */
.feature h3 {
    margin: 5px 0 3px;
    font-size: 13.5px;
}

/* 卡片正文：小字号 + 1.55 行高，三行以内不撑高卡片 */
.feature p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    color: #64748b;
}

/* ---- 生态标签 ---- */
/* 标签行：允许换行，窄屏时自动折到第二行而不是溢出 */
.eco {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 14px;
    flex-wrap: wrap;
}

/* 「生态」前缀：更浅的灰，弱于右侧胶囊 */
.eco-label {
    font-size: 11px;
    letter-spacing: 0.6px;
    color: #94a3b8;
}

/* 生态胶囊：品牌浅底 + 描边，与 .fw-tag 的实心样式区分开 */
.chip {
    padding: 3px 10px;
    border: 1px solid var(--brand-ring);
    border-radius: 999px;
    background: var(--brand-soft);
    color: var(--brand-ink);
    font-size: 11.5px;
    font-weight: 600;
}

/* ---- 预览区 ---- */
/* 预览区复用 .content-area，仅改为纵向排布：标题在上、图片在下 */
.preview-area {
    display: flex;
    flex-direction: column;
}

/* 预览区标题：与 Hero 主标题同字号，保持页面节奏一致 */
.preview-area h2 {
    margin: 0 0 8px;
    font-size: 22px;
}

/* 窗口较矮时收紧间距，保证内容完整落在标注区域内 */
@media (max-height: 800px) {
    /* 内边距先缩，收益最大且不影响字号可读性 */
    .content-area {
        padding: 14px 18px;
    }
    .hero {
        margin-bottom: 10px;
    }
    /* 简介降一档字号并收紧行高，通常能省出一整行高度 */
    .hero-desc {
        font-size: 11.5px;
        line-height: 1.5;
    }
    .hero-actions {
        margin-top: 8px;
    }
    .feature {
        padding: 10px 12px;
    }
    .feature p {
        font-size: 11px;
    }
    .eco {
        margin-top: 10px;
    }
}

/* 预览图：等比缩放到容器宽度，圆角与卡片保持一致 */
.preview-area img {
    display: block;
    max-width: 100%;
    margin-top: 12px;
    border-radius: 8px;
}

/* 空态提示：!important 用于覆盖可能继承来的段落默认样式，保持灰字居中观感 */
.preview-empty {
    margin-top: 12px !important;
    color: #94a3b8 !important;
    font-size: 14px;
}

/* ========== 入口按钮 ========== */
/* 固定定位的打开按钮：不随内容滚动，始终可点 */
.open-btn {
    position: fixed;
    /* 距视口右下各 32px，避开可能的滚动条 */
    bottom: 32px;
    right: 32px;
    /* 高于页面内容，但低于覆盖层（覆盖层内部为极高 z-index） */
    z-index: 100;
    padding: 14px 28px;
    background: linear-gradient(135deg, #42b883, #2f9e72);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 6px 18px -6px rgba(66, 184, 131, 0.95);
    transition: transform 0.2s, box-shadow 0.2s;
}

/* 悬停：上移 2px 并加深投影，营造「浮起」的按压预期 */
.open-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px -8px rgba(66, 184, 131, 1);
}
</style>
