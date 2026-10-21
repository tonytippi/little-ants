import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-leaf-600 text-white hover:bg-leaf-700 disabled:bg-leaf-600/50',
  accent: 'bg-ant-500 text-white hover:bg-ant-600 disabled:bg-ant-500/50',
  secondary: 'bg-white text-bark-900 ring-1 ring-cream-200 hover:bg-cream-100 disabled:text-bark-500',
  ghost: 'text-bark-700 hover:bg-cream-100 disabled:text-bark-500',
  danger: 'bg-white text-ant-700 ring-1 ring-ant-100 hover:bg-ant-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  xl: 'h-16 px-7 text-xl gap-3',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = ''): string {
  return `inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({ variant = 'primary', size = 'md', busy = false, className = '', disabled, children, ...props }: ButtonProps) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy} {...props}>
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}
