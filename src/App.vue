<template>
    <div class="app-container">
        <!-- 页面内容 -->
        <div class="content-area" ref="targetRef">
            <h1>📝 组件本地测试</h1>
            <p>这是需要标注的内容区域</p>
            <div class="card-grid">
                <div v-for="i in 4" :key="i" class="card">
                    卡片 {{ i }}
                </div>
            </div>
        </div>

        <!-- 本地导入组件 -->
        <AnnotationOverlay ref="annoRef" @confirm="handleConfirm" @cancel="handleCancel"
            @before-capture="handleBeforeCapture" @after-capture="handleAfterCapture" />

        <!-- 触发按钮 -->
        <button class="open-btn" @click="openAnnotation">✏️ 添加标注</button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
// 关键：使用相对路径从源码目录导入组件
import AnnotationOverlay from './components/AnnotationOverlay/AnnotationOverlay.vue'
// 组件样式在源码中已通过 <style scoped> 定义，无需额外导入

// 如果组件有 index.ts 入口，也可以这样导入
// import AnnotationOverlay from './components/AnnotationOverlay'

import type { ConfirmPayload } from './components/AnnotationOverlay/types'

const annoRef = ref()
const targetRef = ref<HTMLElement>()

const openAnnotation = () => {
    if (targetRef.value) {
        annoRef.value?.open(targetRef.value)
    }
}

const handleConfirm = (payload: ConfirmPayload | null) => {
    if (!payload) {
        console.log('⚠️ 未进行任何标注')
        return
    }
    console.log('✅ 标注确认:', payload)
}

const handleCancel = () => {
    console.log('❌ 取消标注')
}

const handleBeforeCapture = (targetEl: HTMLElement) => {
    console.log('🧹 截图前清理状态')
    targetEl.querySelectorAll('.active, .hover').forEach(el => {
        el.classList.remove('active', 'hover')
    })
}

const handleAfterCapture = (targetEl: HTMLElement) => {
    console.log('🔄 截图后恢复状态')
}
</script>

<style scoped>
.app-container {
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
    position: relative;
}

.content-area {
    padding: 24px;
    background: #f8fafc;
    border-radius: 12px;
    border: 2px dashed #e2e8f0;
    min-height: 400px;
}

.card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-top: 20px;
}

.card {
    padding: 40px 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    text-align: center;
    border: 1px solid #e2e8f0;
}

.open-btn {
    position: fixed;
    bottom: 40px;
    right: 40px;
    padding: 14px 28px;
    background: #4f6bff;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(79, 107, 255, 0.3);
    transition: all 0.2s;
    z-index: 100;
}

.open-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(79, 107, 255, 0.4);
}
</style>