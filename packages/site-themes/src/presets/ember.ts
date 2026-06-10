// Ember — warm and energetic. Ember orange with a raspberry secondary; for food,
// drink, fitness, and events that want appetite and momentum.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const ember: ThemePreset = {
  key: 'ember',
  name: 'Ember',
  category: 'food',
  description: 'Warm and energetic — ember orange and raspberry, punchy and appetizing.',
  version: '1.0.0',
  recommendedFor: ['food'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#e8590c',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#c2255c',
      colorBackground: '#fffcf9',
      colorForeground: '#2b1a12',
      colorMuted: '#fbefe7',
      colorBorder: '#f3dccb',
      fontHeading: 'Sora',
      fontBody: 'Inter',
      radiusBase: '0.5rem',
      containerWidth: 'medium',
    },
    dark: {
      colorPrimary: '#ff7a33',
      colorPrimaryForeground: '#1a0e07',
      colorAccent: '#f35e94',
      colorBackground: '#1a0e07',
      colorForeground: '#f3e7de',
      colorMuted: '#24140c',
      colorBorder: '#3a2114',
      fontHeading: 'Sora',
      fontBody: 'Inter',
      radiusBase: '0.5rem',
      containerWidth: 'medium',
    },
  },
};
