// Data-driven hue → silicaui utility classes. Several home surfaces pick a palette
// hue at runtime (per category aisle, per trust promise, per promo edit), but
// Tailwind only emits classes it can see as LITERALS at build time — so a runtime
// `bg-${name}/10` produces nothing. The fix is a static lookup of complete class
// strings: every registered color maps to its literal utilities here, and callers
// index in. The tint wash is a real opacity modifier (`/10`), so it composites
// correctly over any base surface — no hand-rolled `color-mix` into a fixed base.

/** Colored glyph on a 10%-alpha wash of the same hue — the soft "icon chip". */
const TINT_CHIP: Record<string, string> = {
  primary: 'text-primary bg-primary/10',
  secondary: 'text-secondary bg-secondary/10',
  accent: 'text-accent bg-accent/10',
  neutral: 'text-neutral bg-neutral/10',
  info: 'text-info bg-info/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  error: 'text-error bg-error/10',
  danger: 'text-danger bg-danger/10',
};

/** Just the hue as a foreground color (e.g. a bare accent icon, no wash). */
const HUE_TEXT: Record<string, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  accent: 'text-accent',
  neutral: 'text-neutral',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  danger: 'text-danger',
};

export function tintChip(color: string): string {
  return TINT_CHIP[color] ?? TINT_CHIP.neutral!;
}

export function hueText(color: string): string {
  return HUE_TEXT[color] ?? HUE_TEXT.neutral!;
}
