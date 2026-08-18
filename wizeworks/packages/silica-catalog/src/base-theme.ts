// BASE_SILICA_THEME — the platform's default site theme: the sparx Ember look.
//
// Every site resolves to a concrete `site.theme` (docs/implementation
// perfect-template + the theming-spine plan) — the storefront renders it verbatim
// and transactional email derives from it. This constant is that default: what a
// site wears when it has no stored theme yet (the pre-install window, or a render
// fallback). It IS the golden template's captured theme (tenant WizeWorks, property
// "Template"), copied verbatim so the platform default and the flagship blueprint
// are the same proven Ember look — light + dark, every `-content` pair and residual
// concrete (no derivation at render). A new site becomes the golden template on
// provision, so this fallback is a safety net, not the common path.
//
// Mirrors marketplace-catalog/blueprints/sparx/site.json `theme`. If that flagship
// look ever changes, update both.

import type { Theme } from '@wizeworks/silicaui-html';

export const BASE_SILICA_THEME: Theme = {
  name: 'sparx',
  mode: 'light',
  tokens: {
    '--depth': '1',
    '--border': '1px',
    '--font-sans': "'Inter', system-ui, -apple-system, sans-serif",
    '--font-heading': "'Space Grotesk', system-ui, -apple-system, sans-serif",
    '--radius-box': '0.5rem',
    '--radius-field': '0.375rem',
    '--radius-selector': '9999px',
    '--size-field': '0.25rem',
    '--container-max': '72rem',
    '--color-base-100': '#ffffff',
    '--color-base-200': '#f8fafc',
    '--color-base-300': '#eef2f7',
    '--color-base-content': '#0f172a',
    '--color-primary': '#e04631',
    '--color-primary-content': '#ffffff',
    '--color-secondary': '#4c9a8e',
    '--color-secondary-content': '#ffffff',
    '--color-accent': '#c1652e',
    '--color-accent-content': '#fff7ef',
    '--color-neutral': '#0f172a',
    '--color-neutral-content': '#ffffff',
    '--color-info': '#0284c7',
    '--color-info-content': '#f0f9ff',
    '--color-success': '#16a34a',
    '--color-success-content': '#f0fdf4',
    '--color-warning': '#d97706',
    '--color-warning-content': '#0a0a0a',
    '--color-error': '#dc2626',
    '--color-error-content': '#ffffff',
    '--color-danger': '#dc2626',
    '--color-danger-content': '#ffffff',
    '--color-highlight': '#ec4899',
    '--color-highlight-content': '#ffffff',
    '--color-border': '#e2e8f0',
  },
  dark: {
    '--color-base-100': '#0b1120',
    '--color-base-200': '#111827',
    '--color-base-300': '#1b2538',
    '--color-base-content': '#e2e8f0',
    '--color-primary': '#f2604b',
    '--color-primary-content': '#ffffff',
    '--color-secondary': '#4c9a8e',
    '--color-secondary-content': '#ffffff',
    '--color-accent': '#c1652e',
    '--color-accent-content': '#fff7ef',
    '--color-neutral': '#e2e8f0',
    '--color-neutral-content': '#0a0a0a',
    '--color-info': '#38bdf8',
    '--color-info-content': '#0a0a0a',
    '--color-success': '#4ade80',
    '--color-success-content': '#0a0a0a',
    '--color-warning': '#fbbf24',
    '--color-warning-content': '#0a0a0a',
    '--color-error': '#f87171',
    '--color-error-content': '#0a0a0a',
    '--color-danger': '#f87171',
    '--color-danger-content': '#0a0a0a',
    '--color-highlight': '#ec4899',
    '--color-highlight-content': '#0a0a0a',
    '--color-border': '#1f2937',
  },
};
