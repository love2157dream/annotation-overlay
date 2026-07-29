import React, { useRef, useState } from 'react';
import { AnnotationOverlay, type AnnotationOverlayRef, type ConfirmPayload } from '@laoliangfe/annotation-overlay-react';

const App: React.FC = () => {
  const annoRef = useRef<AnnotationOverlayRef>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const openAnnotation = () => {
    if (targetRef.current) {
      annoRef.current?.open(targetRef.current);
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

  return (
    <div className="demo-container">
      <button className="open-btn" onClick={openAnnotation}>✏️ 添加标注</button>

      <div className="target-area" ref={targetRef}>
        <h2>📊 数据看板</h2>
        <div className="card-grid">
          <div className="card"><div className="icon">📈</div><div>总销售额</div><div>¥128,430</div></div>
          <div className="card"><div className="icon">👥</div><div>用户数</div><div>3,847 人</div></div>
          <div className="card"><div className="icon">🛒</div><div>订单量</div><div>1,203 单</div></div>
          <div className="card"><div className="icon">⭐</div><div>好评率</div><div>98.6%</div></div>
        </div>
      </div>

      <AnnotationOverlay
        ref={annoRef}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default App;