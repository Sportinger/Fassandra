import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { register } from '../api';
import styles from './Header.module.css';
import authStyles from './Auth.module.css';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { setToken, theme, setTheme } = useAuth();

  /**
   * Handles form submission for registration.
   *
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username) {
      setError('Username is required.');
      return;
    }
    try {
      const token = await register(email, username, password);
      
      // Trigger exit animation
      setIsExiting(true);
      
      // Wait for animation to complete (300ms) then set token
      setTimeout(() => {
        setToken(token);
      }, 300);
      
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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

      {/* Registration form with top margin to account for fixed header */}
      <div className={`${authStyles.authContainer} ${isExiting ? authStyles.exiting : ''}`} style={{ marginTop: '80px' }}>
        <div className={authStyles.authForm}>
          <h2 className={authStyles.authTitle}>Register</h2>
          {error && <div className={authStyles.errorMessage}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className={authStyles.formGroup}>
              <label htmlFor="register-email" className={authStyles.formLabel}>Email</label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authStyles.formInput}
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            </div>
            <div className={authStyles.formGroup}>
              <label htmlFor="register-username" className={authStyles.formLabel}>Username</label>
              <input
                id="register-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={authStyles.formInput}
                placeholder="Choose a username"
                required
                autoComplete="username"
              />
            </div>
            <div className={authStyles.formGroup}>
              <label htmlFor="register-password" className={authStyles.formLabel}>Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authStyles.formInput}
                placeholder="Create a password"
                required
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className={authStyles.submitButton}>Register</button>
          </form>
        </div>
      </div>
    </>
  );
}; 