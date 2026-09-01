// Site — designing what visitors actually see.
//
// The builders lead, in the order someone works: name the site, then its Look &
// feel, the Header & footer every page wears, one Page, then Email designs. Each
// is ONE document in its own pane, so several can be open at once — a page beside
// the header it wears, or two pages side by side.
//
// The old whole-site editor is GONE — one surface that owned every document at once,
// replaced by these. Its keyword set moved onto the panes that now answer for it:
// 'header'/'footer'/'menu' land on Header & footer, 'design'/'edit site' on Page.
// Then the design assets (Blueprints · Saved pieces), and the Forms inbox.

import {
  faChartColumn,
  faClockRotateLeft,
  faCube,
  faCloudArrowUp,
  faEnvelope,
  faEye,
  faFileLines,
  faGlobe,
  faInbox,
  faSliders,
  faPalette,
  faTableLayout,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { SiteIdentitySurface } from '../../../surfaces/builder/site-identity';
import { BlueprintsListSurface } from '../../../surfaces/builder/blueprints-list';
import { BlueprintDetailSurface } from '../../../surfaces/builder/blueprint-detail';
import { SavedPiecesListSurface } from '../../../surfaces/builder/saved-pieces-list';
import { SavedPieceDetailSurface } from '../../../surfaces/builder/saved-piece-detail';
import { EmailPaneSurface } from '../../../surfaces/studio/email-pane';
import { ThemePaneSurface } from '../../../surfaces/studio/theme-pane';
import { LayoutPaneSurface } from '../../../surfaces/studio/layout-pane';
import { PagePaneSurface } from '../../../surfaces/studio/page-pane';
import { PiecePaneSurface } from '../../../surfaces/studio/piece-pane';
import { HistoryPaneSurface } from '../../../surfaces/studio/history-pane';
import { PreviewPaneSurface } from '../../../surfaces/studio/preview-pane';
import { PublishPaneSurface } from '../../../surfaces/studio/publish-pane';
import { FormSubmissionsListSurface } from '../../../surfaces/builder/form-submissions-list';
import { SubmissionDetailSurface } from '../../../surfaces/builder/submission-detail';
import { FormSettingsSurface } from '../../../surfaces/builder/form-settings';
import { FormSettingsListSurface } from '../../../surfaces/builder/form-settings-pick';
import { PageResultsSurface } from '../../../surfaces/builder/page-results';

export const BUILDER_SURFACES: SurfaceDefinition[] = [
  /* ── Lead group ───────────────────────────────────────────────────────── */
  // No section, so these sit above the divider and never fold. Identity first,
  // then widest scope down: a theme repaints every page, the chrome every page
  // wears, then one page, then one piece.
  {
    key: 'builder.site',
    title: 'Site',
    module: 'builder',
    icon: faGlobe,
    order: 1,
    keywords: ['identity', 'name', 'tagline', 'logo', 'favicon', 'social', 'brand'],
    // The active site's IDENTITY: name, tagline, logo, favicon, social links —
    // per-site (a non-primary site edits its own override). FIRST, because it is
    // the first thing anybody fills in: everything below it dresses a site that
    // has to be named before it can be designed.
    component: SiteIdentitySurface,
  },
  {
    key: 'builder.theme',
    title: 'Look & feel',
    module: 'builder',
    icon: faPalette,
    order: 2,
    keywords: ['theme', 'colors', 'colors', 'fonts', 'brand', 'style', 'look'],
    // A theme is TENANT-wide and reusable across sites, so this is its own pane
    // rather than a mode inside the page editor — open it beside a page and a
    // color change repaints that page as it is dragged.
    component: ThemePaneSurface,
  },
  {
    key: 'builder.layout',
    title: 'Header & footer',
    module: 'builder',
    icon: faTableLayout,
    order: 3,
    keywords: ['header', 'footer', 'menu', 'nav', 'navigation', 'layout', 'chrome', 'logo bar'],
    // The chrome every page renders inside. Its own pane rather than a mode in the
    // page editor: a site has ONE of these, it publishes on its own, and open beside
    // a page it shows the header that page will actually wear.
    component: LayoutPaneSurface,
  },
  {
    key: 'builder.page',
    title: 'Page',
    module: 'builder',
    icon: faFileLines,
    order: 4,
    keywords: [
      'page',
      'edit page',
      'design page',
      'home page',
      'about',
      'landing',
      // Inherited from the retired whole-site editor, so the words people already
      // search with still land somewhere real.
      'design',
      'edit site',
      'studio',
      'drag and drop',
    ],
    // ONE page, opened with `{ pageId }` — several of these can be open at once, on
    // different pages, because each is its own document. Opened with no page it
    // asks which one, rather than showing a blank canvas.
    component: PagePaneSurface,
  },
  {
    key: 'builder.email',
    title: 'Email design',
    module: 'builder',
    icon: faEnvelope,
    order: 6,
    // The wording of every automatic email lives here — so the words somebody
    // types when they want to change what one SAYS have to land here too.
    keywords: [
      'newsletter',
      'template',
      'campaign design',
      'email',
      'reminder',
      'confirmation',
      'receipt',
      'wording',
      'what it says',
    ],
    // ONE email, opened with `{ emailId }` — several can be open at once, because
    // each is its own document with its own undo and its own Publish. Opened with
    // no email it asks which one, rather than showing a blank canvas.
    component: EmailPaneSurface,
  },
  {
    key: 'builder.history',
    title: 'History',
    module: 'builder',
    icon: faClockRotateLeft,
    keywords: ['versions', 'undo', 'restore', 'earlier', 'put back', 'previous'],
    // ONE document's history, opened BESIDE it with `{ docKind, docId }` from the clock
    // button in that document's own toolbar. Unlisted: a history with no document is a
    // pane whose only content is an instruction to go and open one.
    listed: false,
    component: HistoryPaneSurface,
  },
  {
    key: 'builder.preview',
    title: 'Preview',
    module: 'builder',
    icon: faEye,
    keywords: ['preview', 'see it', 'visitor', 'live view', 'check'],
    // The real page, served by the real storefront, in a pane BESIDE the canvas —
    // and an email as the email-safe markup a recipient gets. Unlisted for the same
    // reason as History: without a document it can only tell you to open one.
    listed: false,
    component: PreviewPaneSurface,
  },
  {
    key: 'builder.publish',
    title: 'Publish',
    module: 'builder',
    icon: faCloudArrowUp,
    order: 7,
    keywords: ['go live', 'publish', 'launch', 'roll back', 'put back', 'releases', 'check'],
    // The WHOLE-SITE counterpart to each builder's own Publish: what is waiting, the
    // pre-publish check, every version that went live, and the way back. Listed,
    // because "is my site up to date" is a question with no document attached.
    component: PublishPaneSurface,
  },

  /* ── Design ────────────────────────────────────────────────────────────── */
  {
    key: 'builder.blueprints',
    title: 'Blueprints',
    module: 'builder',
    icon: faTableLayout,
    section: 'Design',
    order: 11,
    keywords: ['templates', 'starters', 'themes'],
    component: BlueprintsListSurface,
  },
  {
    key: 'builder.blueprint',
    title: 'Blueprint',
    module: 'builder',
    icon: faTableLayout,
    component: BlueprintDetailSurface,
    // Opened from the gallery with `{ key }`.
    listed: false,
  },
  {
    key: 'builder.components',
    title: 'Saved pieces',
    module: 'builder',
    icon: faCube,
    section: 'Design',
    order: 12,
    keywords: ['components', 'blocks', 'reusable', 'sections'],
    // Plainer than the dashboard's "Components" on purpose — the audience is
    // non-technical business owners.
    component: SavedPiecesListSurface,
  },
  {
    key: 'builder.piece',
    title: 'Saved piece',
    module: 'builder',
    icon: faCube,
    order: 5,
    keywords: ['saved piece', 'reusable', 'component', 'edit piece', 'shared design'],
    // ONE master, opened with `{ pieceId }`. Open it beside a page that uses it and
    // the page repaints as you type — the same document in two panes, which is what
    // the per-document session is for.
    component: PiecePaneSurface,
  },
  {
    key: 'builder.component',
    title: 'Saved piece',
    module: 'builder',
    icon: faCube,
    component: SavedPieceDetailSurface,
    listed: false,
  },

  /* ── Results ───────────────────────────────────────────────────────────── */
  {
    key: 'builder.pages',
    title: 'Page results',
    module: 'builder',
    icon: faChartColumn,
    section: 'Results',
    order: 15,
    keywords: ['analytics', 'traffic', 'views', 'visitors', 'performance', 'conversion', 'speed'],
    // Did the page you built do anything? Traffic, sales credited to it, search
    // grade and real-user load time, per page — the one place those four meet.
    component: PageResultsSurface,
  },

  /* ── Forms ─────────────────────────────────────────────────────────────── */
  {
    key: 'builder.forms',
    title: 'Form submissions',
    module: 'builder',
    icon: faInbox,
    section: 'Forms',
    order: 20,
    keywords: ['contact', 'enquiries', 'leads', 'messages'],
    component: FormSubmissionsListSurface,
  },
  {
    key: 'builder.submission',
    title: 'Submission',
    module: 'builder',
    icon: faInbox,
    component: SubmissionDetailSurface,
    listed: false,
  },
  {
    // LISTED, because being unreachable is the whole bug: every one of these
    // settings has been stored and honoured since silica forms shipped, and no
    // screen opened them (issue 355).
    key: 'builder.form-settings',
    title: 'Form settings',
    module: 'builder',
    icon: faSliders,
    section: 'Forms',
    order: 21,
    keywords: ['form', 'notify', 'recipients', 'reply', 'autoresponder', 'contact', 'enquiries'],
    component: FormSettingsListSurface,
  },
  {
    key: 'builder.form-setting',
    title: 'Form settings',
    module: 'builder',
    icon: faSliders,
    component: FormSettingsSurface,
    listed: false,
  },
];
