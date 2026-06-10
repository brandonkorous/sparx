// Bloom — playful pastel. Pink and violet, rounded and friendly; for kids,
// crafts, bakeries, and brands that want a little joy.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const bloom: ThemePreset = {
  key: 'bloom',
  name: 'Bloom',
  category: 'general',
  description: 'Playful and soft — pink and violet, generous rounding, friendly type.',
  version: '1.0.0',
  recommendedFor: ['general'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#db2777',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#8b5cf6',
      colorBackground: '#fffbfe',
      colorForeground: '#3a1e33',
      colorMuted: '#fbeef6',
      colorBorder: '#f4d9ea',
      fontHeading: 'Quicksand',
      fontBody: 'Nunito',
      radiusBase: '1.25rem',
      containerWidth: 'medium',
    },
    dark: {
      colorPrimary: '#f472b6',
      colorPrimaryForeground: '#2a0e1f',
      colorAccent: '#a78bfa',
      colorBackground: '#1c0e18',
      colorForeground: '#f6e6f0',
      colorMuted: '#271020',
      colorBorder: '#3d1c33',
      fontHeading: 'Quicksand',
      fontBody: 'Nunito',
      radiusBase: '1.25rem',
      containerWidth: 'medium',
    },
  },
};
