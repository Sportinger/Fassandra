import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { login } from '../api';
import { logDebugInfo } from '../utils/debug';
import styles from './Header.module.css';
import authStyles from './Auth.module.css';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { setToken, theme, setTheme } = useAuth();

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
        // Since the backend sets cookies, we just need to mark as authenticated
        // and fetch the user data
        setToken('authenticated', response.user);
        logDebugInfo('Login', 'Authentication state set after exit animation');
      }, 300);
      
    } catch (err: any) { // Catch specific errors if possible
      const errorMsg = err.message || 'Login failed';
      logDebugInfo('Login', `Login failed: ${errorMsg}`);
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      {/* Header with simplified breadcrumb and theme toggle only */}
      <header className={styles.header}>
        {/* Simple breadcrumb showing only PESSOA */}
        <nav className={styles.breadcrumb}>
          <span className={`${styles.segment} ${styles.pessoaSegment}`}>PESSOA</span>
        </nav>

        {/* Menu with only theme toggle */}
        <div className={styles.menuContainer}>
          <button className={styles.menuButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            ☰
          </button>
          {isMenuOpen && (
            <div className={styles.dropdownMenu} onMouseLeave={() => setIsMenuOpen(false)}>
              <button onClick={handleThemeToggle}>
                {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Login form with top margin to account for fixed header */}
      <div className={`${authStyles.authContainer} ${isExiting ? authStyles.exiting : ''}`} style={{ marginTop: '80px' }}>
        <div className={authStyles.authForm}>
          <h2 className={authStyles.authTitle}>Login</h2>
          {error && <div className={authStyles.errorMessage}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className={authStyles.formGroup}>
              <label htmlFor="login-email" className={authStyles.formLabel}>Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authStyles.formInput}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className={authStyles.formGroup}>
              <label htmlFor="login-password" className={authStyles.formLabel}>Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authStyles.formInput}
                placeholder="Enter your password"
                required
              />
            </div>
            <button type="submit" className={authStyles.submitButton}>Login</button>
          </form>
        </div>
      </div>
    </>
  );
}; 