// Noir — dark luxe. High-contrast, editorial type, a gold accent; tuned for
// jewelry, premium fashion, and brands that sell on restraint.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const noir: ThemePreset = {
  key: 'noir',
  name: 'Noir',
  category: 'fashion',
  description: 'Dark, high-contrast luxury — restrained type and a single gold accent.',
  version: '1.0.0',
  recommendedFor: ['fashion'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#0a0a0a',
      colorPrimaryForeground: '#f5f0e6',
      colorAccent: '#b08d57',
      colorBackground: '#fafaf8',
      colorForeground: '#1a1a1a',
      colorMuted: '#f0eee9',
      colorBorder: '#e2ded4',
      fontHeading: 'Cormorant Garamond',
      fontBody: 'Inter',
      radiusBase: '0px',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#f5f0e6',
      colorPrimaryForeground: '#0a0a0a',
      colorAccent: '#c9a86a',
      colorBackground: '#0b0b0c',
      colorForeground: '#eceae4',
      colorMuted: '#161617',
      colorBorder: '#26262a',
      fontHeading: 'Cormorant Garamond',
      fontBody: 'Inter',
      radiusBase: '0px',
      containerWidth: 'wide',
    },
  },
};
