import React from 'react';

/**
 * SVG 图标组件
 */
export const IconUndo: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 14L4 9l5-5M4 9h11a5 5 0 015 5v0a5 5 0 01-5 5h-1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconRedo: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 14l5-5-5-5M20 9H9a5 5 0 00-5 5v0a5 5 0 005 5h1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ToolIcons: Record<string, React.ReactNode> = {
  pen: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  line: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20 L8 8 L14 16 L22 4" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  arrow: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20L20 4M20 4h-8M20 4v8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  rect: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v14H4z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  ellipse: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6a8 6 0 100 12 8 6 0 000-12z" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  text: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5h14M12 5v14" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};