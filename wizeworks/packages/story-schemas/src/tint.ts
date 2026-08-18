// Module-color helpers for the story's bespoke tokens. We mirror the @wizeworks/ui module
// recipe inline (tint = 14% into transparent, ink = ~58% toward text) off the
// `--color-module-<key>` token, so a clause chip wears its module's hue and stays
// theme-aware without wrapping each inline word in a ModuleProvider. Shared so the
// composer's editable chips and the marketing hero's read-only ones are the same
// colors, not two drifting copies of the recipe.
//
// Framework-free by design (plain string properties, assignable to React's
// CSSProperties) — this package stays React-less.

export interface TokenTint {
  background: string;
  color: string;
}

export const moduleVar = (key: string): string => `var(--color-module-${key})`;

export const tintStyle = (key: string): TokenTint => ({
  background: `color-mix(in oklch, var(--color-module-${key}) 14%, transparent)`,
  color: `color-mix(in oklch, var(--color-module-${key}) 58%, var(--color-base-content))`,
});

export const dotStyle = (key: string): { background: string } => ({
  background: `var(--color-module-${key})`,
});
