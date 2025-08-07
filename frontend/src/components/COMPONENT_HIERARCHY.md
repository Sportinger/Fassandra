# Component Hierarchy & Architecture

## Design Principles
1. **Composition over Inheritance**: Use component composition instead of class inheritance
2. **Single Responsibility**: Each component has one clear purpose
3. **Prop Validation**: All props have TypeScript interfaces
4. **Reusability**: Components in /shared are project-agnostic
5. **No Circular Dependencies**: Strict dependency flow

## Component Hierarchy

```
src/components/
├── shared/                    # Reusable, project-agnostic components
│   ├── index.ts               # Centralized exports
│   ├── Button.tsx             # Base button component
│   ├── Card.tsx               # Card with composition pattern
│   └── *.module.css           # Component-specific styles
│
├── optimized/                 # Performance-optimized wrappers
│   ├── OptimizedScriptList.tsx
│   └── OptimizedHeader.tsx
│
├── editor/                    # Editor-specific components
│   ├── components/
│   ├── extensions/
│   ├── hooks/
│   └── ViewModes/
│
├── ErrorBoundary.tsx          # Global error handling
├── RouteErrorBoundary.tsx     # Route-level errors
├── ErrorFallbacks.tsx         # Error UI components
├── LoadingStates.tsx          # Loading indicators
│
├── Header.tsx                 # App header
├── Login.tsx                  # Auth - login
├── Register.tsx               # Auth - register
├── ScriptList.tsx             # Script listing
└── ScriptUploader.tsx         # File upload
```

## Component Categories

### 1. Shared Components (/shared)
**Purpose**: Reusable across entire application
**Rules**: 
- No business logic
- No direct API calls
- Props-driven behavior
- Self-contained styles

**Examples**:
- Button, Card, Modal, Input, Select
- Spinner, Skeleton, Alert, Toast

### 2. Feature Components
**Purpose**: Business-specific functionality
**Rules**:
- Can use shared components
- Can make API calls
- Contains business logic
- Feature-specific state

**Examples**:
- ScriptList, ScriptUploader
- Login, Register
- Editor components

### 3. Layout Components
**Purpose**: Page structure and layout
**Rules**:
- Define page structure
- Handle responsive design
- Manage layout state

**Examples**:
- Header, Footer, Sidebar
- PageContainer, ContentWrapper

### 4. Optimized Components (/optimized)
**Purpose**: Performance-optimized wrappers
**Rules**:
- Wrap expensive components with React.memo
- Custom comparison functions
- No additional logic

## Composition Patterns

### Card Example
```typescript
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content here</Card.Body>
  <Card.Footer>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Save</Button>
  </Card.Footer>
</Card>
```

### Button Variants
```typescript
<Button variant="primary" size="large" icon={<Icon />}>
  Click Me
</Button>

<Button loading disabled>
  Processing...
</Button>
```

## Prop Validation Strategy

### Required vs Optional
- Required: Core functionality props
- Optional: Enhancement/customization props

### TypeScript Interfaces
```typescript
interface ComponentProps {
  // Required
  children: ReactNode;
  onAction: (value: string) => void;
  
  // Optional with defaults
  variant?: 'primary' | 'secondary';  // = 'primary'
  size?: 'small' | 'medium' | 'large'; // = 'medium'
}
```

## Import Strategy

### From Shared Library
```typescript
import { Button, Card, Spinner } from '@/components/shared';
```

### Feature Components
```typescript
import ScriptList from '@/components/ScriptList';
```

### Lazy Loading
```typescript
const Editor = lazy(() => import('@/components/editor'));
```

## State Management Flow

```
App.tsx (Routes & Global State)
    ├── Context Providers (Auth, Theme)
    ├── Singleton Stores (UI, Routing)
    └── Feature Components
        ├── Local State (useState)
        ├── Shared Components (props only)
        └── API Calls (services)
```

## Testing Strategy

### Shared Components
- Unit tests with all prop combinations
- Visual regression tests
- Accessibility tests

### Feature Components
- Integration tests
- Mock API responses
- User interaction tests

## Performance Guidelines

1. **Memoization**: Use React.memo for expensive lists
2. **Code Splitting**: Lazy load route components
3. **Bundle Size**: Shared components < 5KB each
4. **Re-renders**: Monitor with React DevTools

## Future Improvements

1. **Storybook**: Document all shared components
2. **Design Tokens**: CSS variables for theming
3. **Accessibility**: ARIA labels and keyboard navigation
4. **i18n**: Internationalization support
5. **Animation**: Framer Motion integration