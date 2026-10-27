// Plain class helpers (no 'use client'), so server components can style links as buttons.

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:bg-white',
  secondary: 'border border-line bg-raised text-ink hover:border-line-strong hover:bg-hover',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
};
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm' };

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export type ButtonVariant = Variant;
export type ButtonSize = Size;
