// Social — connect your accounts, write once, post everywhere, on a schedule or
// with an admin's sign-off. The free `social` module's operator surface.

import { Inbox, Link2, Send, SquarePen } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';

import { SocialQueueSurface } from '../../../surfaces/social/queue';
import { SocialComposerSurface } from '../../../surfaces/social/composer';
import { SocialApprovalsSurface } from '../../../surfaces/social/approvals';
import { SocialConnectionsSurface } from '../../../surfaces/social/connections';

export const SOCIAL_SURFACES: SurfaceDefinition[] = [
  /* ── The working list (module landing) ─────────────────────────────────── */
  {
    key: 'social.queue',
    title: 'Posts',
    module: 'social',
    icon: Send,
    order: 1,
    keywords: ['social', 'queue', 'scheduled', 'published', 'drafts', 'calendar'],
    component: SocialQueueSurface,
    createSurface: 'social.composer',
    createLabel: 'New post',
  },
  {
    key: 'social.composer',
    title: (params) => (params.id === 'new' ? 'New post' : 'Post'),
    module: 'social',
    icon: SquarePen,
    component: SocialComposerSurface,
    listed: false,
    besideWidth: 0.5,
  },

  /* ── Review ────────────────────────────────────────────────────────────── */
  {
    key: 'social.approvals',
    title: 'Approvals',
    module: 'social',
    icon: Inbox,
    order: 2,
    keywords: ['approve', 'review', 'pending', 'inbox', 'sign off'],
    component: SocialApprovalsSurface,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'social.connections',
    title: 'Connections',
    module: 'social',
    icon: Link2,
    section: 'Setup',
    order: 10,
    keywords: [
      'accounts',
      'connect',
      'facebook',
      'instagram',
      'linkedin',
      'google business',
      'threads',
      'approval',
    ],
    component: SocialConnectionsSurface,
  },
];
