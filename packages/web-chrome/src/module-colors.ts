// Per-module brand colors for the marketing chrome (the megamenu swatches).
// Mirrors the module palette in docs/sparx-brand-guide.md. These are brand
// constants; in-app surfaces read module color from the `--module-*` tokens at
// runtime, but the marketing megamenu needs the tint/text pairs statically for
// its swatches, so they live here as plain data.
const MODULE_COLORS = {
  builder: { color: 'var(--module-builder)', tint: '#EEF2FF', text: '#4338CA' },
  commerce: { color: 'var(--module-commerce)', tint: '#FFF7ED', text: '#C2410C' },
  cms: { color: 'var(--module-cms)', tint: '#F0FDFA', text: '#0F766E' },
  crm: { color: 'var(--module-crm)', tint: '#ECFEFF', text: '#0E7490' },
  email: { color: 'var(--module-email)', tint: '#F0F9FF', text: '#0369A1' },
  b2b: { color: 'var(--module-b2b)', tint: '#F1F5F9', text: '#334155' },
  ai: { color: 'var(--module-ai)', tint: '#FDF2F8', text: '#9D174D' },
  dropship: { color: 'var(--module-dropship)', tint: '#ECFDF5', text: '#065F46' },
  scheduling: { color: 'var(--module-scheduling)', tint: '#FFF1F2', text: '#BE123C' },
} as const;

export type MarketingModule = keyof typeof MODULE_COLORS;

export function getModuleColor(module: MarketingModule) {
  return MODULE_COLORS[module];
}

export { MODULE_COLORS };
