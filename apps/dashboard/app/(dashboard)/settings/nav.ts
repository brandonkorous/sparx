import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Globe,
  GlobeLock,
  KeyRound,
  Layers,
  Plug,
  Settings as SettingsIcon,
  Shield,
  Users,
} from 'lucide-react';

// The settings surface, in one place. Settings is not a module (no manifest, no
// module color) but it has sub-pages, so the contextual panel borrows the
// module-sections slot to navigate them (docs/24 §5). The settings landing page
// renders the same list as a card grid. Single source → the panel and the
// landing page can never drift.
//
// `ready: false` items are destinations we've scoped but not built yet. They
// render as disabled rows in the panel and "Soon" cards on the landing page —
// the `href` is their eventual home, unused while disabled.

export interface SettingsNavItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  ready: boolean;
}

export const SETTINGS_NAV: readonly SettingsNavItem[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Store name, locale, currency, time zone.',
    icon: SettingsIcon,
    href: '/settings/general',
    ready: true,
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Invite staff, assign roles, audit access.',
    icon: Users,
    href: '/settings/team',
    ready: false,
  },
  {
    id: 'modules',
    label: 'Modules',
    description: 'Activate or deactivate platform modules for this tenant.',
    icon: Layers,
    href: '/settings/modules',
    ready: true,
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Subscription, invoices, payment method.',
    icon: CreditCard,
    href: '/settings/billing',
    ready: false,
  },
  {
    id: ‘sites’,
    label: ‘Sites’,
    description:
      ‘Manage your sites (web properties), switch which one you’re editing, and connect custom domains.’,
    icon: Globe,
    href: ‘/settings/sites’,
    ready: true,
  },
  {
    id: ‘domains’,
    label: ‘Domains’,
    description: ‘Purchase new domains, track renewals, manage WHOIS privacy and DNS settings.’,
    icon: GlobeLock,
    href: ‘/settings/domains’,
    ready: true,
  },
  {
    id: 'ai-integrations',
    label: 'AI Integrations',
    description: 'Issue scoped API keys for Claude, ChatGPT, and Copilot.',
    icon: KeyRound,
    href: '/settings/ai-integrations',
    ready: true,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Stripe, shipping carriers, accounting, ERPs.',
    icon: Plug,
    href: '/settings/integrations',
    ready: false,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'MFA, session policy, IP allowlist, audit log.',
    icon: Shield,
    href: '/settings/security',
    ready: false,
  },
] as const;
