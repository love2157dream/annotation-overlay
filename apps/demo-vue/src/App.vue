<template>
    <div class="demo-container">
        <button class="open-btn" @click="openAnnotation">✏️ 添加标注</button>

        <div class="target-area" ref="targetRef">
            <h2>📊 数据看板</h2>
            <div class="card-grid">
                <div class="card">
                    <div class="icon">📈</div>
                    <div>总销售额</div>
                    <div>¥128,430</div>
                </div>
                <div class="card">
                    <div class="icon">👥</div>
                    <div>用户数</div>
                    <div>3,847 人</div>qqqqqqqqw
                </div>
                <div class="card">
                    <div class="icon">🛒</div>
                    <div>订单量</div>
                    <div>1,203 单</div>
                </div>
                <div class="card">
                    <div class="icon">⭐</div>
                    <div>好评率</div>
                    <div>98.6%</div>
                </div>
            </div>
        </div>

        <AnnotationOverlay ref="annoRef" @confirm="handleConfirm" @cancel="handleCancel" />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AnnotationOverlay, { type ConfirmPayload } from '@laoliangfe/annotation-overlay-vue';

const annoRef = ref();
const targetRef = ref<HTMLElement>();

const openAnnotation = () => {
    if (targetRef.value) {
        annoRef.value?.open(targetRef.value);
    }
};

const handleConfirm = (payload: ConfirmPayload | null) => {
    if (payload) {
        console.log('✅ 确认标注:', payload);
    } else {
        console.log('⚠️ 未进行任何标注');
    }
};

const handleCancel = () => {
    console.log('❌ 取消标注');
};
</script>

<style scoped>
.demo-container {
    max-width: 800px;
    margin: 40px auto;
    padding: 20px;
    position: relative;
}

.target-area {
    padding: 24px;
    background: #f8fafc;
    border-radius: 12px;
    min-height: 400px;
}

.card-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-top: 16px;
}

.card {
    padding: 20px;
    background: white;
    border-radius: 8px;
    text-align: center;
    border: 1px solid #e2e8f0;
}

.card .icon {
    font-size: 28px;
    margin-bottom: 8px;
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
    z-index: 100;
}

.open-btn:hover {
    transform: translateY(-2px);
}
</style>