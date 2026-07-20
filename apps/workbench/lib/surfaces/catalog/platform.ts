// The workbench itself — the surfaces that belong to no business module.
//
// Everything the dashboard scatters across a settings route, a marketplace tile
// and a rail footer lands in one module here, because from an owner's point of
// view "set up my business" is a single errand.

import {
  Activity,
  Bell,
  Compass,
  FlaskConical,
  Globe,
  GlobeLock,
  Handshake,
  Home,
  KeyRound,
  Layers,
  MessageSquare,
  MessageSquarePlus,
  Plug,
  Settings,
  Shield,
  Store,
  UserRound,
  Users,
} from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { HomeSurface } from '../../../surfaces/home';
import { PulseSurface } from '../../../surfaces/pulse';
import { BusinessDetailsSurface } from '../../../surfaces/business-details';
import { SitesListSurface } from '../../../surfaces/sites/sites-list';
import { SiteDetailSurface } from '../../../surfaces/sites/site-detail';
import { DomainsListSurface } from '../../../surfaces/domains/domains-list';
import { DomainDetailSurface } from '../../../surfaces/domains/domain-detail';
import { TeamSurface } from '../../../surfaces/team';
import { TeamMemberSurface } from '../../../surfaces/team/member';
import { FeedbackListSurface } from '../../../surfaces/feedback/feedback-list';
import { FeedbackThreadSurface } from '../../../surfaces/feedback/feedback-thread';
import { stub } from './stub';

export const PLATFORM_SURFACES: SurfaceDefinition[] = [
  {
    key: 'workbench.home',
    title: 'Start here',
    module: 'platform',
    icon: Home,
    component: HomeSurface,
    singleton: true,
    keywords: ['help', 'getting started', 'welcome'],
    order: 1,
  },
  {
    // Sectionless on purpose: like Start here, this is a landing surface for the
    // whole account, not one of the settings groups below it.
    //
    // Registered under its FINAL key while it only carries background jobs — it
    // grows to hold the activity feed (Phase 2) and notifications (Phase 3) as
    // sections. Keys are persisted in saved layouts, so the pane has to be born
    // with the name it will keep. See docs/124.
    key: 'platform.pulse',
    title: 'Pulse',
    module: 'platform',
    icon: Activity,
    component: PulseSurface,
    // A second copy of a live feed shows the same thing twice.
    singleton: true,
    keywords: ['activity', 'jobs', 'running', 'imports', 'background', 'history', 'progress'],
    order: 2,
  },

  {
    // Sectionless, like Start here and Pulse above it: this is a landing
    // surface for the whole account, not one of the settings groups below.
    //
    // Listed, so it shows in the launcher and the platform nav panel like any
    // other screen. Feedback is not a modal bolted onto the chrome here — the
    // conversation is a place you can go, keep open beside your work, and come
    // back to.
    key: 'platform.feedback.list',
    title: 'Your feedback',
    module: 'platform',
    icon: MessageSquarePlus,
    component: FeedbackListSurface,
    // Two copies of your own message list show the same thing twice.
    singleton: true,
    keywords: [
      'feedback',
      'support',
      'help',
      'bug',
      'problem',
      'idea',
      'suggestion',
      'contact',
      'replies',
    ],
    order: 3,
  },
  {
    // Deliberately NOT listed: you reach a conversation through the list or a
    // notification, never by searching for it — and an unlisted surface still
    // opens from a `?open=` deep link, which is how the reply email lands
    // someone straight on the right thread.
    key: 'platform.feedback.thread',
    title: 'Feedback',
    module: 'platform',
    icon: MessageSquare,
    component: FeedbackThreadSurface,
    listed: false,
  },

  /* ── Your business ─────────────────────────────────────────────────────── */
  {
    key: 'platform.settings.general',
    title: 'Business details',
    module: 'platform',
    icon: Settings,
    component: BusinessDetailsSurface,
    section: 'Your business',
    // One business per account — a second copy of this pane would be two
    // editors racing to save the same record.
    singleton: true,
    order: 10,
    keywords: [
      'general',
      'settings',
      'name',
      'address',
      'tax',
      'vat',
      'company',
      'organization',
      'legal',
      'ein',
    ],
  },
  {
    key: 'platform.settings.team',
    title: 'Team',
    module: 'platform',
    icon: Users,
    component: TeamSurface,
    section: 'Your business',
    // One roster. A second copy of the same list would show the same people,
    // and every action on it is already reflected in the first.
    singleton: true,
    order: 11,
    keywords: ['staff', 'users', 'invite', 'permissions', 'roles'],
  },
  {
    // Opened from the roster, never from the launcher — hence `listed: false`.
    // A teammate pane with no teammate chosen has nothing to show, so it must
    // not be something you can reach without picking a person first.
    key: 'platform.settings.team.member',
    // The generic title holds only until the pane learns the person's name and
    // calls ctx.setTitle — which is why it reads as a description of the pane
    // rather than a placeholder like "Member".
    title: 'Teammate',
    module: 'platform',
    icon: UserRound,
    component: TeamMemberSurface,
    listed: false,
    // Emphatically NOT a singleton: comparing what two people can reach, side
    // by side, is one of the things this app exists to make possible.
    singleton: false,
  },
  {
    key: 'platform.settings.sites',
    title: 'Sites',
    module: 'platform',
    icon: Globe,
    component: SitesListSurface,
    section: 'Your business',
    // One list of every site — a second copy would just be the same list twice.
    singleton: true,
    order: 12,
    keywords: ['websites', 'properties', 'brands', 'domain', 'new site', 'switch'],
  },
  {
    // Unlisted: reached by opening a site from the list, or by the New button.
    // It takes an `id`, so a launcher entry would have nothing to open.
    key: 'platform.settings.site',
    title: 'Site',
    module: 'platform',
    icon: Globe,
    component: SiteDetailSurface,
    listed: false,
    // Deliberately NOT a singleton: comparing two sites side by side is the
    // whole point of a dock.
    keywords: ['site', 'website', 'rename', 'primary'],
  },
  {
    key: 'platform.settings.domains',
    title: 'Domains',
    module: 'platform',
    icon: GlobeLock,
    component: DomainsListSurface,
    section: 'Your business',
    // One list of every address on the account — a second copy is the same list.
    singleton: true,
    order: 13,
    keywords: ['dns', 'url', 'ssl', 'https', 'web address', 'domain', 'connect'],
  },
  {
    // Unlisted: reached by opening an address from the list, or by Connect.
    // It takes an `id`, so a launcher entry would have nothing to open.
    key: 'platform.settings.domain',
    title: 'Web address',
    module: 'platform',
    icon: GlobeLock,
    component: DomainDetailSurface,
    listed: false,
    // Not a singleton: setting up a new address while looking at the working one
    // is exactly what someone does when moving a site to a new domain.
    keywords: ['domain', 'dns', 'verify', 'connect'],
  },
  stub({
    key: 'platform.settings.notifications',
    title: 'Notifications',
    module: 'platform',
    icon: Bell,
    section: 'Your business',
    order: 14,
    keywords: ['alerts', 'emails', 'digest'],
    body: 'Choose what sparx tells you about, and whether it reaches you by email or only here.',
  }),

  /* ── What sparx does ───────────────────────────────────────────────────── */
  stub({
    key: 'platform.settings.modules',
    title: 'Modules',
    module: 'platform',
    icon: Layers,
    section: 'What sparx does',
    order: 20,
    keywords: ['features', 'turn on', 'activate', 'plan', 'add'],
    body: 'Modules are the parts of sparx you have switched on. Turn one on and it appears in the rail; turn it off and it stops entirely.',
  }),
  stub({
    key: 'platform.settings.industry',
    title: 'Industry',
    module: 'platform',
    icon: Compass,
    section: 'What sparx does',
    order: 21,
    keywords: ['vertical', 'trade', 'preset'],
    body: 'Telling sparx what line of work you are in changes the wording and the starting setup to match it.',
  }),
  stub({
    key: 'platform.settings.sample-data',
    title: 'Sample data',
    module: 'platform',
    icon: FlaskConical,
    section: 'What sparx does',
    order: 22,
    keywords: ['demo', 'test', 'example', 'seed'],
    body: 'Fills your account with realistic made-up records so you can try things out before your real ones exist — and removes them again on request.',
  }),
  stub({
    key: 'platform.marketplace',
    title: 'Marketplace',
    module: 'platform',
    icon: Store,
    section: 'What sparx does',
    order: 23,
    keywords: ['apps', 'add-ons', 'extensions', 'install'],
    body: 'Extra tools built for sparx that you can add to your account.',
  }),

  /* ── Connections & access ──────────────────────────────────────────────── */
  stub({
    key: 'platform.settings.integrations',
    title: 'Integrations',
    module: 'platform',
    icon: Plug,
    section: 'Connections & access',
    order: 30,
    keywords: ['connect', 'apps', 'accounting', 'shipping', 'sync'],
    body: 'Connections to the other services you already use, so information moves between them and sparx on its own.',
  }),
  stub({
    key: 'platform.settings.ai',
    title: 'AI connections',
    module: 'platform',
    icon: KeyRound,
    section: 'Connections & access',
    order: 31,
    keywords: ['openai', 'anthropic', 'api key', 'byok', 'mcp'],
    body: 'sparx never uses AI on your behalf without your own account. This is where you add the AI service you pay for, so the AI features can use it.',
  }),
  stub({
    key: 'platform.settings.partner',
    title: 'Partner access',
    module: 'platform',
    icon: Handshake,
    section: 'Connections & access',
    order: 32,
    keywords: ['agency', 'consultant', 'delegate'],
    body: 'Lets an agency or consultant you trust work inside your account, with access you can withdraw at any time.',
  }),
  stub({
    key: 'platform.settings.security',
    title: 'Security',
    module: 'platform',
    icon: Shield,
    section: 'Connections & access',
    order: 33,
    keywords: ['password', 'sessions', 'audit', 'login', '2fa'],
    body: 'Sign-in rules, the devices currently signed in, and a record of who did what.',
  }),
];
