/**
 * Button class builder (shared by <Button> and <ButtonLink>).
 * Text on orange is always ink; navy/green buttons use white text (contrast ≥ 4.5:1).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-orange-500 text-ink hover:bg-orange-300',
  secondary: 'bg-navy-700 text-white hover:bg-navy-900',
  success: 'bg-green-600 text-white hover:bg-green-700',
  outline: 'border border-line bg-white text-ink hover:bg-page',
  ghost: 'text-secondary hover:bg-navy-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-12 px-6 text-base',
  icon: 'size-11 justify-center',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = ''): string {
  return [
    'inline-flex shrink-0 items-center gap-2 rounded-full font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(' ');
}
