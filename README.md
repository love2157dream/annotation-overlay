## 📁 完整项目文件清单

```text
annotation-overlay-fe/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   │   ├── CanvasEngine.ts
│   │   │   │   ├── EventBus.ts
│   │   │   │   └── ToolManager.ts
│   │   │   ├── tools/
│   │   │   │   ├── BaseTool.ts
│   │   │   │   ├── PenTool.ts
│   │   │   │   ├── RectTool.ts
│   │   │   │   ├── EllipseTool.ts
│   │   │   │   ├── ArrowTool.ts
│   │   │   │   ├── PolylineTool.ts
│   │   │   │   ├── TextTool.ts
│   │   │   │   └── index.ts
│   │   │   ├── history/
│   │   │   │   ├── HistoryManager.ts
│   │   │   │   └── index.ts
│   │   │   ├── capture/
│   │   │   │   ├── domCapture.ts
│   │   │   │   └── index.ts
│   │   │   ├── controls/
│   │   │   │   ├── objectControls.ts
│   │   │   │   └── index.ts
│   │   │   ├── primitives/
│   │   │   │   ├── createArrow.ts
│   │   │   │   ├── createRect.ts
│   │   │   │   ├── createEllipse.ts
│   │   │   │   ├── createPolyline.ts
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   ├── tool.ts
│   │   │   │   ├── canvas.ts
│   │   │   │   ├── history.ts
│   │   │   │   ├── events.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   ├── pointer.ts
│   │   │   │   ├── geometry.ts
│   │   │   │   ├── fabricHelper.ts
│   │   │   │   └── index.ts
│   │   │   ├── config/
│   │   │   │   └── defaults.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── vue/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── AnnotationOverlay.vue
│   │   │   │   ├── Toolbar.vue
│   │   │   │   └── StylePanel.vue
│   │   │   ├── composables/
│   │   │   │   └── useAnnotationEngine.ts
│   │   │   ├── constants/
│   │   │   │   └── icons.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── react/
│       ├── src/
│       │   ├── components/
│       │   │   ├── AnnotationOverlay.tsx
│       │   │   ├── Toolbar.tsx
│       │   │   └── StylePanel.tsx
│       │   ├── hooks/
│       │   │   └── useAnnotationEngine.ts
│       │   ├── constants/
│       │   │   └── icons.tsx
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── apps/
│   ├── demo-vue/
│   │   ├── src/
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── demo-react/
│       ├── src/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```
