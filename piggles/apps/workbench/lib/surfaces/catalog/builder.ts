// Site — designing what visitors actually see.
//
// The builders lead, in the order someone works: a Page, the Header & footer that
// wraps every page, the Look & feel underneath both, then Email designs. Each is
// ONE document in its own pane, so several can be open at once — a page beside the
// header it wears, or two pages side by side.
//
// `builder.studio` is the OLD whole-site editor, still listed while the per-document
// panes land (the cutover is Phase 9 of piggles/docs/features/builder). Then the
// design assets (Site · Blueprints · Saved pieces), and the Forms inbox.

import {
  faChartColumn,
  faClockRotateLeft,
  faCube,
  faEnvelope,
  faEye,
  faFileLines,
  faGlobe,
  faInbox,
  faPalette,
  faPencil,
  faTableLayout,
} from '@fortawesome/pro-solid-svg-icons';
import type { SurfaceDefinition } from '../registry';
import { StudioSurface } from '../../../surfaces/builder/studio/studio-surface';
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
import { FormSubmissionsListSurface } from '../../../surfaces/builder/form-submissions-list';
import { SubmissionDetailSurface } from '../../../surfaces/builder/submission-detail';
import { PageResultsSurface } from '../../../surfaces/builder/page-results';

export const BUILDER_SURFACES: SurfaceDefinition[] = [
  // ── The two builders lead — the module's primary, unsectioned surfaces ──
  {
    key: 'builder.studio',
    title: 'Editor',
    module: 'builder',
    icon: faPencil,
    order: 1,
    // 'header'/'footer'/'menu' land here now: site layout is edited on the
    // editor's canvas, not a separate surface.
    keywords: [
      'design',
      'edit site',
      'studio',
      'drag and drop',
      'layout',
      'pages',
      'header',
      'footer',
      'menu',
    ],
    // The visual editor — silica `<Builder>`. Owns page selection AND site layout;
    // opened blank (first page) or with `{ pageId }` / `{ componentId }` / `{ mode }`.
    // `mode` is what makes the header/footer/menu keywords above honest: they land
    // here, and `{ mode: 'layout' }` lands on the chrome rather than a page body.
    component: StudioSurface,
  },
  {
    key: 'builder.theme',
    title: 'Look & feel',
    module: 'builder',
    icon: faPalette,
    order: 4,
    keywords: ['theme', 'colors', 'colors', 'fonts', 'brand', 'style', 'look'],
    // A theme is TENANT-wide and reusable across sites, so this is its own pane
    // rather than a mode inside the page editor — open it beside a page and a
    // color change repaints that page as it is dragged.
    component: ThemePaneSurface,
  },
  {
    key: 'builder.page',
    title: 'Page',
    module: 'builder',
    icon: faFileLines,
    order: 2,
    keywords: ['page', 'edit page', 'design page', 'home page', 'about', 'landing'],
    // ONE page, opened with `{ pageId }` — several of these can be open at once, on
    // different pages, because each is its own document. Opened with no page it
    // asks which one, rather than showing a blank canvas.
    component: PagePaneSurface,
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
    key: 'builder.email',
    title: 'Email design',
    module: 'builder',
    icon: faEnvelope,
    order: 6,
    keywords: ['newsletter', 'template', 'campaign design', 'email'],
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

  /* ── Design ────────────────────────────────────────────────────────────── */
  {
    key: 'builder.site',
    title: 'Site',
    module: 'builder',
    icon: faGlobe,
    section: 'Design',
    order: 10,
    keywords: ['identity', 'name', 'tagline', 'logo', 'favicon', 'social', 'brand'],
    // The active site's IDENTITY: name, tagline, logo, favicon, social links —
    // per-site (a non-primary site edits its own override).
    component: SiteIdentitySurface,
  },
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
];
