// Email — sending to your list.
//
// The four operator surfaces of the email module, all consuming the existing
// api-rest `/v1/email/*` backend (broadcasts, sending domains, suppressions,
// settings). The KEYS are the deep-link + saved-layout contract, carried over
// verbatim from the stubs these replaced so no bookmark or saved workspace breaks.

import { AtSign, Send, Settings, ShieldOff } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { BroadcastsListSurface } from '../../../surfaces/email/broadcasts-list';
import { BroadcastDetailSurface } from '../../../surfaces/email/broadcast-detail';
import { SendingDomainsListSurface } from '../../../surfaces/email/domains-list';
import { SendingDomainDetailSurface } from '../../../surfaces/email/domain-detail';
import { SuppressionsListSurface } from '../../../surfaces/email/suppressions-list';
import { EmailSettingsSurface } from '../../../surfaces/email/email-settings';

export const EMAIL_SURFACES: SurfaceDefinition[] = [
  {
    // Unsectioned → leads the Email panel. Compose/manage is a separate pane.
    key: 'email.broadcasts.list',
    title: 'Broadcasts',
    module: 'email',
    icon: Send,
    order: 1,
    keywords: ['newsletter', 'campaign', 'send', 'blast', 'marketing'],
    component: BroadcastsListSurface,
    createSurface: 'email.broadcasts.detail',
    createLabel: 'New broadcast',
  },
  {
    // One pane, two states: {id:'new'} composes, {id} manages/reviews.
    key: 'email.broadcasts.detail',
    title: 'Broadcast',
    module: 'email',
    icon: Send,
    listed: false,
    keywords: ['newsletter', 'campaign', 'send', 'blast', 'marketing'],
    component: BroadcastDetailSurface,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'email.domains.list',
    title: 'Sending addresses',
    module: 'email',
    icon: AtSign,
    section: 'Setup',
    order: 10,
    keywords: ['domains', 'from address', 'dns', 'spf', 'dkim', 'verify', 'sender'],
    component: SendingDomainsListSurface,
    createSurface: 'email.domains.detail',
    createLabel: 'Add a sending address',
  },
  {
    // {id:'new'} provisions, then lands on {id} showing the DNS records to add.
    key: 'email.domains.detail',
    title: (params) => (params.id === 'new' ? 'Add a sending address' : 'Sending address'),
    module: 'email',
    icon: AtSign,
    listed: false,
    component: SendingDomainDetailSurface,
  },
  {
    key: 'email.suppressions.list',
    title: 'Do not email',
    module: 'email',
    icon: ShieldOff,
    section: 'Setup',
    order: 11,
    // Account-wide list; a second copy is the same list.
    singleton: true,
    keywords: ['suppressions', 'unsubscribed', 'bounced', 'complaints', 'opt out', 'do not email'],
    component: SuppressionsListSurface,
  },
  {
    key: 'email.settings',
    title: 'Email settings',
    module: 'email',
    icon: Settings,
    section: 'Setup',
    order: 12,
    // One settings screen per site; a second copy is meaningless.
    singleton: true,
    keywords: [
      'reply to',
      'footer',
      'sender',
      'from address',
      'mailing address',
      'can-spam',
      'physical address',
      'preferences',
    ],
    component: EmailSettingsSurface,
  },
];
