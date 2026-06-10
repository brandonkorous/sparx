// Coast — airy and coastal. Teal-blue with a sand accent, rounded shapes, light
// surfaces; for travel, hospitality, home, and lifestyle brands.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const coast: ThemePreset = {
  key: 'coast',
  name: 'Coast',
  category: 'general',
  description: 'Airy and coastal — teal-blue with a warm sand accent and rounded shapes.',
  version: '1.0.0',
  recommendedFor: ['general'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#0e7490',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#f4a259',
      colorBackground: '#fbfdfe',
      colorForeground: '#11303a',
      colorMuted: '#e8f3f6',
      colorBorder: '#cfe6ec',
      fontHeading: 'Poppins',
      fontBody: 'Inter',
      radiusBase: '1rem',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#22a7c4',
      colorPrimaryForeground: '#052730',
      colorAccent: '#f4a259',
      colorBackground: '#06212a',
      colorForeground: '#ddeef2',
      colorMuted: '#0c2e38',
      colorBorder: '#144450',
      fontHeading: 'Poppins',
      fontBody: 'Inter',
      radiusBase: '1rem',
      containerWidth: 'wide',
    },
  },
};
