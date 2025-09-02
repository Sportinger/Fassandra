# Fassandra Editor - Collaborative Scriptwriting Platform

> **Status: ✅ REFACTORED & OPTIMIZED** (2025)
> 
> This editor has been completely refactored from a monolithic structure to a modern, modular architecture with comprehensive mobile responsiveness and DIN A4 formatting consistency.

## 🎯 **Overview**

The Fassandra Editor is a sophisticated collaborative scriptwriting platform built with React, TipTap, and Yjs. It provides real-time collaboration, mobile-optimized editing, and maintains professional DIN A4 scriptwriting formatting across all devices.

## 🏗️ **Architecture (Post-2025 Refactoring)**

### **Modular Structure**
```
editor/
├── components/
│   ├── Editor.tsx           # Main orchestrator
│   ├── page/PageCanvas.tsx  # DIN A4 page container
│   ├── toolbar/Toolbar.tsx  # Context-aware floating toolbar
│   └── ui/                  # Reusable UI components
├── hooks/
│   ├── useResponsiveDesign.ts    # Device detection & responsive config
│   ├── useEditorCore.ts          # TipTap/Yjs integration
│   └── useEditorInstance.ts      # Editor lifecycle management
├── styles/
│   ├── variables.css        # Design tokens
│   ├── responsive.css       # DIN A4 responsive scaling
│   └── toolbar.css          # Toolbar animations & positioning
├── types/                   # Comprehensive TypeScript definitions
├── extensions/              # TipTap custom extensions
└── utils/                   # Content processing utilities
```

### **Key Improvements**
- **🧹 Code Cleanup**: Removed 85KB+ of legacy code (7 old files, 3,241 lines)
- **📱 Mobile First**: Bottom toolbar on mobile, proper touch targets
- **🎨 Responsive Design**: CSS custom properties with clamp() for fluid scaling
- **⚡ Performance**: Modular imports, optimized bundle splitting
- **🔧 Type Safety**: Comprehensive TypeScript coverage
- **🎪 Animations**: Smooth context-aware toolbar transitions

## 🎨 **Features**

### **Context-Aware Toolbar**
- **Default Context**: View controls (single/multiple pages, ruler, print)
- **Text Selection**: Bold, italic, font size, text alignment
- **Dialogue Block**: Layout switching (stacked/side-by-side), exit controls
- **Speaker Selection**: Speaker dropdown with name management
- **Empty Page**: Dialogue block insertion, page splitting

### **Mobile Optimization** 
- **Bottom Toolbar**: Touch-friendly positioning on mobile devices
- **Responsive Scaling**: Maintains DIN A4 proportions (1:1.414 ratio)
- **Fluid Typography**: Font sizes scale proportionally across devices
- **Touch Targets**: 44px minimum touch targets for accessibility

### **Professional Scriptwriting**
- **DIN A4 Format**: Industry-standard page dimensions
- **Speaker Management**: Automatic speaker name extraction and editing
- **Dialogue Blocks**: Structured dialogue with layout options
- **Real-time Collaboration**: Yjs-powered simultaneous editing

### **Performance Features**
- **Lazy Loading**: Components load on demand
- **Debounced Saves**: Efficient server synchronization
- **WebSocket Reconnection**: Automatic connection recovery
- **Memory Management**: Proper cleanup and garbage collection

## 🚀 **Getting Started**

### **Basic Usage**
```tsx
import { Editor } from './components/editor';

function ScriptEditor() {
  return (
    <Editor 
      scriptId="your-script-id"
      initialTitle="My Script"
      onNavigateBack={() => console.log('Back pressed')}
    />
  );
}
```

### **Development**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## 📁 **File Organization**

### **Core Components**
- `components/Editor.tsx` - Main editor orchestrator
- `components/toolbar/Toolbar.tsx` - Enhanced floating toolbar
- `components/page/PageCanvas.tsx` - DIN A4 page container

### **Responsive Design**
- `styles/variables.css` - Design system tokens
- `styles/responsive.css` - Mobile-first responsive rules
- `hooks/useResponsiveDesign.ts` - Device detection logic

### **Legacy Components** (Still Used)
- `FontSizeDropdown.tsx` - Font size selection
- `SpeakerDropdown.tsx` - Speaker name management
- `Ruler.tsx` - Page measurement ruler
- `ViewModes/` - Single/multiple page views

## 🧹 **Cleanup Summary (2025)**

**Successfully Removed:**
- ❌ `Editor.tsx` (16KB, 474 lines) - Old monolithic editor
- ❌ `FloatingToolbar.tsx` (12KB, 393 lines) - Legacy toolbar
- ❌ `Editor.module.css` (33KB, 1474 lines) - CSS with mobile hacks
- ❌ `Editor.mobile.css` (13KB, 489 lines) - Mobile-specific overrides
- ❌ `Editor.mobile.nuclear.css` (8.8KB, 319 lines) - Aggressive mobile CSS
- ❌ `types.ts` (1.7KB, 58 lines) - Old type definitions
- ❌ `ContextMenu.tsx` (1KB, 34 lines) - Legacy context menu

**Total Cleanup:** 85.5KB, 3,241 lines of legacy code removed ✨

**Result:** Clean, maintainable, modular architecture with identical functionality and superior mobile experience.

## 🎪 **Mobile Experience**

### **Responsive Behavior**
- **Desktop** (1024px+): Left-side floating toolbar
- **Tablet** (768-1023px): Adapted sizing and spacing
- **Mobile** (0-767px): Bottom toolbar with slide-up animations

### **DIN A4 Scaling**
```css
:root {
  --page-width: clamp(300px, 85vw, 21cm);
  --page-height: calc(var(--page-width) * 1.414);
  --font-size-base: clamp(15px, 2.2vw, 16px);
}
```

### **Touch Optimization**
- Minimum 44px touch targets
- Gesture-friendly interactions
- Optimized keyboard behavior
- Smooth scrolling and zooming

## 🔧 **API Integration**

### **Editor Hooks**
```tsx
const {
  editor,                    // TipTap editor instance
  speakerNames,             // Set of speaker names
  connectionStatus,         // WebSocket status
  toolbarContext,          // Current toolbar context
  retryConnection         // Reconnection function
} = useEditorCore({
  scriptId,
  user,
  token,
  initialTitle
});
```

### **Responsive Configuration**
```tsx
const {
  config,          // Breakpoint and viewport info
  isMobile,        // Boolean mobile detection
  dimensions      // Responsive dimension config
} = useResponsiveDesign();
```

## 🎨 **Styling Philosophy**

### **Design Tokens**
- CSS custom properties for consistency
- Mobile-first responsive design
- Fluid typography and spacing
- Semantic color system

### **Component Styling**
- Scoped CSS modules where needed
- Global responsive utilities
- Animation and transition consistency
- Dark mode support preparation

## 🚀 **Performance Optimizations**

### **Bundle Optimization**
- Tree-shakable imports
- Lazy-loaded components
- Code splitting by route
- Optimized asset loading

### **Runtime Performance**
- Efficient re-renders with React.memo
- Debounced API calls
- Memory leak prevention
- WebSocket connection pooling

---

**Built with ❤️ for professional scriptwriting**
*Fassandra Editor - Where stories come to life collaboratively* ✨ 
