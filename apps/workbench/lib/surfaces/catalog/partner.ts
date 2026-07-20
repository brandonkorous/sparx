// Partners — for agencies and consultants who bring clients onto sparx.
//
// Only ever visible to a tenant that has joined the partner programme; the rail
// gates the whole module the same way it gates every other one.

import { Award, BookOpen, Building2, Coins, GraduationCap, Share2, UserRound } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const PARTNER_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'partner.referrals.list',
    title: 'Referrals',
    module: 'partner',
    icon: Share2,
    order: 1,
    keywords: ['leads', 'introductions', 'sign ups'],
    body: 'Businesses you have sent to sparx, and how far each one has got.',
  }),

  /* ── Your clients ──────────────────────────────────────────────────────── */
  stub({
    key: 'partner.clients.list',
    title: 'Clients',
    module: 'partner',
    icon: Building2,
    section: 'Your clients',
    order: 10,
    keywords: ['accounts', 'managed', 'customers'],
    body: 'The sparx accounts you look after, and the access each one has given you.',
  }),
  stub({
    key: 'partner.commissions.list',
    title: 'Commissions',
    module: 'partner',
    icon: Coins,
    section: 'Your clients',
    order: 11,
    keywords: ['earnings', 'revenue share', 'payouts'],
    body: 'What you have earned from the accounts you brought in, and when it gets paid.',
  }),

  /* ── The programme ─────────────────────────────────────────────────────── */
  stub({
    key: 'partner.tier',
    title: 'Your tier',
    module: 'partner',
    icon: Award,
    section: 'The programme',
    order: 20,
    keywords: ['level', 'status', 'benefits'],
    body: 'Which level of the partner programme you are on and what it takes to reach the next one.',
  }),
  stub({
    key: 'partner.bootcamps',
    title: 'Bootcamps',
    module: 'partner',
    icon: GraduationCap,
    section: 'The programme',
    order: 21,
    keywords: ['training', 'courses', 'certification', 'learn'],
    body: 'Training sessions that get your team up to speed on sparx.',
  }),
  stub({
    key: 'partner.resources',
    title: 'Resources',
    module: 'partner',
    icon: BookOpen,
    section: 'The programme',
    order: 22,
    keywords: ['materials', 'guides', 'assets', 'sales'],
    body: 'Guides, slides, and material you can use when pitching sparx to a client.',
  }),
  stub({
    key: 'partner.profile',
    title: 'Your listing',
    module: 'partner',
    icon: UserRound,
    section: 'The programme',
    order: 23,
    keywords: ['profile', 'directory', 'public'],
    body: 'How your agency appears in the sparx partner directory, where businesses go looking for help.',
  }),
];
