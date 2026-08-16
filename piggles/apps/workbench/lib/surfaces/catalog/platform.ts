// The workbench itself — the surfaces that belong to no business module.
//
// Everything the dashboard scatters across a settings route, a marketplace tile
// and a rail footer lands in one module here, because from an owner's point of
// view "set up my business" is a single errand.

import {
  faBell,
  faBoxOpen,
  faClockRotateLeft,
  faCompass,
  faEarthAmericas,
  faFlask,
  faGear,
  faGlobe,
  faHandshake,
  faKey,
  faLayerGroup,
  faLinkSlash,
  faMessage,
  faMessagePlus,
  faPlug,
  faShield,
  faUser,
  faUsers,
  faWavePulse,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
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
import { LinkUnresolvedSurface } from '../../../surfaces/link-unresolved';
import { NotificationsSurface } from '../../../surfaces/notifications/notifications';
import { ModulesSurface } from '../../../surfaces/modules/modules-list';
import { IndustrySurface } from '../../../surfaces/industry/industry';
import { SampleDataSurface } from '../../../surfaces/sample-data/sample-data';
import { MigrationStartSurface } from '../../../surfaces/migration/migration-start';
import { MigrationRunSurface } from '../../../surfaces/migration/migration-run';
import { MigrationHistorySurface } from '../../../surfaces/migration/migration-history';
import { IntegrationsListSurface } from '../../../surfaces/integrations/integrations-list';
import { IntegrationDetailSurface } from '../../../surfaces/integrations/integration-detail';
import { AiConnectionsSurface } from '../../../surfaces/ai-connections/ai-connections';
import { SecuritySurface } from '../../../surfaces/security/security';
import { PartnerAccessSurface } from '../../../surfaces/partner/partner-access';

export const PLATFORM_SURFACES: SurfaceDefinition[] = [
  {
    // Sectionless like Start here and Pulse: moving in is a whole-account errand
    // someone does once, not one of the settings groups.
    key: 'platform.migrate',
    title: 'Move in',
    module: 'platform',
    icon: faBoxOpen,
    component: MigrationStartSurface,
    singleton: true,
    keywords: [
      'migrate',
      'migration',
      'import',
      'switch',
      'transfer',
      'shopify',
      'squarespace',
      'wix',
      'webflow',
      'wordpress',
      'woocommerce',
      'hubspot',
      'bigcommerce',
      'magento',
      'etsy',
      'square',
      'mailchimp',
      'klaviyo',
      'salesforce',
      'pipedrive',
      'ghost',
      'substack',
    ],
    order: 3,
  },
  {
    // Never listed: reached from the vendor picker or from a past run, always with
    // params. A bare "Migration run" row in the launcher would open an empty pane.
    key: 'platform.migrate.run',
    title: (params) =>
      typeof params.runId === 'string'
        ? 'Move in — what happened'
        : typeof params.vendor === 'string'
          ? `Move in from ${String(params.vendor)}`
          : 'Move in',
    module: 'platform',
    icon: faBoxOpen,
    component: MigrationRunSurface,
    listed: false,
  },
  {
    key: 'platform.migrate.history',
    title: 'Past moves',
    module: 'platform',
    icon: faClockRotateLeft,
    component: MigrationHistorySurface,
    singleton: true,
    listed: false,
    keywords: ['migration history', 'past imports', 'previous moves'],
  },

  // NOTE: sparx's `workbench.home` ("Start here") is deliberately NOT registered
  // in this console.
  //
  // That surface teaches window management — how to split a pane, how to tear
  // one onto a second monitor. It is the right first screen for an operator who
  // came to arrange their own workspace, and the wrong one for somebody who did
  // not choose to be in software today: a lesson in window management sits
  // between them and their work.
  //
  // Piggles has its own Home (surfaces/home.tsx, registered as `piggles.home` in
  // lib/surfaces/piggles-catalog.ts) which answers the question people actually
  // arrive with — what needs me today. Two screens both called Home would be one
  // too many, so this one simply does not exist here.
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
    icon: faWavePulse,
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
    icon: faMessagePlus,
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
    // has an address (`/feedback/:id`), which is how the reply email lands
    // someone straight on the right thread.
    key: 'platform.feedback.thread',
    title: 'Feedback',
    module: 'platform',
    icon: faMessage,
    component: FeedbackThreadSurface,
    listed: false,
  },
  {
    // Where a link that cannot be honoured lands — a typo, a module this account
    // does not have, a business this person cannot open. A PANE rather than an
    // error page, so somebody following a broken link from a chat message keeps
    // their layout and closes one tab. Unlisted: nobody goes looking for it.
    key: 'platform.link.unresolved',
    title: 'Link',
    module: 'platform',
    icon: faLinkSlash,
    component: LinkUnresolvedSurface,
    listed: false,
  },

  /* ── Your business ─────────────────────────────────────────────────────── */
  {
    key: 'platform.settings.general',
    title: 'Business details',
    module: 'platform',
    icon: faGear,
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
    icon: faUsers,
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
    icon: faUser,
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
    icon: faGlobe,
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
    icon: faGlobe,
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
    icon: faEarthAmericas,
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
    icon: faEarthAmericas,
    component: DomainDetailSurface,
    listed: false,
    // Not a singleton: setting up a new address while looking at the working one
    // is exactly what someone does when moving a site to a new domain.
    keywords: ['domain', 'dns', 'verify', 'connect'],
  },
  {
    key: 'platform.settings.notifications',
    title: 'Notifications',
    module: 'platform',
    icon: faBell,
    component: NotificationsSurface,
    section: 'Your business',
    // One preferences record per account — a second copy is two editors racing
    // to save the same settings.
    singleton: true,
    order: 14,
    keywords: ['alerts', 'emails', 'digest'],
  },

  /* ── What sparx does ───────────────────────────────────────────────────── */
  {
    key: 'platform.settings.modules',
    title: 'Modules',
    module: 'platform',
    icon: faLayerGroup,
    component: ModulesSurface,
    section: 'What sparx does',
    // One list of everything switched on — a second copy shows the same state.
    singleton: true,
    order: 20,
    keywords: ['features', 'turn on', 'activate', 'plan', 'add'],
  },
  {
    key: 'platform.settings.industry',
    title: 'Industry',
    module: 'platform',
    icon: faCompass,
    component: IndustrySurface,
    section: 'What sparx does',
    // One line of work per business — a second copy is the same choice twice.
    singleton: true,
    order: 21,
    keywords: ['vertical', 'trade', 'preset'],
  },
  {
    key: 'platform.settings.sample-data',
    title: 'Sample data',
    module: 'platform',
    icon: faFlask,
    component: SampleDataSurface,
    section: 'What sparx does',
    // Account-wide status — a second copy shows the same counts and state.
    singleton: true,
    order: 22,
    keywords: ['demo', 'test', 'example', 'seed'],
  },
  /* ── Connections & access ──────────────────────────────────────────────── */
  {
    key: 'platform.settings.integrations',
    title: 'Integrations',
    module: 'platform',
    icon: faPlug,
    component: IntegrationsListSurface,
    section: 'Connections & access',
    // One list of every connected service — a second copy is the same list.
    singleton: true,
    order: 30,
    keywords: ['connect', 'apps', 'accounting', 'shipping', 'sync', 'payments', 'tax', 'carrier'],
  },
  {
    // Unlisted: reached by opening a service from the list, or by Connect. Takes
    // a {slug} to connect or an {id} to manage, so a launcher entry would have
    // nothing to open.
    key: 'platform.settings.integration',
    title: 'Connection',
    module: 'platform',
    icon: faPlug,
    component: IntegrationDetailSurface,
    listed: false,
    keywords: ['connect', 'integration', 'provider'],
  },
  {
    key: 'platform.settings.ai',
    title: 'AI connections',
    module: 'platform',
    icon: faKey,
    component: AiConnectionsSurface,
    section: 'Connections & access',
    // One set of AI credentials per account — a second copy shows the same keys.
    singleton: true,
    order: 31,
    keywords: ['openai', 'anthropic', 'api key', 'byok', 'mcp', 'claude', 'ai account'],
  },
  {
    key: 'platform.settings.partner',
    title: 'Partner access',
    module: 'platform',
    icon: faHandshake,
    component: PartnerAccessSurface,
    section: 'Connections & access',
    // One roster of who can reach the account — a second copy is the same list.
    singleton: true,
    order: 32,
    keywords: ['agency', 'consultant', 'delegate'],
  },
  {
    key: 'platform.settings.security',
    title: 'Security',
    module: 'platform',
    icon: faShield,
    component: SecuritySurface,
    section: 'Connections & access',
    // One account's sign-in state — a second copy shows the same sessions.
    singleton: true,
    order: 33,
    keywords: ['password', 'sessions', 'audit', 'login', '2fa'],
  },
];
