// The modules that are one or two surfaces each.
//
// Grouped in one file on purpose: five files of four lines apiece would be
// fragmentation, not cohesion. Each block below stands alone and lifts straight
// out into its own file the moment it grows past a handful of surfaces.

import {
  faChartColumn,
  faGauge,
  faGear,
  faInbox,
  faLink,
  faMagnifyingGlass,
  faMessages,
  faPenLine,
  faPlug,
  faSparkles,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { PerformanceSurface } from '../../../surfaces/seo/performance';
import { AuditsListSurface } from '../../../surfaces/seo/audits-list';
import { AuditDetailSurface } from '../../../surfaces/seo/audit-detail';
import { SearchConsoleSurface } from '../../../surfaces/seo/search-console';
import { ChatInboxSurface } from '../../../surfaces/chat/inbox';
import { ChatThreadSurface } from '../../../surfaces/chat/thread';
import { ChatOverviewSurface } from '../../../surfaces/chat/overview';
import { ChatSettingsSurface } from '../../../surfaces/chat/settings';
import { ChatQuickRepliesSurface } from '../../../surfaces/chat/quick-replies';
import { AiOverviewSurface } from '../../../surfaces/ai/overview';
import { AiPromptsListSurface } from '../../../surfaces/ai/prompts-list';
import { AiPromptEditorSurface } from '../../../surfaces/ai/prompt-editor';
import { AiToolPoliciesSurface } from '../../../surfaces/ai/tool-policies';

// Dropshipping used to live here as three stubs. It has since grown into a full
// module (suppliers, catalog, orders, profitability) and moved to its own
// catalog file — see ./dropship.ts. Automations did the same — a full module
// now (rules, runs, reporting) in ./automations.ts.

/* ── Search / SEO ───────────────────────────────────────────────────────── */
const SEO: SurfaceDefinition[] = [
  {
    key: 'seo.performance',
    title: 'Search performance',
    module: 'seo',
    icon: faGauge,
    order: 1,
    keywords: ['seo', 'google', 'ranking', 'traffic', 'found'],
    component: PerformanceSurface,
    // One landing per site — a second copy shows the same overview.
    singleton: true,
  },
  {
    key: 'seo.audits',
    title: 'Site checks',
    module: 'seo',
    icon: faMagnifyingGlass,
    section: 'Checks',
    order: 10,
    keywords: ['audit', 'issues', 'problems', 'fix'],
    component: AuditsListSurface,
  },
  {
    // Opened from a page row (or the overview's activity feed), never the
    // launcher: it takes an entity type + id, so a launcher entry would have
    // nothing to open. Docks beside the list it was opened from.
    key: 'seo.audits.detail',
    title: 'Page check',
    module: 'seo',
    icon: faMagnifyingGlass,
    component: AuditDetailSurface,
    listed: false,
    besideWidth: 0.45,
  },
  {
    key: 'seo.search-console',
    title: 'Search Console',
    module: 'seo',
    icon: faLink,
    section: 'Checks',
    order: 11,
    keywords: ['google', 'connect', 'verify'],
    component: SearchConsoleSurface,
    // One connection surface — a second copy shows the same state.
    singleton: true,
  },
];

/* ── Messages ───────────────────────────────────────────────────────────── */
const CHAT: SurfaceDefinition[] = [
  {
    // The module's landing — no section, so it sits at the top of the nav above
    // every group. The operator's primary job here is triage, so the inbox is
    // that first thing, not the report.
    key: 'chat.inbox',
    title: 'Inbox',
    module: 'chat',
    icon: faInbox,
    order: 1,
    keywords: ['live chat', 'conversations', 'support', 'messages'],
    component: ChatInboxSurface,
  },
  {
    // Opened from an inbox row (or the overview's activity feed), never the
    // launcher: it takes a conversation id, so a launcher entry would have
    // nothing to open. Docks BESIDE the inbox so the queue stays on screen.
    key: 'chat.inbox.thread',
    title: 'Conversation',
    module: 'chat',
    icon: faMessages,
    component: ChatThreadSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    key: 'chat.overview',
    title: 'Overview',
    module: 'chat',
    icon: faChartColumn,
    section: 'Reports',
    order: 20,
    keywords: ['analytics', 'report', 'volume', 'response time', 'ai'],
    component: ChatOverviewSurface,
    // One report per site — a second copy shows the same aggregates.
    singleton: true,
  },
  {
    key: 'chat.settings',
    title: 'Chat settings',
    module: 'chat',
    icon: faGear,
    section: 'Setup',
    order: 30,
    keywords: ['widget', 'hours', 'away message', 'greeting', 'ai', 'first responder'],
    component: ChatSettingsSurface,
    singleton: true,
  },
  {
    key: 'chat.quick-replies',
    title: 'Quick replies',
    module: 'chat',
    icon: faMessages,
    section: 'Setup',
    order: 31,
    keywords: ['canned', 'saved replies', 'snippets', 'templates'],
    component: ChatQuickRepliesSurface,
    singleton: true,
  },
];

/* ── AI ─────────────────────────────────────────────────────────────────────
 *
 * The one thing the `ai` module is: a private bridge that lets the owner's OWN
 * AI app (Claude, ChatGPT, Copilot) work with their live business data. sparx
 * runs no AI of its own.
 *
 * FLAT, ordered, unsectioned — mirroring the dashboard's `/ai` area. Three listed
 * surfaces in one list, distinct icons so they never blur in the rail:
 *
 *   • Overview (ai.overview) — the usage home: how connected apps are calling,
 *     how to connect one, and a one-line map of the two areas below.
 *   • Instructions (ai.prompts) — the voice and rules sparx follows when it
 *     writes FOR the owner using their own AI account.
 *   • Permissions (ai.tools) — what an AI app the owner has CONNECTED may look
 *     up or change.
 *
 * Connecting an app / issuing keys is NOT here — it lives in AI connections
 * (platform.settings.ai), which every surface links to.
 */
const AI: SurfaceDefinition[] = [
  {
    // The module's landing — live MCP usage, how to connect an app, and a map of
    // the two areas. No section, so it leads the nav above them.
    key: 'ai.overview',
    title: 'Overview',
    module: 'ai',
    icon: faSparkles,
    order: 1,
    keywords: ['ai', 'overview', 'mcp', 'usage', 'connect', 'claude', 'chatgpt', 'copilot'],
    component: AiOverviewSurface,
    // One usage home per site — a second copy shows the same aggregates.
    singleton: true,
  },
  {
    // The owner's own AI account writing for them — the library of instructions
    // it follows. A `+` in the nav opens the editor in its create state,
    // skipping the trip through the list.
    key: 'ai.prompts',
    title: 'Instructions',
    module: 'ai',
    icon: faPenLine,
    order: 10,
    keywords: ['prompts', 'tone', 'rules', 'instructions', 'persona', 'writing', 'voice', 'ai'],
    component: AiPromptsListSurface,
    createSurface: 'ai.prompts.edit',
    createLabel: 'New instruction',
  },
  {
    // Opened from a row in the library (or the nav's `+`), never the launcher: it
    // takes an instruction id (or `new`), so a launcher entry would have nothing
    // to open. Docks BESIDE the library so it never leaves the screen. Create and
    // edit are the same shape, so this is ONE pane in two states, not a modal.
    key: 'ai.prompts.edit',
    title: 'Instruction',
    module: 'ai',
    icon: faPenLine,
    component: AiPromptEditorSurface,
    listed: false,
    besideWidth: 0.5,
  },
  {
    // An outside AI app the owner connects, and what it may reach — the opposite
    // relationship from Instructions. A distinct icon so the two never blur.
    key: 'ai.tools',
    title: 'Permissions',
    module: 'ai',
    icon: faPlug,
    order: 20,
    keywords: ['tools', 'mcp', 'connect', 'permissions', 'access', 'security', 'apps', 'ai'],
    component: AiToolPoliciesSurface,
    // One policy screen per site — a second copy shows the same controls.
    singleton: true,
  },
];

export const SMALL_MODULE_SURFACES: SurfaceDefinition[] = [...SEO, ...CHAT, ...AI];
