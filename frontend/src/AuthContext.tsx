// frontend/src/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { AuthState, User } from './types';
import { logDebugInfo } from './utils/debug';
import { setApiToken } from './api';

// Create the context with a default value for AuthState
const defaultAuthState: AuthState = {
  token: null,
  user: null,
  setToken: () => {},
  theme: 'dark',
  setTheme: () => {},
};

/**
 * React context for authentication state management.
 * Provides authentication token, user data, and functions to update auth state.
 */
const AuthContext = createContext<AuthState>(defaultAuthState);

// Define the props for the provider
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Parses a JWT token to extract user information.
 * 
 * WARNING: This is for demonstration purposes. In production, 
 * JWTs should not be decoded on the client side for authentication purposes.
 * 
 * @param {string} token - JWT token string
 * @returns {User|null} - Parsed user data or null if parsing failed
 */
function parseUserFromToken(token: string): User | null {
  try {
    // WARNING: THIS IS INSECURE - DO NOT DECODE JWTs CLIENT-SIDE FOR REAL APPS
    // This is a placeholder. User data should ideally come from a secure API endpoint
    // after login, not by decoding the JWT payload directly in the browser.
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
        console.error("JWT token missing payload section.");
        return null;
    }

    // Correct Base64 URL decoding
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const payload = JSON.parse(decodedPayload);

    console.log("[AuthContext] Decoded JWT Payload:", payload); // Log the decoded payload

    // Check for required fields from the JWT (using 'sub')
    if (!payload || typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.username !== 'string' || typeof payload.role !== 'string') {
        console.error("JWT payload missing expected fields (sub, email, username, role) or has wrong types.", payload);
        return null;
    }

    // Map JWT claims to User interface fields
    return {
        id: payload.sub, // Map 'sub' claim to 'id'
        email: payload.email,
        username: payload.username,
        role: payload.role,
        created_at: '', // Provide empty string as 'created_at' is not in JWT
    };
  } catch (error) {
    console.error('Failed to parse token:', error);
    return null;
  }
}

/**
 * Authentication context provider component.
 * 
 * Manages authentication state including token and user information.
 * Persists authentication state in sessionStorage.
 * 
 * @param {AuthProviderProps} props - Component props
 * @returns {React.ReactElement} Provider component with authentication context
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use sessionStorage instead of localStorage with better mobile support
  const [token, setTokenState] = useState<string | null>(() => {
    // Try both sessionStorage and localStorage for mobile compatibility
    const storedToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    logDebugInfo('Auth', `Initial token from storage: ${storedToken ? 'YES' : 'NO'}`);
    
    // If found in localStorage but not sessionStorage, migrate it
    if (!sessionStorage.getItem('authToken') && localStorage.getItem('authToken')) {
      sessionStorage.setItem('authToken', localStorage.getItem('authToken')!);
      localStorage.removeItem('authToken'); // Clean up old storage
      logDebugInfo('Auth', 'Migrated token from localStorage to sessionStorage');
    }
    
    return storedToken;
  });
  
  const [user, setUserState] = useState<User | null>(() => {
    // Initialize user from token in sessionStorage
    const storedToken = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const user = storedToken ? parseUserFromToken(storedToken) : null;
    logDebugInfo('Auth', `Initial user parsed: ${user ? user.username : 'NO USER'}`);
    return user;
  });
  
  // Add theme state with localStorage persistence
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return storedTheme || 'dark';
  });

  // Use useCallback for setToken to ensure stable reference
  const setToken = useCallback((newToken: string | null, newUser?: User | null) => {
    const userToSet = newUser !== undefined ? newUser : (newToken ? parseUserFromToken(newToken) : null);
    console.log("AuthProvider setToken called:", { newToken, newUser, userToSet });
    logDebugInfo('Auth', `setToken called - token: ${newToken ? 'YES' : 'NO'}, user: ${userToSet ? userToSet.username : 'NO USER'}`);

    setTokenState(newToken);
    setUserState(userToSet);
    
    // Update API service with new token
    setApiToken(newToken);

    if (newToken) {
      try {
        // Save to both storages for mobile compatibility
        sessionStorage.setItem('authToken', newToken);
        localStorage.setItem('authToken', newToken); // Backup for mobile
        logDebugInfo('Auth', 'Token saved to both sessionStorage and localStorage');
      } catch (error) {
        logDebugInfo('Auth', `Storage error: ${error}`);
        // Fallback: try localStorage only
        try {
          localStorage.setItem('authToken', newToken);
          logDebugInfo('Auth', 'Token saved to localStorage as fallback');
        } catch (fallbackError) {
          logDebugInfo('Auth', `Storage completely failed: ${fallbackError}`);
        }
      }
    } else {
      try {
        // Remove from both storages
        sessionStorage.removeItem('authToken');
        localStorage.removeItem('authToken');
        logDebugInfo('Auth', 'Token removed from both storages');
      } catch (error) {
        logDebugInfo('Auth', `Storage removal error: ${error}`);
      }
    }
  }, []); 

  // Add theme setter with localStorage persistence
  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Set initial token in ApiService when component mounts
  useEffect(() => {
    if (token) {
      setApiToken(token);
      logDebugInfo('Auth', 'Initial token set in ApiService on mount');
    }
  }, []); // Only run once on mount

  // Provide token, user, and setToken function
  const authValue = React.useMemo(() => ({ token, user, setToken, theme, setTheme }), [token, user, setToken, theme, setTheme]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access authentication context.
 * 
 * Provides access to the current authentication state and functions to update it.
 * Must be used within an AuthProvider component.
 * 
 * @returns {AuthState} Authentication state including token, user, and setToken function
 * @throws {Error} If used outside of an AuthProvider
 */
export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 