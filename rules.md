# Pessoa Development Rules & Guidelines

> **Quick Start for New Developers**: This document provides essential rules and patterns for contributing to the Pessoa collaborative scriptwriting platform.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Rust 1.70+ (for local backend development)
- Git with SSH access

### Quick Setup
```bash
# Clone and start development environment
git clone <repository>
cd pessoa-1

# Start with hot reload (recommended for development)
./deploy_local.sh --hot-reload

# Access the application
# Frontend: http://192.168.2.111:8444 (instant changes)
# Backend API: http://192.168.2.111:3001/api
# Database: postgresql://localhost:5432/pessoa_db
```

## 📋 Development Rules

### 1. **Always Use Hot Reload During Development**
```bash
# ✅ Correct - instant feedback
./deploy_local.sh --hot-reload

# ❌ Avoid - slower feedback loop
./deploy_local.sh
```

### 2. **Follow the Modular Architecture**
```
# ✅ Correct structure
frontend/src/components/editor/
├── components/     # React components
├── hooks/         # Custom hooks
├── styles/        # CSS modules
├── types/         # TypeScript definitions
└── utils/         # Utility functions

# ❌ Avoid monolithic files
frontend/src/components/editor/
└── Editor.tsx     # 2000+ lines (refactored!)
```

### 3. **Backend: Always Use Async/Await with Timeouts**
```rust
// ✅ Correct - with timeout and proper error handling
pub async fn create_script(pool: &PgPool, title: &str) -> Result<Script> {
    timeout(Duration::from_secs(5), async {
        sqlx::query_as!(Script, "INSERT INTO scripts...")
            .fetch_one(pool)
            .await
    })
    .await
    .map_err(|_| AppError::Internal(Error::msg("Timeout")))??
}

// ❌ Avoid - no timeout, poor error handling
pub async fn create_script(pool: &PgPool, title: &str) -> Script {
    sqlx::query_as!(Script, "INSERT INTO scripts...")
        .fetch_one(pool)
        .await
        .unwrap()
}
```

### 4. **Frontend: Use Custom Hooks for Complex Logic**
```tsx
// ✅ Correct - separated concerns
const useEditorCore = ({ scriptId, user }: EditorCoreProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  
  // Complex logic here
  return { editor, connectionStatus };
};

const Editor: React.FC<EditorProps> = ({ scriptId }) => {
  const { editor, connectionStatus } = useEditorCore({ scriptId, user });
  return <div>{/* Simple JSX */}</div>;
};

// ❌ Avoid - everything in component
const Editor: React.FC<EditorProps> = ({ scriptId }) => {
  // 200+ lines of complex logic mixed with JSX
};
```

### 5. **Mobile-First Responsive Design**
```css
/* ✅ Correct - mobile-first with CSS custom properties */
:root {
  --page-width: clamp(300px, 85vw, 21cm);
  --font-size: clamp(15px, 2.2vw, 16px);
}

.editor {
  width: var(--page-width);
  font-size: var(--font-size);
}

@media (min-width: 768px) {
  .editor { /* Desktop enhancements */ }
}

/* ❌ Avoid - desktop-first with fixed values */
.editor {
  width: 800px;
  font-size: 16px;
}

@media (max-width: 768px) {
  .editor { width: 100%; font-size: 14px; }
}
```

### 6. **TypeScript: Comprehensive Type Coverage**
```tsx
// ✅ Correct - proper interfaces
interface EditorProps {
  scriptId: string;
  initialTitle?: string;
  onNavigateBack: () => void;
}

interface ConnectionStatus {
  status: 'connecting' | 'connected' | 'disconnected';
  lastSeen?: Date;
  retryCount: number;
}

// ❌ Avoid - any types or missing interfaces
const Editor = (props: any) => { /* ... */ };
```

## 🎨 Code Style Guidelines

### Rust Conventions
```rust
// File naming: snake_case
// Functions: snake_case
// Structs: PascalCase
// Constants: SCREAMING_SNAKE_CASE

// ✅ Good error handling
#[derive(Debug)]
pub enum AppError {
    Db(SqlxError),
    Unauthorized(String),
    Internal(AnyhowError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg).into_response(),
            AppError::Db(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
            AppError::Internal(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
        }
    }
}
```

### React/TypeScript Conventions
```tsx
// File naming: PascalCase.tsx for components, camelCase.ts for utilities
// Components: PascalCase
// Hooks: useCamelCase
// Constants: SCREAMING_SNAKE_CASE

// ✅ Good component structure
interface ComponentProps {
  required: string;
  optional?: number;
  callback: (value: string) => void;
}

export const Component: React.FC<ComponentProps> = ({ 
  required, 
  optional = 0, 
  callback 
}) => {
  // Hooks first
  const [state, setState] = useState<string>('');
  const { data, loading } = useCustomHook();
  
  // Event handlers
  const handleClick = useCallback((event: MouseEvent) => {
    callback(event.target.value);
  }, [callback]);
  
  // Effects last
  useEffect(() => {
    // Effect logic
  }, [dependency]);
  
  return (
    <div className={styles.container}>
      {/* JSX */}
    </div>
  );
};
```

### CSS Conventions
```css
/* Use CSS Modules with descriptive class names */
.editorContainer {
  /* Container styles */
}

.editorContainer__toolbar {
  /* BEM-style naming for sub-elements */
}

.editorContainer--mobile {
  /* BEM-style naming for modifiers */
}

/* Use CSS custom properties for theming */
:root {
  --color-primary: #2563eb;
  --color-text: #1f2937;
  --spacing-unit: 0.5rem;
}
```

## 🔧 Common Development Patterns

### 1. **Database Operations (Backend)**
```rust
// ✅ Pattern for database operations
pub async fn get_script_with_blocks(
    pool: &PgPool, 
    script_id: Uuid
) -> Result<(Script, Vec<Block>)> {
    // Use transactions for related operations
    let mut tx = pool.begin().await?;
    
    let script = sqlx::query_as!(
        Script,
        "SELECT * FROM scripts WHERE id = $1",
        script_id
    )
    .fetch_one(&mut *tx)
    .await?;
    
    let blocks = sqlx::query_as!(
        Block,
        "SELECT * FROM blocks WHERE script_id = $1 ORDER BY block_order",
        script_id
    )
    .fetch_all(&mut *tx)
    .await?;
    
    tx.commit().await?;
    Ok((script, blocks))
}
```

### 2. **API Client Calls (Frontend)**
```tsx
// ✅ Pattern for API calls with error handling
const useScriptData = (scriptId: string) => {
  const [data, setData] = useState<ScriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchScript = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getScript(scriptId);
        setData(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchScript();
  }, [scriptId]);
  
  return { data, loading, error };
};
```

### 3. **WebSocket Connection (Frontend)**
```tsx
// ✅ Pattern for WebSocket with reconnection
const useWebSocketConnection = (scriptId: string) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  
  const connect = useCallback(() => {
    const ws = new WebSocket(`wss://localhost:3001/api/collab/${scriptId}`);
    
    ws.onopen = () => setConnectionStatus('connected');
    ws.onclose = () => {
      setConnectionStatus('disconnected');
      // Reconnect after delay
      setTimeout(connect, 5000);
    };
    ws.onerror = () => setConnectionStatus('error');
    
    wsRef.current = ws;
  }, [scriptId]);
  
  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
  
  return { connectionStatus, ws: wsRef.current };
};
```

## 🚨 Common Pitfalls to Avoid

### 1. **Blocking the Event Loop (Backend)**
```rust
// ❌ Avoid - blocking operations
pub async fn bad_function() {
    std::thread::sleep(Duration::from_secs(5)); // Blocks entire event loop!
}

// ✅ Correct - async operations
pub async fn good_function() {
    tokio::time::sleep(Duration::from_secs(5)).await; // Non-blocking
}
```

### 2. **Memory Leaks (Frontend)**
```tsx
// ❌ Avoid - missing cleanup
useEffect(() => {
  const interval = setInterval(() => {
    // Some periodic task
  }, 1000);
  // Missing cleanup!
}, []);

// ✅ Correct - proper cleanup
useEffect(() => {
  const interval = setInterval(() => {
    // Some periodic task
  }, 1000);
  
  return () => clearInterval(interval);
}, []);
```

### 3. **Poor Mobile Experience**
```css
/* ❌ Avoid - fixed sizes that break on mobile */
.button {
  width: 120px;
  height: 32px;
  font-size: 14px;
}

/* ✅ Correct - responsive with minimum touch targets */
.button {
  min-width: 44px;
  min-height: 44px;
  padding: clamp(0.5rem, 2vw, 1rem);
  font-size: clamp(14px, 2.2vw, 16px);
}
```

## 🔄 Development Workflow

### 1. **Starting Development**
```bash
# Always start with hot reload
./deploy_local.sh --hot-reload

# Check all services are running
docker-compose ps

# View logs if needed
docker-compose logs -f frontend
docker-compose logs -f backend
```

### 2. **Making Changes**
```bash
# Frontend changes: Save file → automatic browser refresh
# Backend changes: Save file → automatic cargo rebuild

# For database changes, reset if needed
./deploy_local.sh db --reset-db
```

### 3. **Testing Changes**
```bash
# Run tests locally
cargo test                    # Backend tests
npm test                      # Frontend tests

# Test specific components
./deploy_local.sh frontend --no-cache
./deploy_local.sh backend --no-cache
```

### 4. **Production Deployment**
```bash
# Deploy to production (only from main branch)
./deploy_hetzner.sh

# Check production status
curl -f https://pessoa.theater/api/health
```

## 📊 Performance Guidelines

### 1. **Database Queries**
- Always use SQLx compile-time checks
- Use indices for frequently queried columns
- Implement pagination for large result sets
- Use transactions for related operations

### 2. **Frontend Performance**
- Lazy load components with `React.lazy()`
- Memoize expensive calculations with `useMemo()`
- Debounce user input for API calls
- Use CSS transforms for animations

### 3. **Bundle Optimization**
- Keep bundle size under 500KB gzipped
- Use dynamic imports for large libraries
- Optimize images and assets
- Enable tree-shaking

## 🔐 Security Guidelines

### 1. **Authentication**
- Always validate JWT tokens on backend
- Use secure HTTP-only cookies when possible
- Implement rate limiting for auth endpoints
- Hash passwords with Argon2

### 2. **Input Validation**
- Validate all user input on backend
- Sanitize HTML content in editor
- Use parameterized queries (SQLx handles this)
- Implement CORS properly

### 3. **Environment Variables**
- Never commit secrets to repository
- Use different secrets for development/production
- Rotate JWT secrets regularly
- Keep API keys secure

## 🎯 Final Reminders

1. **Mobile First**: Always test on mobile devices
2. **Performance**: Keep the app fast and responsive
3. **Accessibility**: Ensure keyboard navigation works
4. **Error Handling**: Graceful degradation for all failures
5. **Documentation**: Update docs when adding features
6. **Testing**: Write tests for critical functionality

Remember: Pessoa is a production application with real users. Quality and reliability are paramount! 