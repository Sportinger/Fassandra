# 🎨 Frontend Architecture

Detailed technical documentation for Pessoa's React-based frontend architecture.

## 🎯 Overview

Pessoa's frontend is a modern React application built with TypeScript, featuring real-time collaborative editing through TipTap and YJS integration. The architecture emphasizes mobile-first design, modular components, and professional scriptwriting standards.

## 🏗️ Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18+ | Core UI framework |
| **TypeScript** | 5+ | Type safety and developer experience |
| **TipTap** | 2+ | Rich text editor built on ProseMirror |
| **YJS** | 13+ | Conflict-free collaborative editing |
| **Vite** | 4+ | Build tool and development server |
| **Axios** | 1+ | HTTP client for API communication |

## 📁 Project Structure

```
frontend/src/
├── components/
│   ├── editor/                    # 🎭 Collaborative Editor System
│   │   ├── components/
│   │   │   ├── Editor.tsx         # Main editor orchestrator
│   │   │   ├── page/
│   │   │   │   └── PageCanvas.tsx # DIN A4 page container
│   │   │   ├── toolbar/
│   │   │   │   └── Toolbar.tsx    # Context-aware floating toolbar
│   │   │   └── ui/
│   │   │       ├── ErrorDisplay.tsx
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── StatusIndicator.tsx
│   │   ├── hooks/
│   │   │   ├── useEditorCore.ts       # TipTap + YJS integration
│   │   │   ├── useEditorInstance.ts   # Editor lifecycle management
│   │   │   ├── useEditorState.ts      # State management
│   │   │   ├── useLayoutManagement.ts # Layout and formatting
│   │   │   ├── useResponsiveDesign.ts # Mobile-first responsive design
│   │   │   └── useYjsConnection.ts    # Real-time WebSocket connection
│   │   ├── extensions/
│   │   │   ├── DialogueBlock.ts       # Custom dialogue block extension
│   │   │   ├── DialogueText.ts        # Dialogue text formatting
│   │   │   ├── Speaker.ts             # Speaker name extension
│   │   │   └── index.ts               # Extension exports
│   │   ├── styles/
│   │   │   ├── variables.css          # CSS custom properties
│   │   │   ├── responsive.css         # Mobile-first responsive rules
│   │   │   └── toolbar.css            # Toolbar animations and positioning
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript type definitions
│   │   ├── utils/
│   │   │   ├── contentConverters.ts   # Content format conversion
│   │   │   └── formatters.ts          # Text formatting utilities
│   │   ├── ViewModes/
│   │   │   ├── MultiPageView.tsx      # Multiple page view
│   │   │   ├── SinglePageView.tsx     # Single page view
│   │   │   └── index.ts
│   │   ├── FontSizeDropdown.tsx       # Font size selection
│   │   ├── SpeakerDropdown.tsx        # Speaker management
│   │   └── Ruler.tsx                  # Page measurement ruler
│   ├── Auth/                      # 🔐 Authentication Components
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── Header.tsx                 # 📋 Application header with navigation
│   ├── Breadcrumb.tsx             # 🗺️ Navigation breadcrumbs
│   ├── ScriptList.tsx             # 📋 Script management and grid
│   └── ScriptUploader.tsx         # ⬆️ File upload with progress tracking
├── api.ts                         # 🔗 Backend API communication
├── AuthContext.tsx                # 🔐 Global authentication state
├── types.ts                       # 📝 Global TypeScript definitions
├── utils/
│   ├── console-forwarder.ts       # 📱 Mobile debugging utilities
│   ├── debug.ts                   # 🐛 Debug logging
│   ├── mobile-debug.ts            # 📱 Mobile-specific debugging
│   └── mobile.ts                  # 📱 Mobile detection and utilities
├── App.tsx                        # 🏠 Main application component
├── main.tsx                       # 🚀 Application entry point
└── index.css                      # 🎨 Global styles
```

## 🎭 Editor Architecture

### 🔧 Core Components

#### Editor.tsx - Main Orchestrator
The central component that coordinates all editor subsystems:

```typescript
export const Editor: React.FC<EditorProps> = ({ 
  scriptId, 
  initialTitle, 
  onNavigateBack 
}) => {
  // Authentication and responsive design
  const { token, user } = useAuth();
  const { config, isMobile } = useResponsiveDesign();
  
  // Editor core with YJS integration
  const {
    editor,
    ydoc,
    provider,
    connectionStatus,
    errorMessage,
    availableSpeakers,
    contextMenu,
    toolbarContext,
    activeUserCount,
  } = useEditorCore({
    scriptId,
    user,
    hasToken: !!token,
  });
  
  // Local UI state
  const [viewMode, setViewMode] = useState<ViewMode>('single-page');
  const [showRuler, setShowRuler] = useState(false);
  
  return (
    <div className="editorContainer">
      <Header currentView="editor" scriptTitle={initialTitle} />
      {/* Responsive editor content */}
      <PageCanvas editor={editor} viewMode={viewMode} />
      <Toolbar context={toolbarContext} editor={editor} />
    </div>
  );
};
```

#### useEditorCore.ts - TipTap + YJS Integration
Manages the integration between TipTap editor and YJS for real-time collaboration:

```typescript
export const useEditorCore = ({ scriptId, user, hasToken }) => {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  
  // Initialize YJS document and WebSocket provider
  useEffect(() => {
    if (!hasToken || !scriptId) return;
    
    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider(
      wsUrl,
      scriptId,
      doc,
      {
        params: { token },
        awareness: new awarenessProtocol.Awareness(doc),
      }
    );
    
    setYdoc(doc);
    setProvider(wsProvider);
    
    return () => {
      wsProvider.destroy();
      doc.destroy();
    };
  }, [scriptId, hasToken]);
  
  // Initialize TipTap editor with YJS collaboration
  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: user?.username || user?.email || 'Anonymous',
          color: generateUserColor(user?.id),
        },
      }),
      // Custom extensions for dialogue and speakers
      DialogueBlock,
      Speaker,
    ],
    content: '<p>Loading...</p>',
  }, [ydoc, provider]);
  
  return {
    editor,
    ydoc,
    provider,
    connectionStatus,
    activeUserCount,
  };
};
```

### 🎨 Context-Aware Toolbar

The toolbar adapts based on the current editing context:

```typescript
interface ToolbarProps {
  context: 'default' | 'text-selection' | 'dialogue-block' | 'speaker-selection' | 'empty-page';
  editor: Editor | null;
  isMobile: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ context, editor, isMobile }) => {
  const getToolbarButtons = () => {
    switch (context) {
      case 'default':
        return <DefaultToolbar />; // View modes, ruler, print
      case 'text-selection':
        return <TextToolbar />; // Bold, italic, alignment
      case 'dialogue-block':
        return <DialogueToolbar />; // Layout switching, exit
      case 'speaker-selection':
        return <SpeakerToolbar />; // Speaker dropdown
      case 'empty-page':
        return <EmptyPageToolbar />; // Insert dialogue, split page
      default:
        return <DefaultToolbar />;
    }
  };
  
  const toolbarClass = `
    toolbar 
    ${isMobile ? 'toolbar--mobile' : 'toolbar--desktop'}
    toolbar--${context}
  `;
  
  return (
    <div className={toolbarClass}>
      {getToolbarButtons()}
    </div>
  );
};
```

## 📱 Mobile-First Responsive Design

### 🎯 Responsive Architecture

Pessoa uses a mobile-first approach with CSS custom properties for fluid scaling:

```css
/* variables.css - Design tokens */
:root {
  /* DIN A4 proportional scaling */
  --page-width: clamp(300px, 85vw, 21cm);
  --page-height: calc(var(--page-width) * 1.414);
  
  /* Fluid typography */
  --font-size-base: clamp(15px, 2.2vw, 16px);
  --font-size-h1: clamp(20px, 3.5vw, 24px);
  --font-size-h2: clamp(18px, 3vw, 20px);
  
  /* Responsive spacing */
  --spacing-xs: clamp(4px, 1vw, 8px);
  --spacing-sm: clamp(8px, 2vw, 12px);
  --spacing-md: clamp(12px, 3vw, 16px);
  --spacing-lg: clamp(16px, 4vw, 24px);
  
  /* Touch targets */
  --touch-target-min: 44px;
  
  /* Toolbar positioning */
  --toolbar-bottom-mobile: env(safe-area-inset-bottom, 16px);
}

/* responsive.css - Mobile-first rules */
.toolbar {
  position: fixed;
  z-index: 1000;
  
  /* Mobile: bottom toolbar */
  bottom: var(--toolbar-bottom-mobile);
  left: var(--spacing-md);
  right: var(--spacing-md);
  
  /* Touch-friendly buttons */
  button {
    min-height: var(--touch-target-min);
    min-width: var(--touch-target-min);
    padding: var(--spacing-sm);
  }
}

/* Desktop: floating toolbar */
@media (min-width: 1024px) {
  .toolbar {
    position: absolute;
    bottom: auto;
    left: calc(var(--page-width) + var(--spacing-lg));
    right: auto;
    top: 50%;
    transform: translateY(-50%);
  }
}
```

### 📱 useResponsiveDesign Hook

Handles device detection and responsive configuration:

```typescript
export const useResponsiveDesign = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const updateResponsiveState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setViewport({ width, height });
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };
    
    updateResponsiveState();
    window.addEventListener('resize', updateResponsiveState);
    
    return () => window.removeEventListener('resize', updateResponsiveState);
  }, []);
  
  const config = {
    // Responsive configuration
    toolbarPosition: isMobile ? 'bottom' : 'floating',
    pageScaling: isMobile ? 'fit-width' : 'natural',
    touchTargets: isMobile,
    
    // Layout configuration
    showRuler: !isMobile,
    sidebarCollapsed: isMobile,
    maxVisiblePages: isMobile ? 1 : 3,
  };
  
  return { isMobile, isTablet, viewport, config };
};
```

## 🔗 API Integration

### 🌐 Backend Communication

```typescript
// api.ts - Backend API client
export class PessoaAPI {
  private baseURL: string;
  private token: string | null = null;
  
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || '';
  }
  
  setToken(token: string | null) {
    this.token = token;
  }
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Scripts API
  async getScripts(): Promise<Script[]> {
    return this.request('/api/scripts');
  }
  
  async createScript(script: CreateScriptRequest): Promise<Script> {
    return this.request('/api/scripts', {
      method: 'POST',
      body: JSON.stringify(script),
    });
  }
  
  async uploadScript(file: File): Promise<ParsedScript> {
    const formData = new FormData();
    formData.append('scriptFile', file);
    
    return this.request('/api/s/upload-parse', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }
  
  // Authentication API
  async login(email: string, password: string): Promise<string> {
    const response = await this.request<{ token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response.token;
  }
  
  async register(email: string, username: string, password: string): Promise<string> {
    const response = await this.request<{ token: string }>('/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
    return response.token;
  }
}

export const api = new PessoaAPI();
```

### 🔄 Real-time WebSocket Integration

```typescript
// useYjsConnection.ts - WebSocket connection management
export const useYjsConnection = (scriptId: string, token: string) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  
  useEffect(() => {
    if (!scriptId || !token) return;
    
    const wsUrl = import.meta.env.VITE_WS_BASE_URL || 
                  window.location.origin.replace(/^http/, 'ws');
    
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    
    const wsProvider = new WebsocketProvider(
      `${wsUrl}/api/collab/${scriptId}`,
      scriptId,
      doc,
      {
        params: { token },
        awareness,
        // Connection management
        maxBackoffTime: 5000,
        disableBc: true, // Disable broadcast channel for cross-tab sync
      }
    );
    
    // Connection event handlers
    wsProvider.on('status', (event: { status: string }) => {
      setConnectionStatus(event.status as ConnectionStatus);
    });
    
    wsProvider.on('connection-close', () => {
      setConnectionStatus('disconnected');
    });
    
    wsProvider.on('connection-error', () => {
      setConnectionStatus('error');
    });
    
    setProvider(wsProvider);
    
    return () => {
      wsProvider.destroy();
      doc.destroy();
    };
  }, [scriptId, token]);
  
  return { provider, connectionStatus };
};
```

## 🎨 Design System

### 🎯 Component Design Principles

1. **Mobile-First**: All components designed for mobile, enhanced for desktop
2. **Accessible**: WCAG 2.1 AA compliance with proper ARIA labels
3. **Performant**: Lazy loading and efficient re-rendering
4. **Consistent**: Shared design tokens and CSS custom properties

### 🎨 CSS Architecture

```css
/* Design tokens approach */
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  
  /* Typography */
  --font-family-sans: 'Inter', system-ui, sans-serif;
  --font-family-mono: 'JetBrains Mono', monospace;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  
  /* Animations */
  --transition-fast: 150ms ease-in-out;
  --transition-normal: 250ms ease-in-out;
  --transition-slow: 350ms ease-in-out;
}

/* Component-specific styling */
.editor-page {
  /* DIN A4 dimensions maintained across devices */
  aspect-ratio: 1 / 1.414;
  max-width: var(--page-width);
  margin: 0 auto;
  
  /* Professional script formatting */
  font-family: 'Courier New', monospace;
  line-height: 1.6;
  padding: var(--spacing-lg);
}

.dialogue-block {
  /* Speaker name styling */
  .speaker-name {
    font-weight: bold;
    color: var(--color-primary);
    text-transform: uppercase;
    margin-bottom: var(--spacing-xs);
  }
  
  /* Dialogue text indentation */
  .dialogue-text {
    margin-left: var(--spacing-md);
    padding-left: var(--spacing-sm);
    border-left: 2px solid var(--color-primary);
  }
}
```

## 🧪 Testing Architecture

### 🔬 Testing Strategy

```typescript
// Component testing with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';
import { Editor } from '../components/editor';

describe('Editor Component', () => {
  it('should initialize with loading state', () => {
    render(
      <AuthProvider>
        <Editor scriptId="test-id" initialTitle="Test Script" />
      </AuthProvider>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
  
  it('should handle toolbar context changes', async () => {
    const { user } = render(
      <AuthProvider>
        <Editor scriptId="test-id" initialTitle="Test Script" />
      </AuthProvider>
    );
    
    // Test toolbar context switching
    const textInput = screen.getByRole('textbox');
    await user.click(textInput);
    await user.type(textInput, 'Test dialogue');
    
    // Should show text formatting toolbar
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });
});

// API testing
describe('API Integration', () => {
  it('should handle authentication flow', async () => {
    const mockToken = 'test-token';
    const api = new PessoaAPI();
    
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: mockToken }),
    });
    
    const token = await api.login('test@example.com', 'password');
    expect(token).toBe(mockToken);
  });
});
```

## 🚀 Performance Optimizations

### ⚡ Loading Performance

1. **Code Splitting**: Dynamic imports for large components
2. **Bundle Analysis**: Webpack bundle analyzer for optimization
3. **Tree Shaking**: Unused code elimination
4. **Asset Optimization**: Image compression and WebP format

### 🔄 Runtime Performance

1. **React.memo**: Prevent unnecessary re-renders
2. **useMemo/useCallback**: Expensive calculation caching
3. **Virtual Scrolling**: For large script lists
4. **Debounced Updates**: Batch YJS updates for performance

### 📱 Mobile Performance

1. **Touch Optimization**: 44px minimum touch targets
2. **Gesture Handling**: Optimized touch event handling
3. **Viewport Management**: Proper viewport meta tags
4. **PWA Features**: Service worker for offline functionality

---

## 🔗 Related Documentation

- **[System Architecture](README.md)** - High-level system overview
- **[Backend Architecture](backend.md)** - Rust backend implementation
- **[Real-time Collaboration](collaboration.md)** - WebSocket and YJS details
- **[API Reference](../api/README.md)** - Complete API documentation 