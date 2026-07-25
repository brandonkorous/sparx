// Social — connect your accounts, write once, post everywhere, on a schedule or
// with an admin's sign-off. The free `social` module's operator surface.

import { BarChart3, CalendarDays, Inbox, Link2, Rows3, SquarePen } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';

import { SocialCalendarSurface } from '../../../surfaces/social/calendar';
import { SocialQueueSurface } from '../../../surfaces/social/queue';
import { SocialComposerSurface } from '../../../surfaces/social/composer';
import { SocialInsightsSurface } from '../../../surfaces/social/insights';
import { SocialApprovalsSurface } from '../../../surfaces/social/approvals';
import { SocialConnectionsSurface } from '../../../surfaces/social/connections';

export const SOCIAL_SURFACES: SurfaceDefinition[] = [
  /* ── The calendar (module landing) — what a social manager opens to ─────── */
  {
    key: 'social.calendar',
    title: 'Calendar',
    module: 'social',
    icon: CalendarDays,
    order: 1,
    keywords: ['calendar', 'schedule', 'month', 'plan', 'social', 'when', 'upcoming'],
    component: SocialCalendarSurface,
    createSurface: 'social.composer',
    createLabel: 'New post',
  },
  {
    key: 'social.queue',
    title: 'Posts',
    module: 'social',
    icon: Rows3,
    order: 2,
    keywords: ['social', 'posts', 'queue', 'scheduled', 'published', 'drafts', 'list'],
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

  /* ── How the posts did ─────────────────────────────────────────────────── */
  {
    key: 'social.insights',
    title: 'Insights',
    module: 'social',
    icon: BarChart3,
    order: 3,
    keywords: ['insights', 'analytics', 'performance', 'reach', 'engagement', 'stats'],
    component: SocialInsightsSurface,
  },

  /* ── Review ────────────────────────────────────────────────────────────── */
  {
    key: 'social.approvals',
    title: 'Approvals',
    module: 'social',
    icon: Inbox,
    order: 4,
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
