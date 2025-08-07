/**
 * Application entry point.
 * 
 * Initializes the React application with StrictMode and the AuthProvider context.
 * Renders the root App component into the DOM.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext'

// Removed console forwarder import - development utility

// Temporarily disable StrictMode in development to prevent double mounting issues
// Re-enable for production builds
const rootElement = (
  import.meta.env.DEV ? (
    <AuthProvider>
      <App />
    </AuthProvider>
  ) : (
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  )
);

createRoot(document.getElementById('root')!).render(rootElement)
