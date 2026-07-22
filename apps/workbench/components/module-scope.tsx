// Repoints the active-module hue for a subtree.
//
// The component renders NOTHING but a data attribute. The actual mapping —
// `data-module="x"` ⇒ `--color-module: var(--color-module-x)` — lives in
// @sparx/brand/theme.css next to the tokens themselves, so styling stays
// entirely in CSS. No inline `style` (banned: it bypasses the token system),
// no JS color table that can drift from brand.
//
// Two consequences worth knowing:
//   • CSS vars cascade by DOM, not by React tree. A pane rendered through a
//     portal into another window's document does NOT inherit a provider from the
//     React tree above it — every pane therefore carries its own ModuleScope in
//     its own DOM subtree. See lib/dock/pane-host.tsx.
//   • Nesting is legitimate and expected (docs/23 Color-Follows-Functionality):
//     a pane showing another module's data wears THAT module's hue — the
//     cascade resolves the nearest data-module above it.

import type { ReactNode } from 'react';

/** Every module identity carried in @sparx/brand/theme.css. */
export const WORKBENCH_MODULES = [
  'storefront',
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'invoicing',
  'ai',
  'dropship',
  'inventory',
  'chat',
  'scheduling',
  'automations',
  'seo',
  'finance',
  'partner',
  'platform',
] as const;

export type WorkbenchModule = (typeof WORKBENCH_MODULES)[number];

interface ModuleScopeProps {
  module: WorkbenchModule;
  children: ReactNode;
  className?: string;
}

export function ModuleScope({ module, children, className }: ModuleScopeProps) {
  return (
    <div data-module={module} className={className}>
      {children}
    </div>
  );
}
