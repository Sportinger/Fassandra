import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { login, loginWithGoogle } from '../api';
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

  // Lazy-load Google Identity Services script
  const loadGoogleScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.accounts?.id) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Google Identity script'));
      document.head.appendChild(s);
    });
  };

  const handleGoogleLogin = async () => {
    try {
      await loadGoogleScript();
      const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string | undefined;
      if (!clientId) {
        alert('Google Sign-In is not configured. Missing VITE_GOOGLE_CLIENT_ID');
        return;
      }
      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup', // avoid third‑party cookie issues by using a first‑party popup
        auto_select: false,
        callback: async (response: any) => {
          try {
            const idToken = response?.credential;
            if (!idToken) throw new Error('No credential received');
            const result = await loginWithGoogle(idToken);
            // Mirror normal login flow with exit animation
            setIsExiting(true);
            setTimeout(() => {
              setToken(result.token, result.user);
            }, 300);
          } catch (err: any) {
            // Surface detailed error for faster diagnosis (e.g., client mismatch)
            const message = (err?.body || err?.message || 'Google login failed').toString();
            logger.error('Login', 'Google login failed', message);
            alert(message);
          }
        }
      });
      // Show Google account chooser as a popup (more reliable across browsers)
      (window as any).google.accounts.id.prompt();
    } catch (e: any) {
      const msg = (e?.message || 'Failed to start Google login').toString();
      logger.error('Login', 'Failed to start Google login', msg);
      alert(msg);
    }
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
              <span className={`${authStyles.chip} ${authStyles.chipProps}`}>{language === 'de' ? 'REQUISITE' : 'PROPS'}</span>
              {/* Force next items onto a second row */}
              <span className={authStyles.chipBreak} aria-hidden />
              <span className={`${authStyles.chip} ${authStyles.chipDramaturgie}`}>{language === 'de' ? 'DRAMATURGIE' : 'DRAMATURGY'}</span>
              <span className={`${authStyles.chip} ${authStyles.chipSchnuerboden}`}>{language === 'de' ? 'SCHNÜRBODEN' : 'RIGGING'}</span>
            </div>
            {/* Title intentionally removed per design */}
            <p className={authStyles.authSubtitle}>
              {language === 'de'
                ? 'Arbeite mit deinem Ensemble an Szenen, Notizen und Cues.'
                : 'Work with your ensemble on scenes, notes and cues.'}
            </p>
            {error && <div className={authStyles.errorMessage}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className={authStyles.formGroup}>
                <label htmlFor="login-email" className={`${authStyles.formLabel} ${authStyles.srOnly}`}>{language === 'de' ? 'E-Mail' : 'Email'}</label>
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
                <label htmlFor="login-password" className={`${authStyles.formLabel} ${authStyles.srOnly}`}>{language === 'de' ? 'Passwort' : 'Password'}</label>
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
                <button
                  type="button"
                  className={authStyles.oauthBtn}
                  onClick={handleGoogleLogin}
                  style={{ gridColumn: '1 / -1' }}
                  aria-label="Google Login"
                >
                  <span className={authStyles.oauthBtnContent}>
                    <svg
                      className={authStyles.oauthIcon}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path fill="#4285F4" d="M23.49 12.27c0-.85-.07-1.47-.23-2.11H12v3.83h6.53c-.13.96-.85 2.39-2.44 3.36l-.02.12 3.54 2.75.25.02c2.33-2.15 3.63-5.32 3.63-8.97z"/>
                      <path fill="#34A853" d="M12 24c3.29 0 6.05-1.09 8.06-2.99l-3.83-2.98c-1.02.7-2.39 1.19-4.23 1.19-3.24 0-5.98-2.14-6.96-5.06l-.14.01-3.75 2.9-.05.13C2.99 21.53 7.13 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.04 14.16c-.24-.72-.38-1.49-.38-2.28s.14-1.56.37-2.28l-.01-.15-3.8-2.94-.12.06C.41 8.27 0 10.08 0 12c0 1.92.41 3.73 1.11 5.43l3.93-3.27z"/>
                      <path fill="#EA4335" d="M12 4.74c1.82 0 3.05.79 3.75 1.45l2.74-2.67C18.04 1.4 15.29 0 12 0 7.13 0 2.99 2.47 1.11 6.57l3.92 3.27c.98-2.92 3.72-5.1 6.97-5.1z"/>
                    </svg>
                    <span>Google</span>
                  </span>
                </button>
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
