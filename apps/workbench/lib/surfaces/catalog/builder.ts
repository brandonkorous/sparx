// Site — designing what visitors actually see.
//
// Six nav rows, mirroring the tested dashboard shape (docs/40 + the dashboard
// builder manifest): the two builders lead (Editor · Email), then the design
// assets (Site · Blueprints · Saved pieces), then the Forms inbox. There is NO
// separate "pages" or "email designs" list — the silica <Builder> owns page
// selection + site layout (header/footer/menus), and the email studio owns its
// own email switcher — so listing those separately would duplicate a picker the
// editor already ships.

import { BarChart3, Component, Globe, Inbox, LayoutTemplate, Mail, Pencil } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { StudioSurface } from '../../../surfaces/builder/studio/studio-surface';
import { SiteIdentitySurface } from '../../../surfaces/builder/site-identity';
import { BlueprintsListSurface } from '../../../surfaces/builder/blueprints-list';
import { BlueprintDetailSurface } from '../../../surfaces/builder/blueprint-detail';
import { SavedPiecesListSurface } from '../../../surfaces/builder/saved-pieces-list';
import { SavedPieceDetailSurface } from '../../../surfaces/builder/saved-piece-detail';
import { EmailEditorSurface } from '../../../surfaces/builder/email/email-editor';
import { FormSubmissionsListSurface } from '../../../surfaces/builder/form-submissions-list';
import { SubmissionDetailSurface } from '../../../surfaces/builder/submission-detail';
import { PageResultsSurface } from '../../../surfaces/builder/page-results';

export const BUILDER_SURFACES: SurfaceDefinition[] = [
  // ── The two builders lead — the module's primary, unsectioned surfaces ──
  {
    key: 'builder.studio',
    title: 'Editor',
    module: 'builder',
    icon: Pencil,
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
    // opened blank (first page) or with `{ pageId }` / `{ componentId }`.
    component: StudioSurface,
  },
  {
    key: 'builder.email',
    title: 'Email designs',
    module: 'builder',
    icon: Mail,
    order: 2,
    keywords: ['newsletter', 'template', 'campaign design', 'email'],
    // The email studio — silica `<EmailBuilder>` with a built-in switcher +
    // new/rename/delete/fork/publish. One surface, no separate list.
    component: EmailEditorSurface,
  },

  /* ── Design ────────────────────────────────────────────────────────────── */
  {
    key: 'builder.site',
    title: 'Site',
    module: 'builder',
    icon: Globe,
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
    icon: LayoutTemplate,
    section: 'Design',
    order: 11,
    keywords: ['templates', 'starters', 'themes'],
    component: BlueprintsListSurface,
  },
  {
    key: 'builder.blueprint',
    title: 'Blueprint',
    module: 'builder',
    icon: LayoutTemplate,
    component: BlueprintDetailSurface,
    // Opened from the gallery with `{ key }`.
    listed: false,
  },
  {
    key: 'builder.components',
    title: 'Saved pieces',
    module: 'builder',
    icon: Component,
    section: 'Design',
    order: 12,
    keywords: ['components', 'blocks', 'reusable', 'sections'],
    // Plainer than the dashboard's "Components" on purpose — the audience is
    // non-technical business owners.
    component: SavedPiecesListSurface,
  },
  {
    key: 'builder.component',
    title: 'Saved piece',
    module: 'builder',
    icon: Component,
    component: SavedPieceDetailSurface,
    listed: false,
  },

  /* ── Results ───────────────────────────────────────────────────────────── */
  {
    key: 'builder.pages',
    title: 'Page results',
    module: 'builder',
    icon: BarChart3,
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
    icon: Inbox,
    section: 'Forms',
    order: 20,
    keywords: ['contact', 'enquiries', 'leads', 'messages'],
    component: FormSubmissionsListSurface,
  },
  {
    key: 'builder.submission',
    title: 'Submission',
    module: 'builder',
    icon: Inbox,
    component: SubmissionDetailSurface,
    listed: false,
  },
];
