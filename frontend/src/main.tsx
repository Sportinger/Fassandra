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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
