// Sage — botanical calm. Soft greens, warm serif headings, generous radius;
// for wellness, plants, beauty, and slow-living brands.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const sage: ThemePreset = {
  key: 'sage',
  name: 'Sage',
  category: 'general',
  description: 'Calm and botanical — soft greens, warm serif headings, easy spacing.',
  version: '1.0.0',
  recommendedFor: ['general'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#4d7c5a',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#a3b18a',
      colorBackground: '#fbfcfa',
      colorForeground: '#1f2a22',
      colorMuted: '#eef2ea',
      colorBorder: '#dce5d5',
      fontHeading: 'Fraunces',
      fontBody: 'Nunito Sans',
      radiusBase: '0.75rem',
      containerWidth: 'medium',
    },
    dark: {
      colorPrimary: '#6fa67e',
      colorPrimaryForeground: '#0e1611',
      colorAccent: '#b6c49c',
      colorBackground: '#0e1611',
      colorForeground: '#e7ede3',
      colorMuted: '#16211a',
      colorBorder: '#233127',
      fontHeading: 'Fraunces',
      fontBody: 'Nunito Sans',
      radiusBase: '0.75rem',
      containerWidth: 'medium',
    },
  },
};
