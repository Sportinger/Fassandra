import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { login } from '../api';
import { logDebugInfo } from '../utils/debug';
import authStyles from './Auth.module.css';
import { getErrorMessage } from '../types/common';
import logger from '../services/LoggingService';
import { useUIState } from '../hooks/useUIState';
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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { setToken, theme, setTheme, language = 'de', setLanguage } = useAuth();
  const { setShowLogin } = useUIState();

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
        
        // Optionally remember session using localStorage (UI only; token still lives in sessionStorage by design).
        // We keep this flag if we later want to change persistence strategy.
        try {
          if (remember) {
            window.localStorage.setItem('rememberMe', '1');
          } else {
            window.localStorage.removeItem('rememberMe');
          }
        } catch {}

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
            <div className={authStyles.brandLogo} aria-hidden />
            <h1 className={authStyles.brandTitle}>Fassandra</h1>
            <p className={authStyles.brandTagline}>
              {language === 'de' ? 'Texte & Cues. Gemeinsam.' : 'Texts & cues. Together.'}
            </p>
            {/* Brand actions intentionally omitted to match mockup */}
          </div>
        </section>

        <section className={`${authStyles.formPane} ${isExiting ? authStyles.exiting : ''}`} aria-label={language === 'de' ? 'Anmeldung' : 'Authentication'}>
          <div className={authStyles.authForm}>
            <div className={authStyles.chipRow} aria-hidden>
              <span className={`${authStyles.chip} ${authStyles.chipLight}`}>{language === 'de' ? 'LICHT' : 'LIGHT'}</span>
              <span className={`${authStyles.chip} ${authStyles.chipSound}`}>{language === 'de' ? 'TON' : 'SOUND'}</span>
              <span className={`${authStyles.chip} ${authStyles.chipVideo}`}>{language === 'de' ? 'VIDEO' : 'VIDEO'}</span>
            </div>
            <h2 className={authStyles.authTitle}>{language === 'de' ? 'Anmelden' : 'Login'}</h2>
            <p className={authStyles.authSubtitle}>
              {language === 'de'
                ? 'Arbeite mit deinem Ensemble an Szenen, Notizen und Cues.'
                : 'Work with your ensemble on scenes, notes and cues.'}
            </p>
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
                <div className={authStyles.inputWithAction}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={authStyles.formInput}
                    placeholder={language === 'de' ? 'Passwort eingeben' : 'Enter your password'}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? (language === 'de' ? 'Passwort ausblenden' : 'Hide password') : (language === 'de' ? 'Passwort anzeigen' : 'Show password')}
                    className={authStyles.inputAction}
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className={authStyles.formRowHelpers}>
                <label className={authStyles.checkboxLabel}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>{language === 'de' ? 'Angemeldet bleiben' : 'Stay signed in'}</span>
                </label>
                <button type="button" className={authStyles.linkMuted} onClick={() => alert(language === 'de' ? 'Funktion noch nicht verfügbar' : 'Not implemented yet')}>
                  {language === 'de' ? 'Passwort vergessen?' : 'Forgot password?'}
                </button>
              </div>
              <button type="submit" className={authStyles.submitButton}>{language === 'de' ? 'Weiter' : 'Continue'}</button>

              <div className={authStyles.divider} role="separator">
                <span>{language === 'de' ? 'oder' : 'or'}</span>
              </div>

              <div className={authStyles.oauthRow}>
                <button type="button" className={authStyles.oauthBtn} disabled>Google</button>
                <button type="button" className={authStyles.oauthBtn} disabled>GitHub</button>
              </div>
            </form>

            <div className={authStyles.footerNote}>
              {language === 'de' ? 'Neu bei Fassandra? ' : 'New to Fassandra? '}
              <button type="button" className={authStyles.link} onClick={() => setShowLogin(false)}>
                {language === 'de' ? 'Jetzt registrieren' : 'Create an account'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
