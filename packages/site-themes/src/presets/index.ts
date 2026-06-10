import type { ThemeKey, ThemePreset } from '../types';
import { apex } from './apex';
import { industrial } from './industrial';
import { drift } from './drift';
import { market } from './market';
import { fleet } from './fleet';
import { drop } from './drop';
import { noir } from './noir';
import { sage } from './sage';
import { coast } from './coast';
import { ember } from './ember';
import { mono } from './mono';
import { bloom } from './bloom';
import { meridian } from './meridian';
import { terra } from './terra';
import { pulse } from './pulse';
import { linen } from './linen';

export const THEMES: Record<ThemeKey, ThemePreset> = {
  apex,
  industrial,
  drift,
  market,
  fleet,
  drop,
  noir,
  sage,
  coast,
  ember,
  mono,
  bloom,
  meridian,
  terra,
  pulse,
  linen,
};

// Stable display order for the theme gallery — the original six, then the
// marketplace catalog themes (docs/60).
export const THEME_LIST: ThemePreset[] = [
  apex,
  industrial,
  drift,
  market,
  fleet,
  drop,
  noir,
  sage,
  coast,
  ember,
  mono,
  bloom,
  meridian,
  terra,
  pulse,
  linen,
];

export const DEFAULT_THEME_KEY: ThemeKey = 'apex';

export {
  apex,
  industrial,
  drift,
  market,
  fleet,
  drop,
  noir,
  sage,
  coast,
  ember,
  mono,
  bloom,
  meridian,
  terra,
  pulse,
  linen,
};

// Token Model v2 preset defaults (docs/33-token-model-v2.md). Lives alongside
// the v1 tokenDefaults until the read path cuts over in §3.
export { THEME_DEFAULTS_V2, THEME_KEYS_V2, DEFAULT_THEME_KEY_V2, getThemePresetV2 } from './v2';
