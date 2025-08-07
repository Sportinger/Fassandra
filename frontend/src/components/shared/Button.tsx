import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

/**
 * Button component props with proper TypeScript validation
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant for different styles */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Loading state */
  loading?: boolean;
  /** Icon to display before text */
  icon?: ReactNode;
  /** Icon to display after text */
  iconEnd?: ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Children elements */
  children: ReactNode;
}

/**
 * Reusable Button component following composition pattern
 * 
 * @example
 * <Button variant="primary" size="large" onClick={handleClick}>
 *   Click me
 * </Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      loading = false,
      icon,
      iconEnd,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...restProps
    },
    ref
  ) => {
    const classNames = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      loading && styles.loading,
      disabled && styles.disabled,
      className
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={disabled || loading}
        {...restProps}
      >
        {loading && <span className={styles.spinner} />}
        {!loading && icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.content}>{children}</span>
        {!loading && iconEnd && <span className={styles.iconEnd}>{iconEnd}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';