import type { LucideIcon } from 'lucide-react';
import { Award, BookOpen, Building2, Coins, GraduationCap, Share2, UserRound } from 'lucide-react';

// The Partner Portal surface, in one place (docs/114 §B.7). The Partner Portal is
// a first-class platform AREA — a peer of Finance/Settings, NOT a module (no
// manifest, no billing; docs/114 D8). So the contextual panel borrows the section
// slot to navigate it, exactly like Finance, and this is the single source both
// the desktop panel and the mobile drawer read from — they can never drift.
//
// `memberOnly` marks the sections that only make sense once the tenant has joined
// the program (referrals, commissions, the directory profile, bootcamp hosting).
// A prospective partner sees the always-visible entries — Overview (which carries
// the join screen), Tier (what the program offers), and Resources — and unlocks
// the rest the moment they join. The panel + drawer render the reduced set from
// this field, so a non-partner never lands on a section that only says "join."

export interface PartnerNavItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  /** Hidden from the nav until the tenant is a partner (has a `partners` row). */
  memberOnly: boolean;
}

export const PARTNER_NAV: readonly PartnerNavItem[] = [
  {
    id: 'referrals',
    label: 'Referrals',
    description: 'Your referral link and the accounts that signed up under it.',
    icon: Share2,
    href: '/partner/referrals',
    memberOnly: true,
  },
  {
    id: 'clients',
    label: 'Clients',
    description: 'Accounts you referred or actively manage as a consultant.',
    icon: Building2,
    href: '/partner/clients',
    memberOnly: true,
  },
  {
    id: 'commissions',
    label: 'Commissions',
    description: 'Earnings, payout history, and your Connect payout account.',
    icon: Coins,
    href: '/partner/commissions',
    memberOnly: true,
  },
  {
    id: 'bootcamps',
    label: 'Bootcamps',
    description: 'Host training cohorts and capture graduates as leads.',
    icon: GraduationCap,
    href: '/partner/bootcamps',
    memberOnly: true,
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'Your public directory listing on sparx.works/partners.',
    icon: UserRound,
    href: '/partner/profile',
    memberOnly: true,
  },
  {
    id: 'resources',
    label: 'Resources',
    description: 'Pitch deck, proposal templates, onboarding guides, and the referral kit.',
    icon: BookOpen,
    href: '/partner/resources',
    memberOnly: false,
  },
  {
    id: 'tier',
    label: 'Tier',
    description: 'Where you are today and what the next tier unlocks.',
    icon: Award,
    href: '/partner/tier',
    memberOnly: false,
  },
] as const;
