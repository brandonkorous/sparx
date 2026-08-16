// Social — connect your accounts, write once, post everywhere, on a schedule or
// with an admin's sign-off. The free `social` module's operator surface.

import {
  faCalendarClock,
  faCalendarDays,
  faChartColumn,
  faInbox,
  faLink,
  faMessages,
  faPenSquare,
  faRows3,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';

import { SocialCalendarSurface } from '../../../surfaces/social/calendar';
import { SocialQueueSurface } from '../../../surfaces/social/queue';
import { SocialComposerSurface } from '../../../surfaces/social/composer';
import { SocialInsightsSurface } from '../../../surfaces/social/insights';
import { SocialApprovalsSurface } from '../../../surfaces/social/approvals';
import { SocialConnectionsSurface } from '../../../surfaces/social/connections';
import { SocialInboxSurface } from '../../../surfaces/social/inbox';
import { SocialCadenceSurface } from '../../../surfaces/social/cadence';

export const SOCIAL_SURFACES: SurfaceDefinition[] = [
  /* ── The calendar (module landing) — what a social manager opens to ─────── */
  {
    key: 'social.calendar',
    title: 'Calendar',
    module: 'social',
    icon: faCalendarDays,
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
    icon: faRows3,
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
    icon: faPenSquare,
    component: SocialComposerSurface,
    listed: false,
    besideWidth: 0.5,
  },

  /* ── How the posts did ─────────────────────────────────────────────────── */
  {
    key: 'social.insights',
    title: 'Insights',
    module: 'social',
    icon: faChartColumn,
    order: 3,
    keywords: ['insights', 'analytics', 'performance', 'reach', 'engagement', 'stats'],
    component: SocialInsightsSurface,
  },

  /* ── Conversations ─────────────────────────────────────────────────────── */
  {
    key: 'social.inbox',
    title: 'Inbox',
    module: 'social',
    icon: faMessages,
    order: 4,
    keywords: ['comments', 'replies', 'reviews', 'messages', 'mentions', 'engagement', 'answer'],
    component: SocialInboxSurface,
    // Its badge comes from the shared attention counts, like every other
    // waiting number — see COUNT_SURFACE in lib/console/home-data.ts. It used to
    // be a `useBadgeCount` hook here, which badged this row and nothing above
    // it, so the rail could show nothing while this panel showed four.
  },

  /* ── Review ────────────────────────────────────────────────────────────── */
  {
    key: 'social.approvals',
    title: 'Approvals',
    module: 'social',
    icon: faInbox,
    order: 5,
    keywords: ['approve', 'review', 'pending', 'inbox', 'sign off'],
    component: SocialApprovalsSurface,
    // Posts parked by a teammate or an automation. Counted centrally with the
    // rest, so it rolls up to Get Found and its group.
  },

  /* ── Setup ─────────────────────────────────────────────────────────────── */
  {
    key: 'social.cadence',
    title: 'Cadence',
    module: 'social',
    icon: faCalendarClock,
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
    icon: faLink,
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
