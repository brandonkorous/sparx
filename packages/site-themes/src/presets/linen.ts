// Linen — soft editorial. Warm charcoal with a clay accent over creamy neutrals,
// classic serif headings; for apparel, lifestyle, and stationery.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const linen: ThemePreset = {
  key: 'linen',
  name: 'Linen',
  category: 'fashion',
  description: 'Soft and editorial — warm charcoal and clay over creamy neutrals.',
  version: '1.0.0',
  recommendedFor: ['fashion'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#44403c',
      colorPrimaryForeground: '#faf8f5',
      colorAccent: '#a8755a',
      colorBackground: '#faf8f4',
      colorForeground: '#292524',
      colorMuted: '#f1ede6',
      colorBorder: '#e4ddd2',
      fontHeading: 'Libre Baskerville',
      fontBody: 'Inter',
      radiusBase: '0.25rem',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#e7e2da',
      colorPrimaryForeground: '#1c1a17',
      colorAccent: '#c18f73',
      colorBackground: '#161412',
      colorForeground: '#ece7df',
      colorMuted: '#201d18',
      colorBorder: '#322d25',
      fontHeading: 'Libre Baskerville',
      fontBody: 'Inter',
      radiusBase: '0.25rem',
      containerWidth: 'wide',
    },
  },
};
