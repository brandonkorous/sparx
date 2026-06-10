// Meridian — corporate and trustworthy. Navy with a sky accent, tight radius and
// a wide layout; for professional services, SaaS, and B2B.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const meridian: ThemePreset = {
  key: 'meridian',
  name: 'Meridian',
  category: 'b2b',
  description: 'Professional and trustworthy — navy with a sky accent, crisp and wide.',
  version: '1.0.0',
  recommendedFor: ['b2b'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#1e3a8a',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#0ea5e9',
      colorBackground: '#ffffff',
      colorForeground: '#0f1b33',
      colorMuted: '#f1f5fb',
      colorBorder: '#dce5f1',
      fontHeading: 'Manrope',
      fontBody: 'Inter',
      radiusBase: '0.375rem',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#3b5bdb',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#38bdf8',
      colorBackground: '#0a1124',
      colorForeground: '#dce6f5',
      colorMuted: '#111a33',
      colorBorder: '#1e2a48',
      fontHeading: 'Manrope',
      fontBody: 'Inter',
      radiusBase: '0.375rem',
      containerWidth: 'wide',
    },
  },
};
