import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { AuthState, User } from './types';
import { logDebugInfo } from './utils/debug';
import { setApiToken, getCurrentUser } from './api';
import UploadStateManager from './services/UploadStateManager';

import logger from './services/LoggingService';
// frontend/src/AuthContext.tsx
// Create the context with a default value for AuthState
const defaultAuthState: AuthState = {
  token: null,
  user: null,
  setToken: () => {},
  theme: 'dark',
  setTheme: () => {},
  tokenReady: false,
  language: 'de',
  setLanguage: () => {},
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
 * Fetches user information from the backend API.
 * 
 * This is secure - user data comes from a secure API endpoint
 * after authentication, not from decoding the JWT directly.
 * 
 * @returns {Promise<User|null>} - User data from API or null if fetch failed
 */
async function fetchUserFromAPI(): Promise<User | null> {
  try {
    const userData = await getCurrentUser();
    logDebugInfo('Auth', `User fetched from API: ${userData.username}`);
    return userData;
  } catch (error) {
    logger.error('AuthContext', 'Failed to fetch user from API:', error);
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
  // Initialize token state from sessionStorage for multi-tab support
  const [token, setTokenState] = useState<string | null>(() => {
    // Check if we have a JWT token in sessionStorage
    // This enables different users in different tabs
    const storedToken = sessionStorage.getItem('jwt_token');
    logDebugInfo('Auth', `Initial auth state: ${storedToken ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`);
    
    return storedToken;
  });
  
  const [user, setUserState] = useState<User | null>(null);
  
  // Add theme state with localStorage persistence
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    return storedTheme || 'dark';
  });

  // Language state with localStorage persistence (default German)
  const [language, setLanguageState] = useState<'de' | 'en'>(() => {
    const stored = localStorage.getItem('lang') as 'de' | 'en' | null;
    return stored || 'de';
  });

  // Track when token is ready in ApiService
  // Initialize as true if we have a token from storage
  const [tokenReady, setTokenReady] = useState(!!token);

  // Use useCallback for setToken to ensure stable reference
  const setToken = useCallback(async (newToken: string | null, newUser?: User | null) => {
    logger.debug('AuthContext', "AuthProvider setToken called:", { newToken, newUser });
    logDebugInfo('Auth', `setToken called - token: ${newToken ? 'YES' : 'NO'}`);

    setTokenState(newToken);
    
    // If we have a new token but no user provided, fetch user from API
    if (newToken && !newUser) {
      // Set token in API service first so the API call will be authenticated
      setApiToken(newToken);
      const fetchedUser = await fetchUserFromAPI();
      setUserState(fetchedUser);
      logDebugInfo('Auth', `User fetched: ${fetchedUser ? fetchedUser.username : 'NO USER'}`);
    } else {
      setUserState(newUser || null);
    }
    
    // Update API service (tokens are now in httpOnly cookies)
    // The API service will use cookies automatically
    setApiToken(newToken);

    if (newToken) {
      // Store the actual JWT token in sessionStorage for multi-tab support
      // Only store real JWT tokens, not placeholder values
      if (newToken !== 'authenticated') {
        sessionStorage.setItem('jwt_token', newToken);
        logDebugInfo('Auth', 'JWT token stored in sessionStorage');
      } else {
        // Fallback: just store authentication flag for cookie-based auth
        sessionStorage.setItem('isAuthenticated', 'true');
        logDebugInfo('Auth', 'Authentication flag set (cookie-based)');
      }
    } else {
      // Clear authentication data
      sessionStorage.removeItem('jwt_token');
      sessionStorage.removeItem('isAuthenticated');
      logDebugInfo('Auth', 'Authentication data removed from sessionStorage');
      // Do NOT clear upload state on logout; keep showing active uploads
      // so users can monitor ongoing parsing while logged out.
    }
  }, []); 

  // Add theme setter with localStorage persistence
  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    // Apply theme to document root
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  // Language setter
  const setLanguage = useCallback((lang: 'de' | 'en') => {
    setLanguageState(lang);
    localStorage.setItem('lang', lang);
    try { document.documentElement.setAttribute('lang', lang); } catch {}
  }, []);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Apply language attribute on mount/change
  useEffect(() => {
    try { document.documentElement.setAttribute('lang', language); } catch {}
  }, [language]);

  // Set token in ApiService whenever token changes and fetch user if needed
  useEffect(() => {
    setApiToken(token);
    setTokenReady(true);
    logDebugInfo('Auth', `Token set in ApiService: ${token ? 'YES' : 'NO'}, ready: true`);
    
    // Fetch user data if we have a token but no user (e.g., on page refresh)
    if (token && !user) {
      fetchUserFromAPI().then(fetchedUser => {
        if (fetchedUser) {
          setUserState(fetchedUser);
          logDebugInfo('Auth', `User fetched on mount: ${fetchedUser.username}`);
        }
      });
    }
  }, [token]); // Run whenever token changes

  // Provide token, user, and setToken function
  const authValue = React.useMemo(() => ({ token, user, setToken, theme, setTheme, tokenReady, language, setLanguage }), [token, user, setToken, theme, setTheme, tokenReady, language, setLanguage]);

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
