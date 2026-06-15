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
  // Automations + SEO are platform surfaces (always-on, not separately billed),
  // but they own a brand color so their overview pages read in-module. They are
  // intentionally NOT in moduleManifests — they get no gated sidebar slot.
  | 'automations'
  | 'seo'
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
  automations: { color: '#D946EF', tint: '#FDF4FF', text: '#A21CAF', content: WHITE },
  // SEO yellow is bright; on-fill ink is dark for legibility.
  seo: { color: '#EAB308', tint: '#FEFCE8', text: '#854D0E', content: AMBER_INK },
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
        '--module-active': colors.color,
        '--module-active-tint': colors.tint,
        '--module-active-text': colors.text,
        '--module-active-content': colors.content,
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
