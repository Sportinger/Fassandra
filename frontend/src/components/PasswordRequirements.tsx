import React from 'react';

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
    label: 'At least 8 characters',
    test: (p: string) => p.length >= 8,
  },
  {
    id: 'upper',
    label: 'One uppercase letter (A–Z)',
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: 'lower',
    label: 'One lowercase letter (a–z)',
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: 'digit',
    label: 'One number (0–9)',
    test: (p: string) => /\d/.test(p),
  },
  {
    id: 'special',
    label: 'One special: @$!%*?&',
    test: (p: string) => /[@$!%*?&]/.test(p),
  },
];

export const passwordIsValid = (password: string): boolean => checks.every(c => c.test(password));

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password, visible, className = '' }) => {
  if (!visible) return null;
  return (
    <div className={["passwordPopover", className].filter(Boolean).join(' ')} role="alert" aria-live="polite">
      <div className="passwordPopoverHeader">Password must include:</div>
      <ul className="passwordList">
        {checks.map(({ id, label, test }) => {
          const ok = test(password);
          return (
            <li key={id} className={ok ? 'ok' : 'bad'}>
              <span className="mark" aria-hidden>{ok ? '✓' : '•'}</span>
              <span className="text">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

