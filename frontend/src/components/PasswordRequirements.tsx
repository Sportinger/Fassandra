import React from 'react';
import authStyles from './Auth.module.css';
import { useAuth } from '../AuthContext';

export interface PasswordRequirementsProps {
  password: string;
  visible: boolean;
  className?: string;
}

// Client-side mirror of backend policy:
// - Min 8 chars
// - At least one uppercase, one lowercase, one digit, one special (@$!%*?&)
const checks = [
  {
    id: 'len',
    label_en: 'At least 8 characters',
    label_de: 'Mindestens 8 Zeichen',
    test: (p: string) => p.length >= 8,
  },
  {
    id: 'upper',
    label_en: 'One uppercase letter (A–Z)',
    label_de: 'Mindestens ein Großbuchstabe (A–Z)',
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: 'lower',
    label_en: 'One lowercase letter (a–z)',
    label_de: 'Mindestens ein Kleinbuchstabe (a–z)',
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: 'digit',
    label_en: 'One number (0–9)',
    label_de: 'Mindestens eine Zahl (0–9)',
    test: (p: string) => /\d/.test(p),
  },
  {
    id: 'special',
    label_en: 'One special: @$!%*?&',
    label_de: 'Mindestens ein Sonderzeichen: @$!%*?&',
    test: (p: string) => /[@$!%*?&]/.test(p),
  },
];

export const passwordIsValid = (password: string): boolean => checks.every(c => c.test(password));

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password, visible, className = '' }) => {
  if (!visible) return null;
  const { language = 'de' } = useAuth();
  return (
    <div className={[authStyles.passwordPopover, className].filter(Boolean).join(' ')} role="alert" aria-live="polite">
      <div className={authStyles.passwordPopoverHeader}>
        {language === 'de' ? 'Passwort muss enthalten:' : 'Password must include:'}
      </div>
      <ul className={authStyles.passwordList}>
        {checks.map(({ id, label_en, label_de, test }) => {
          const ok = test(password);
          return (
            <li key={id} className={ok ? authStyles.ok : authStyles.bad}>
              <span className={authStyles.mark} aria-hidden>{ok ? '✓' : '•'}</span>
              <span className={authStyles.text}>{language === 'de' ? label_de : label_en}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
