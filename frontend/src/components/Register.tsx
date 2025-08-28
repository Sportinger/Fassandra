import React, { useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { register } from '../api';
import authStyles from './Auth.module.css';
import { getErrorMessage } from '../types/common';
import logger from '../services/LoggingService';
import { PasswordRequirements, passwordIsValid } from './PasswordRequirements';
import { useUIState } from '../hooks/useUIState';
/**
 * Registration form component for new users.
 *
 * Renders a form for users to enter their email, username, and password, and handles registration logic.
 * Displays error messages on failure.
 *
 * @component
 */
export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { setToken, theme, setTheme, language = 'de', setLanguage } = useAuth();
  const { setShowLogin } = useUIState();

  /**
   * Handles form submission for registration.
   *
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username) {
      setError(language === 'de' ? 'Benutzername ist erforderlich.' : 'Username is required.');
      return;
    }
    // Client-side password validation to provide immediate guidance
    if (!passwordIsValid(password)) {
      setShowPasswordHelp(true);
      setError(language === 'de' ? 'Bitte erfüllen Sie die Passwort-Anforderungen.' : 'Please meet the password requirements.');
      return;
    }
    try {
      const response = await register(email, username, password);
      
      // Trigger exit animation
      setIsExiting(true);
      
      // Wait for animation to complete (300ms) then set token
      setTimeout(() => {
        // Since the backend sets cookies, we just need to mark as authenticated
        // and set the user data
        setToken('authenticated', response.user);
      }, 300);
      
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      // If backend indicates password policy issues, show the helper
      if (/password must/i.test(msg)) {
        setShowPasswordHelp(true);
      }
      logger.error('Register', 'Error:', err);
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
          </div>
        </section>

        <section className={`${authStyles.formPane} ${isExiting ? authStyles.exiting : ''}`} aria-label={language === 'de' ? 'Registrierung' : 'Registration'}>
          <div className={authStyles.authForm}>
            <div className={authStyles.chipRow} aria-hidden>
              <span className={`${authStyles.chip} ${authStyles.chipLight}`}>{language === 'de' ? 'LICHT' : 'LIGHT'}</span>
              <span className={`${authStyles.chip} ${authStyles.chipSound}`}>{language === 'de' ? 'TON' : 'SOUND'}</span>
              <span className={`${authStyles.chip} ${authStyles.chipVideo}`}>{language === 'de' ? 'VIDEO' : 'VIDEO'}</span>
            </div>
            <h2 className={authStyles.authTitle}>{language === 'de' ? 'Registrieren' : 'Register'}</h2>
            <p className={authStyles.authSubtitle}>
              {language === 'de'
                ? 'Starte mit deinem Ensemble. Erstelle deinen Account.'
                : 'Start with your ensemble. Create your account.'}
            </p>
            {error && <div className={authStyles.errorMessage}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className={authStyles.formGroup}>
                <label htmlFor="register-email" className={authStyles.formLabel}>{language === 'de' ? 'E-Mail' : 'Email'}</label>
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authStyles.formInput}
                  placeholder={language === 'de' ? 'E-Mail eingeben' : 'Enter your email'}
                  required
                  autoComplete="email"
                />
              </div>
              <div className={authStyles.formGroup}>
                <label htmlFor="register-username" className={authStyles.formLabel}>{language === 'de' ? 'Benutzername' : 'Username'}</label>
                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={authStyles.formInput}
                  placeholder={language === 'de' ? 'Benutzernamen wählen' : 'Choose a username'}
                  required
                  autoComplete="username"
                />
              </div>
              <div className={`${authStyles.formGroup} ${authStyles.relativeGroup}`}>
                <label htmlFor="register-password" className={authStyles.formLabel}>{language === 'de' ? 'Passwort' : 'Password'}</label>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPassword(val);
                    setShowPasswordHelp(passwordFocused && val.length > 0 && !passwordIsValid(val));
                  }}
                  onFocus={() => {
                    setPasswordFocused(true);
                    setShowPasswordHelp(password.length > 0 && !passwordIsValid(password));
                  }}
                  onBlur={() => {
                    setPasswordFocused(false);
                    if (!/password must/i.test(error || '')) {
                      setShowPasswordHelp(false);
                    }
                  }}
                  className={authStyles.formInput}
                  placeholder={language === 'de' ? 'Passwort erstellen' : 'Create a password'}
                  required
                  autoComplete="new-password"
                />
                <PasswordRequirements password={password} visible={showPasswordHelp} />
              </div>
              <button type="submit" className={authStyles.submitButton}>{language === 'de' ? 'Registrieren' : 'Register'}</button>
            </form>

            <div className={authStyles.footerNote}>
              {language === 'de' ? 'Schon ein Konto? ' : 'Already have an account? '}
              <button type="button" className={authStyles.link} onClick={() => setShowLogin(true)}>
                {language === 'de' ? 'Jetzt anmelden' : 'Sign in'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
