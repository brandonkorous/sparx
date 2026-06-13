// Dashboard shell manifest for the Email module.
//
// Imported by the dashboard via `@sparx/email-platform/manifest` (mirrors
// `@sparx/crm/manifest`). Keep this file dependency-light: types from
// @sparx/ui/shell, icons from lucide-react, nothing else.

import type { ModuleManifest } from '@sparx/ui/shell';
import { Globe, LayoutTemplate, Send, Settings, ShieldOff } from 'lucide-react';

export const emailManifest: ModuleManifest = {
  id: 'email',
  label: 'Email',
  icon: Send,
  routePrefix: '/email',
  // The contextual panel auto-injects an "Overview" row → `routePrefix`
  // (module-section-nav.tsx); sections list only the sub-surfaces.
  sections: [
    { id: 'broadcasts', label: 'Broadcasts', icon: Send, href: '/email/broadcasts' },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate, href: '/email/templates' },
    { id: 'suppressions', label: 'Suppressions', icon: ShieldOff, href: '/email/suppressions' },
    { id: 'domains', label: 'Sending domains', icon: Globe, href: '/email/domains' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/email/settings' },
  ],
  actions: [
    {
      id: 'email.broadcast.create',
      label: 'New broadcast',
      icon: Send,
      href: '/email/broadcasts/new',
    },
    // Marketing emails are designed in the Email Builder (docs/52); built-in
    // transactional templates are customized in place, never created.
    {
      id: 'email.design',
      label: 'Design email',
      icon: LayoutTemplate,
      href: '/builder/email',
    },
  ],
  entityTypes: [
    { id: 'broadcast', label: 'Broadcast', routePrefix: '/email/broadcasts', hasDetailView: true },
    { id: 'sending-domain', label: 'Sending domain', routePrefix: '/email/domains' },
  ],
};
