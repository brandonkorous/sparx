// Token Model v2 (docs/33-token-model-v2.md) — barrel.
//
// `silica-css` is the ONLY stylesheet emitter here: it projects a compiled theme
// into silicaui's own `--color-*` / `--radius-*` / `--font-*` vocabulary, which the
// storefront and the builder canvas both read directly.
//
// `css.ts` (the `--st-*` emitter, plus its derived space scale, shadow set and
// legacy aliases) and `legacy.ts` (the v1→v2 bridge that fed it) are DELETED. They
// emitted a parallel token vocabulary for the same values, which made tenant colour
// have two sources of truth — reconciled by stylesheet order, so an applied theme
// could silently keep the previous palette. Do not add another emitter here: a
// second vocabulary is the bug, whichever way it points.
// See docs/implementation/st-token-retirement.md.

export * from './types';
export * from './color';
export * from './compile';
export * from './from-tokens';
export * from './silica-css';
export * from './tenant';
export * from './brand-theme';
