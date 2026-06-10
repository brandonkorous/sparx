// Pulse — neon and electric. Violet with a cyan accent over deep ink in dark
// mode; for tech, gaming, electronics, and hype-driven DTC.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const pulse: ThemePreset = {
  key: 'pulse',
  name: 'Pulse',
  category: 'dropship',
  description: 'Electric and modern — violet and cyan, glowing over deep ink in dark mode.',
  version: '1.0.0',
  recommendedFor: ['dropship'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#6d28d9',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#06b6d4',
      colorBackground: '#ffffff',
      colorForeground: '#18122b',
      colorMuted: '#f3f0fb',
      colorBorder: '#e4def5',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      radiusBase: '0.75rem',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#8b5cf6',
      colorPrimaryForeground: '#0b0716',
      colorAccent: '#22d3ee',
      colorBackground: '#0a0712',
      colorForeground: '#ede9f7',
      colorMuted: '#130c24',
      colorBorder: '#241a3d',
      fontHeading: 'Space Grotesk',
      fontBody: 'Inter',
      radiusBase: '0.75rem',
      containerWidth: 'wide',
    },
  },
};
