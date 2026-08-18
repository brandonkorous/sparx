// theme.ts — the payload for a THEME submission.
//
// A theme is PURE DATA: two parallel token sets that the platform applies without
// running any code.
//   • `v1`  — the legacy storefront token surface (light + dark). Drives the
//             published snapshot's write-through so older read paths keep working.
//   • `v2`  — the Token-Model-v2 preset (shared shape/rhythm + per-mode color
//             slots). Drives the live compile; brand identity + the tenant's
//             presentation overlay layer on top at render. `*Content` pairs are
//             optional — the compiler derives a legible value when omitted.
//
// Author in TypeScript for editor help; the submission pipeline validates this
// against the `DataThemePreset` schema and stores the resulting JSON. Nothing here
// executes at runtime — it is read as data.

import type { DataThemePreset } from '@wizeworks/marketplace-schemas';

const theme: DataThemePreset = {
  v: 1,

  v1: {
    light: {
      colorPrimary: '#0e7490',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#7c3aed',
      colorBackground: '#ffffff',
      colorForeground: '#0f172a',
      colorMuted: '#f1f5f9',
      colorBorder: '#e2e8f0',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      radiusBase: '0.75rem',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#22d3ee',
      colorPrimaryForeground: '#06141b',
      colorAccent: '#a78bfa',
      colorBackground: '#070d18',
      colorForeground: '#e2e8f0',
      colorMuted: '#0e1626',
      colorBorder: '#1e293b',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      radiusBase: '0.75rem',
      containerWidth: 'wide',
    },
  },

  v2: {
    shared: {
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      radiusSelector: '9999px',
      radiusField: '0.5rem',
      radiusBox: '0.75rem',
      borderWidth: '1px',
      spaceBase: '0.25rem',
      sizeField: '2.75rem',
      sizeSelector: '2rem',
      depth: 1.1,
      containerWidth: 'wide',
    },
    light: {
      base100: '#ffffff',
      base200: '#f8fafc',
      base300: '#eef2f7',
      baseContent: '#0f172a',
      primary: '#0e7490',
      primaryContent: '#ffffff',
      secondary: '#7c3aed',
      accent: '#06b6d4',
      neutral: '#0f172a',
      border: '#e2e8f0',
      info: '#0284c7',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
    },
    dark: {
      base100: '#070d18',
      base200: '#0e1626',
      base300: '#172033',
      baseContent: '#e2e8f0',
      primary: '#22d3ee',
      primaryContent: '#06141b',
      secondary: '#a78bfa',
      accent: '#38bdf8',
      neutral: '#e2e8f0',
      border: '#1e293b',
      info: '#38bdf8',
      success: '#4ade80',
      warning: '#fbbf24',
      danger: '#f87171',
    },
  },
};

export default theme;
