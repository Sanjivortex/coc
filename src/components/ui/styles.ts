// Plain class helpers (no 'use client'), so server components can style links as buttons.

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  // Clash gold with a pressed-button bottom edge, like the buttons in the game.
  primary:
    'bg-gradient-to-b from-[#f7cf5e] to-[#e9a91f] text-[#231600] shadow-[0_2px_0_0_#8a5f00,0_8px_20px_-8px_rgba(240,180,41,0.45)] hover:from-[#ffdd78] hover:to-[#f0b429] active:translate-y-px active:shadow-[0_1px_0_0_#8a5f00]',
  secondary:
    'border border-line bg-raised text-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:border-line-strong hover:bg-hover',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink',
};
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-4 text-sm' };

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${extra}`;
}

export type ButtonVariant = Variant;
export type ButtonSize = Size;
