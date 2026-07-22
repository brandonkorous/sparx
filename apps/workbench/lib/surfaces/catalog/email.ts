// Email — sending to your list.

import { Globe, Send, Settings, ShieldOff } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { stub } from './stub';

export const EMAIL_SURFACES: SurfaceDefinition[] = [
  stub({
    key: 'email.broadcasts.list',
    title: 'Broadcasts',
    module: 'email',
    icon: Send,
    order: 1,
    keywords: ['newsletter', 'campaign', 'send', 'blast', 'marketing'],
    body: 'One email sent to a group of people at once — a newsletter, an offer, an announcement.',
  }),

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  stub({
    key: 'email.domains.list',
    title: 'Sending addresses',
    module: 'email',
    icon: Globe,
    section: 'Setup',
    order: 10,
    keywords: ['domains', 'from address', 'dns', 'spf', 'dkim', 'verify'],
    body: 'Proving you own the address your email comes from, so it arrives in inboxes instead of spam folders.',
  }),
  stub({
    key: 'email.suppressions.list',
    title: 'Do not email',
    module: 'email',
    icon: ShieldOff,
    section: 'Setup',
    order: 11,
    keywords: ['suppressions', 'unsubscribed', 'bounced', 'complaints', 'opt out'],
    body: 'People who unsubscribed, or whose address bounced. sparx will not email them again, which keeps you out of trouble.',
  }),
  stub({
    key: 'email.settings',
    title: 'Email settings',
    module: 'email',
    icon: Settings,
    section: 'Setup',
    order: 12,
    keywords: ['reply to', 'footer', 'preferences'],
    body: 'Who replies go to, what appears at the bottom of every email, and how people manage what they receive.',
  }),
];
