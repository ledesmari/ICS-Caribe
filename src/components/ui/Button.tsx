import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles';

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

/** Icon-only buttons must pass `aria-label`. */
type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> &
  ({ size?: 'md' | 'lg' } | { size: 'icon'; 'aria-label': string });

export function Button({ variant = 'primary', size = 'md', icon, className = '', type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = Common & LinkProps;

export function ButtonLink({ variant = 'primary', size = 'md', icon, className = '', children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
