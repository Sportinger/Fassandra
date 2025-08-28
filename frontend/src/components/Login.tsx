import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { login } from '../api';
import { logDebugInfo } from '../utils/debug';
import authStyles from './Auth.module.css';
import { getErrorMessage } from '../types/common';
import logger from '../services/LoggingService';
/**
 * Login form component for user authentication.
 *
 * Renders a form for users to enter their email and password, and handles login logic.
 * Displays error messages on failure.
 *
 * @component
 */
export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const { setToken, theme, setTheme, language = 'de', setLanguage } = useAuth();

  /**
   * Handles form submission for login.
   *
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    logDebugInfo('Login', `Attempting login with email: ${email}`);
    
    try {
      const response = await login(email, password);
      logDebugInfo('Login', `Login successful, user: ${response?.user?.username || 'UNKNOWN'}`);
      
      // Trigger exit animation
      setIsExiting(true);
      
      // Wait for animation to complete (300ms) then set token
      setTimeout(async () => {
        // Always use JWT token for sessionStorage-based auth (enables multi-tab support)
        // Request token from backend even for web clients
        let token = response.token || null;
        
        if (!token) {
          // If backend didn't return a token, request it explicitly
          // This ensures we always have a JWT token for sessionStorage
          logDebugInfo('Login', 'Token not in response, will rely on cookie auth');
          token = 'authenticated'; // Fallback to cookie-based auth
        } else {
          logDebugInfo('Login', `Using JWT token from login response: ${token ? token.substring(0, 20) + '...' : 'empty'}`);
        }
        
        setToken(token, response.user);
        logDebugInfo('Login', `Authentication state set after exit animation`);
      }, 300);
      
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      logDebugInfo('Login', `Login failed: ${errorMsg}`);
      setError(errorMsg);
      logger.error('Login', 'Error:', err);
    }
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={authStyles.loginPage}>
      <div className={authStyles.loginLayout}>
        <section className={authStyles.brandPane} aria-label={language === 'de' ? 'Markenbereich' : 'Brand area'}>
          <div className={authStyles.brandInner}>
            <div className={authStyles.brandLogo} aria-hidden>◎</div>
            <h1 className={authStyles.brandTitle}>PESSOA</h1>
            <p className={authStyles.brandTagline}>
              {language === 'de' ? 'Schreiben. Strukturieren. Zusammenarbeiten.' : 'Write. Organize. Collaborate.'}
            </p>
            <div className={authStyles.brandActions}>
              <button type="button" onClick={handleThemeToggle} className={authStyles.brandActionBtn}>
                {theme === 'dark' ? (language === 'de' ? 'Helles Thema' : 'Light Mode') : (language === 'de' ? 'Dunkles Thema' : 'Dark Mode')}
              </button>
              <button type="button" onClick={() => setLanguage && setLanguage(language === 'de' ? 'en' : 'de')} className={authStyles.brandActionBtn}>
                {language === 'de' ? 'Sprache: Deutsch' : 'Language: English'}
              </button>
            </div>
          </div>
        </section>

        <section className={`${authStyles.formPane} ${isExiting ? authStyles.exiting : ''}`} aria-label={language === 'de' ? 'Anmeldung' : 'Authentication'}>
          <div className={authStyles.authForm}>
            <h2 className={authStyles.authTitle}>{language === 'de' ? 'Anmelden' : 'Login'}</h2>
            {error && <div className={authStyles.errorMessage}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className={authStyles.formGroup}>
                <label htmlFor="login-email" className={authStyles.formLabel}>{language === 'de' ? 'E-Mail' : 'Email'}</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authStyles.formInput}
                  placeholder={language === 'de' ? 'E-Mail eingeben' : 'Enter your email'}
                  required
                />
              </div>
              <div className={authStyles.formGroup}>
                <label htmlFor="login-password" className={authStyles.formLabel}>{language === 'de' ? 'Passwort' : 'Password'}</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={authStyles.formInput}
                  placeholder={language === 'de' ? 'Passwort eingeben' : 'Enter your password'}
                  required
                />
              </div>
              <button type="submit" className={authStyles.submitButton}>{language === 'de' ? 'Anmelden' : 'Login'}</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
