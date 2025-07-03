# Pessoa Collaborative Editor

A modern, responsive collaborative scriptwriting editor built with React, TypeScript, TipTap, and Yjs. Features real-time collaboration, DIN A4 formatting consistency across all devices, and a sophisticated responsive design system.

## 🏗️ Architecture Overview

The editor follows a modular, component-based architecture with clear separation of concerns:

```
/editor
├── /components           # UI Components
│   ├── /toolbar         # Floating toolbar system
│   ├── /page            # Page layout components  
│   ├── /ui              # Reusable UI components
│   └── Editor.tsx       # Main editor component
├── /hooks               # Custom React hooks
├── /styles              # Consolidated CSS system
├── /extensions          # TipTap extensions
├── /utils               # Utility functions
├── /types               # TypeScript definitions
└── index.ts             # Public API
```

## 🎨 Responsive Design System

### DIN A4 Proportional Scaling
- **Desktop**: Full DIN A4 size (21cm × 29.7cm)
- **Tablet**: Proportionally scaled to fit viewport
- **Mobile**: Maintains text flow and line breaks identical to desktop
- **CSS Custom Properties**: Dynamic scaling based on viewport
- **Typography Scale**: Consistent proportions across all devices

### Key Features
- ✅ **Same line breaks** on all devices
- ✅ **Proportional scaling** maintains DIN A4 ratios
- ✅ **No horizontal scrolling** on any device
- ✅ **Touch-optimized** interface for mobile
- ✅ **Consistent typography** across platforms

## 🧩 Component System

### Core Components

#### `Editor.tsx`
Main editor component that orchestrates all sub-systems.

```typescript
interface EditorProps {
  scriptId: string;
  initialTitle?: string;
  onNavigateBack: () => void;
}
```

#### `PageCanvas.tsx`
Handles DIN A4 page rendering with responsive scaling.

#### `CollaborativeEditor.tsx` 
TipTap editor with real-time collaboration features.

#### Toolbar System
- `FloatingToolbar.tsx` - Context-aware morphing toolbar
- `ToolbarButton.tsx` - Reusable button component
- `FontSizeDropdown.tsx` - Font size selection
- `SpeakerDropdown.tsx` - Speaker name management

### Custom Hooks

#### `useEditorCore.ts`
Core editor state and TipTap integration.

#### `useCollaboration.ts`
Yjs document management and WebSocket connectivity.

#### `useResponsiveDesign.ts`
Viewport detection and responsive behavior.

#### `useKeyboardShortcuts.ts`
Keyboard navigation and shortcuts.

## 🎯 Responsive Strategies

### CSS Custom Properties
```css
:root {
  --page-width: clamp(320px, 90vw, 21cm);
  --page-height: calc(var(--page-width) * 1.414);
  --base-font-size: clamp(14px, 2.5vw, 16px);
  --line-height: 1.5;
  --content-padding: clamp(8px, 3vw, 2cm);
}
```

### Breakpoint System
- **Mobile**: < 768px (Touch-optimized, bottom toolbar)
- **Tablet**: 768px - 1024px (Balanced scaling)
- **Desktop**: > 1024px (Full DIN A4 experience)

### Typography Scaling
Uses `clamp()` functions to maintain proportional text sizing while ensuring readability on all devices.

## 🔧 Development Patterns

### Component Structure
```typescript
interface ComponentProps {
  // Always include className for styling flexibility
  className?: string;
  // Use specific types instead of 'any'
  onAction: (data: SpecificType) => void;
  // Default props with sensible defaults
  variant?: 'primary' | 'secondary';
}

export const Component: React.FC<ComponentProps> = ({
  className,
  variant = 'primary',
  ...props
}) => {
  return (
    <div className={clsx(styles.component, styles[variant], className)}>
      {/* Component content */}
    </div>
  );
};
```

### CSS Modules Pattern
```css
/* Component.module.css */
.component {
  /* Mobile-first approach */
  @apply mobile-styles;
}

@media (min-width: 768px) {
  .component {
    @apply tablet-styles;
  }
}

@media (min-width: 1024px) {
  .component {
    @apply desktop-styles;
  }
}
```

### Hook Pattern
```typescript
export const useCustomHook = (dependencies: Dependencies) => {
  const [state, setState] = useState<StateType>(initialState);
  
  // Memoized computations
  const computedValue = useMemo(() => {
    return expensiveComputation(dependencies);
  }, [dependencies]);
  
  // Side effects
  useEffect(() => {
    // Effect logic
    return () => {
      // Cleanup
    };
  }, [dependencies]);
  
  return {
    state,
    actions: {
      updateState: setState,
    },
    computed: {
      computedValue,
    },
  };
};
```

## 📱 Mobile Optimization

### Touch Interface
- **Bottom toolbar** for thumb accessibility
- **Larger touch targets** (44px minimum)
- **Gesture support** for common actions
- **Haptic feedback** on supported devices

### Performance
- **Virtualized rendering** for large documents
- **Debounced updates** to prevent excessive re-renders
- **Optimized bundle splitting** for faster loading
- **Service worker** for offline functionality

### Accessibility
- **Screen reader support** with proper ARIA labels
- **Keyboard navigation** for all functionality
- **High contrast mode** support
- **Reduced motion** preferences respected

## 🚀 Getting Started

### Installation
```bash
npm install
cd frontend
npm run dev
```

### Environment Setup
```bash
# Copy environment template
cp .env.template .env.local

# Configure your settings
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_BASE_URL=ws://localhost:3001
```

### Development Workflow
1. **Component Development**: Use Storybook for isolated component development
2. **Responsive Testing**: Test across multiple device sizes
3. **Collaboration Testing**: Open multiple browser windows
4. **Performance Monitoring**: Use React DevTools Profiler

## 🧪 Testing Strategy

### Unit Tests
- **Component behavior** with React Testing Library
- **Hook logic** with custom test utilities
- **Utility functions** with Jest

### Integration Tests
- **Editor functionality** end-to-end
- **Collaboration features** multi-user scenarios
- **Responsive behavior** across breakpoints

### Performance Tests
- **Bundle size** monitoring
- **Runtime performance** profiling
- **Memory usage** tracking

## 🔍 Debugging

### Development Tools
- **React DevTools** for component inspection
- **Redux DevTools** for state debugging (if used)
- **Yjs DevTools** for collaboration debugging
- **Responsive Design Mode** for multi-device testing

### Common Issues
- **WebSocket connection problems**: Check network tab and server logs
- **Collaboration conflicts**: Monitor Yjs document state
- **Responsive layout issues**: Verify CSS custom properties
- **Performance problems**: Use React Profiler

## 📚 API Reference

### Main Components
- `Editor` - Main editor component
- `PageCanvas` - DIN A4 page container
- `FloatingToolbar` - Context-aware toolbar
- `CollaborativeEditor` - TipTap integration

### Hooks
- `useEditorCore` - Core editor functionality
- `useCollaboration` - Real-time collaboration
- `useResponsiveDesign` - Responsive behavior
- `useKeyboardShortcuts` - Keyboard handling

### Utilities
- `formatContent` - Content transformation
- `deviceDetection` - Device and browser detection
- `performanceUtils` - Performance optimization helpers

## 🔧 Configuration

### Responsive Breakpoints
```typescript
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;
```

### Editor Settings
```typescript
export const EDITOR_CONFIG = {
  dinA4: {
    width: '21cm',
    height: '29.7cm',
    ratio: 1.414,
  },
  typography: {
    baseFontSize: 16,
    lineHeight: 1.5,
    scale: 1.25,
  },
  collaboration: {
    autoSaveInterval: 3000,
    maxRetries: 3,
    reconnectDelay: 1000,
  },
} as const;
```

## 🚀 Deployment

### Production Build
```bash
npm run build
docker build -t pessoa-frontend .
```

### Environment Variables
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_WS_BASE_URL` - WebSocket server URL
- `VITE_APP_VERSION` - Application version
- `VITE_ENVIRONMENT` - Development environment

## 📈 Performance Considerations

### Bundle Optimization
- **Tree shaking** for unused code elimination
- **Code splitting** for route-based loading
- **Dynamic imports** for feature-based loading
- **Asset optimization** for faster loading

### Runtime Performance
- **Virtual scrolling** for large documents
- **Memoization** for expensive computations
- **Debouncing** for frequent updates
- **Web Workers** for heavy processing

## 🤝 Contributing

### Code Style
- **TypeScript strict mode** enabled
- **ESLint + Prettier** for consistent formatting
- **Conventional commits** for clear history
- **Component-driven development** approach

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation if needed
4. Submit PR with clear description
5. Address review feedback
6. Merge after approval

## 📄 License

MIT License - see LICENSE file for details. 