// Mono — strict monochrome. Black, white, and grey with zero radius; lets the
// content and imagery do all the talking. For agencies, portfolios, and photography.

import type { ThemePreset } from '../types';
import { DEFAULT_SECTION_TYPES, DEFAULT_SETTINGS_SCHEMA } from './_schema';

export const mono: ThemePreset = {
  key: 'mono',
  name: 'Mono',
  category: 'fashion',
  description: 'Strict monochrome — black, white, and grey with square edges.',
  version: '1.0.0',
  recommendedFor: ['fashion'],
  settingsSchema: DEFAULT_SETTINGS_SCHEMA,
  sectionTypes: DEFAULT_SECTION_TYPES,
  tokenDefaults: {
    light: {
      colorPrimary: '#111111',
      colorPrimaryForeground: '#ffffff',
      colorAccent: '#111111',
      colorBackground: '#ffffff',
      colorForeground: '#111111',
      colorMuted: '#f4f4f5',
      colorBorder: '#e4e4e7',
      fontHeading: 'Archivo',
      fontBody: 'Inter',
      radiusBase: '0px',
      containerWidth: 'wide',
    },
    dark: {
      colorPrimary: '#fafafa',
      colorPrimaryForeground: '#111111',
      colorAccent: '#fafafa',
      colorBackground: '#0a0a0a',
      colorForeground: '#fafafa',
      colorMuted: '#161616',
      colorBorder: '#262626',
      fontHeading: 'Archivo',
      fontBody: 'Inter',
      radiusBase: '0px',
      containerWidth: 'wide',
    },
  },
};
