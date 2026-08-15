// Social — connect your accounts, write once, post everywhere, on a schedule or
// with an admin's sign-off. The free `social` module's operator surface.

import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Inbox,
  Link2,
  MessagesSquare,
  Rows3,
  SquarePen,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';

import { SocialCalendarSurface } from '../../../surfaces/social/calendar';
import { SocialQueueSurface } from '../../../surfaces/social/queue';
import { SocialComposerSurface } from '../../../surfaces/social/composer';
import { SocialInsightsSurface } from '../../../surfaces/social/insights';
import { SocialApprovalsSurface } from '../../../surfaces/social/approvals';
import { SocialConnectionsSurface } from '../../../surfaces/social/connections';
import { SocialInboxSurface } from '../../../surfaces/social/inbox';
import { SocialCadenceSurface } from '../../../surfaces/social/cadence';
import { useInboxCount } from '../../../surfaces/social/inbox-data';
import { useApprovalCount } from '../../../surfaces/social/data';

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

  /* ── Conversations ─────────────────────────────────────────────────────── */
  {
    key: 'social.inbox',
    title: 'Inbox',
    module: 'social',
    icon: MessagesSquare,
    order: 4,
    keywords: ['comments', 'replies', 'reviews', 'messages', 'mentions', 'engagement', 'answer'],
    component: SocialInboxSurface,
    // The one number in this module that means someone is WAITING on a person: a
    // customer asked something and nobody has answered.
    useBadgeCount: useInboxCount,
  },

  /* ── Review ────────────────────────────────────────────────────────────── */
  {
    key: 'social.approvals',
    title: 'Approvals',
    module: 'social',
    icon: Inbox,
    order: 5,
    keywords: ['approve', 'review', 'pending', 'inbox', 'sign off'],
    component: SocialApprovalsSurface,
    // Posts parked by a teammate or an automation. Without this the inbox only worked
    // if someone thought to look in it.
    useBadgeCount: useApprovalCount,
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'social.cadence',
    title: 'Cadence',
    module: 'social',
    icon: CalendarClock,
    section: 'Setup',
    order: 9,
    keywords: [
      'cadence',
      'schedule',
      'posting times',
      'slots',
      'hashtags',
      'import',
      'csv',
      'spreadsheet',
      'evergreen',
    ],
    component: SocialCadenceSurface,
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
