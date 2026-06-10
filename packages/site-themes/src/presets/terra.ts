// Terra — earthy and artisan. Terracotta with an olive accent, warm neutrals;
// for makers, pottery, home goods, and roasters.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const terra: ThemePreset = {
  key: 'terra',
  name: 'Terra',
  category: 'general',
  description: 'Earthy and handmade — terracotta and olive over warm sandy neutrals.',
  version: '1.0.0',
  recommendedFor: ['general'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#9a3412',
      colorPrimaryForeground: '#fff7ed',
      colorAccent: '#4d7c0f',
      colorBackground: '#fdfbf7',
      colorForeground: '#2e2016',
      colorMuted: '#f4ebdf',
      colorBorder: '#e6d6c2',
      fontHeading: 'Fraunces',
      fontBody: 'Inter',
      radiusBase: '0.5rem',
      containerWidth: 'medium',
    },
    dark: {
      colorPrimary: '#c2410c',
      colorPrimaryForeground: '#fff7ed',
      colorAccent: '#84cc16',
      colorBackground: '#1a120a',
      colorForeground: '#efe3d5',
      colorMuted: '#241910',
      colorBorder: '#382616',
      fontHeading: 'Fraunces',
      fontBody: 'Inter',
      radiusBase: '0.5rem',
      containerWidth: 'medium',
    },
  },
};
