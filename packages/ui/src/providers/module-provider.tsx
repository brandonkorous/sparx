'use client';

import * as React from 'react';

export type SparxModule =
  // Legacy Site Builder color identity (the `/sitebuilder` dashboard surface).
  // The billable site-building module is now `builder`; `storefront` survives
  // only to color the legacy surfaces until /sitebuilder folds into /builder.
  | 'storefront'
  // The site-building module (docs/40), `/builder` — the billable foundation
  // module (themes, layouts, pages, domains). Formerly marketed as "Storefront".
  | 'builder'
  | 'commerce'
  | 'cms'
  | 'crm'
  | 'email'
  | 'b2b'
  | 'invoicing'
  | 'ai'
  | 'dropship'
  | 'inventory'
  | 'chat'
  | 'scheduling'
  // Social (docs/133) — organic posting to Facebook/Instagram/Pinterest. A real
  // independently-gated module (it owns a dashboard surface), simply priced at $0.
  | 'social'
  // Automations, SEO + Finance are platform surfaces (always-on, not separately
  // billed), but they own a brand color so their pages read in-module. They are
  // intentionally NOT in moduleManifests — they get no gated sidebar slot.
  | 'automations'
  | 'seo'
  // Finance (docs/109) is the money hub — a peer of Settings, but it owns a hue
  // so its surfaces pop AND a finance signal embedded in another module (e.g. the
  // Payouts card on the Commerce overview) reads as finance, not that module.
  | 'finance'
  // Partner Portal (docs/114 §B.7) — a first-class platform area (the Finance
  // pattern), NOT a module: no manifest, no billing. It owns a violet hue so the
  // whole portal + any partner signal (a referral badge, a commission tile) reads
  // as "partner" wherever it surfaces.
  | 'partner'
  | 'platform';

interface ModuleColors {
  color: string;
  tint: string;
  /** Dark ink for text on the light `tint` (--module-active-text). */
  text: string;
  /** Text/icon shown on the SOLID `color` fill (--module-active-content).
   *  White for most hues; dark for amber/yellow modules where white fails AA. */
  content: string;
}

const WHITE = '#ffffff';
// Dark ink reused on amber/yellow fills (matches --color-warning-content).
const AMBER_INK = '#422006';

const MODULE_COLORS: Record<SparxModule, ModuleColors> = {
  storefront: { color: '#6366F1', tint: '#EEF2FF', text: '#4338CA', content: WHITE },
  // Builder shares the site-building indigo lineage (Site Builder's successor).
  builder: { color: '#6366F1', tint: '#EEF2FF', text: '#4338CA', content: WHITE },
  commerce: { color: '#F97316', tint: '#FFF7ED', text: '#C2410C', content: WHITE },
  cms: { color: '#14B8A6', tint: '#F0FDFA', text: '#0F766E', content: WHITE },
  crm: { color: '#06B6D4', tint: '#ECFEFF', text: '#0E7490', content: WHITE },
  email: { color: '#0EA5E9', tint: '#F0F9FF', text: '#0369A1', content: WHITE },
  b2b: { color: '#475569', tint: '#F1F5F9', text: '#334155', content: WHITE },
  invoicing: { color: '#65A30D', tint: '#F7FEE7', text: '#3F6212', content: WHITE },
  ai: { color: '#EC4899', tint: '#FDF2F8', text: '#9D174D', content: WHITE },
  dropship: { color: '#10B981', tint: '#ECFDF5', text: '#065F46', content: WHITE },
  // Inventory amber == --color-warning hue; white text fails AA, so on-fill ink
  // is dark. Status colors inside Inventory use danger/red to stay legible.
  inventory: { color: '#F59E0B', tint: '#FFFBEB', text: '#B45309', content: AMBER_INK },
  chat: { color: '#8B5CF6', tint: '#F5F3FF', text: '#6D28D9', content: WHITE },
  // Scheduling rose — distinct from AI's magenta-pink and Commerce's orange,
  // claiming the open red/rose slot on the module hue wheel.
  scheduling: { color: '#F43F5E', tint: '#FFF1F2', text: '#BE123C', content: WHITE },
  // Social blue — blue-600, the social-network blue; distinct from Email's sky
  // (#0EA5E9) and Builder's indigo (#6366F1). White ink passes AA on the fill.
  social: { color: '#2563EB', tint: '#EFF6FF', text: '#1D4ED8', content: WHITE },
  automations: { color: '#D946EF', tint: '#FDF4FF', text: '#A21CAF', content: WHITE },
  // SEO yellow is bright; on-fill ink is dark for legibility.
  seo: { color: '#EAB308', tint: '#FEFCE8', text: '#854D0E', content: AMBER_INK },
  // Finance "money green" — green-600, a deeper shade than the emerald success
  // token (#10B981) so finance chrome stays distinct from positive-state badges.
  finance: { color: '#16A34A', tint: '#F0FDF4', text: '#15803D', content: WHITE },
  // Partner violet — violet-600, one notch deeper than Chat's violet-500 (#8B5CF6)
  // so the partner chrome reads as its own program hue, distinct from the module.
  partner: { color: '#7C3AED', tint: '#F5F3FF', text: '#6D28D9', content: WHITE },
  platform: { color: '#6366F1', tint: '#EEF2FF', text: '#4338CA', content: WHITE },
};

const ModuleContext = React.createContext<SparxModule>('platform');

interface ModuleProviderProps {
  module: SparxModule;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ModuleProvider({ module, children, className, style }: ModuleProviderProps) {
  const colors = MODULE_COLORS[module];

  const cssVars = React.useMemo(
    () =>
      ({
        // The active-module bridge. silicaui generates `.btn-module` /
        // `.badge-module` / `.bg-module` / `.text-module` / … from the registered
        // `module` color (see each app's globals.css @plugin colors list),
        // reading this pair — so every `color="module"` component and the
        // `bg-module bg-soft` tint resolve to the wrapping module's hue through
        // silica's standard color machinery. The soft tint + module ink are
        // derived by silicaui from this one color (no hand-picked per-theme tint
        // tokens anymore) and adapt to dark mode automatically. Outside any
        // provider, `--color-module` falls back to the brand default (= primary)
        // in @sparx/brand/theme.css.
        '--color-module': colors.color,
        '--color-module-content': colors.content,
      }) as React.CSSProperties,
    [colors]
  );

  return (
    <ModuleContext.Provider value={module}>
      <div style={{ ...cssVars, ...style }} className={className} data-module={module}>
        {children}
      </div>
    </ModuleContext.Provider>
  );
}

export function useModule(): SparxModule {
  return React.useContext(ModuleContext);
}
