import type { CSSProperties } from 'react';

// Module-color helpers for the bespoke story tokens. We mirror the @sparx/ui module
// recipe inline (tint = 14% into transparent, ink = ~58% toward text) off the
// `--module-<key>` token, so a clause chip wears its module's hue and stays
// theme-aware without wrapping each inline word in a ModuleProvider.

export const moduleVar = (key: string): string => `var(--module-${key})`;

export const tintStyle = (key: string): CSSProperties => ({
  background: `color-mix(in oklch, var(--module-${key}) 14%, transparent)`,
  color: `color-mix(in oklch, var(--module-${key}) 58%, var(--color-text-primary))`,
});

export const dotStyle = (key: string): CSSProperties => ({
  background: `var(--module-${key})`,
});
