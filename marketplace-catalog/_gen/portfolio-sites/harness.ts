// The reusable composition harness for the SIX personal-portfolio site-template blueprints
// (marketplace-catalog/blueprints/sparx-portfolio-*). The lean sibling of
// `template-sites/harness.ts`: a portfolio is neither a shop nor a publication, so it does
// NOT ship the nine-page commerce superset. It ships exactly the five pages a person's
// portfolio has —
//
//   Home · Work (a live, linkable project index) · Project (a bespoke case-study detail) ·
//   About · Contact
//
// — and nothing else: no Shop / Cart / Collections / Search, no commerce at all. The
// `Blueprint` schema imposes no page-set (commerce is `.optional()`, `pages` is 1..200), so
// this is a clean lean harness, not a fork of the commerce one.
//
// A template's generator (`gen-portfolio-<persona>.ts`) is JUST its SPEC — the home beats,
// the work masthead, the bespoke project (case-study) page, about/contact, and the projects
// as `blog_post` CMS records. `composePortfolioSite(spec)` builds the site;
// `emitPortfolioBundle(spec)` writes the whole bundle to disk.
//
// WHY THE PROJECT IS A `blog_post`. A live, linkable work index needs the ONE sanctioned
// linkable CMS repeat — `blogPostGrid()` (the generic `cms.<type>` list exposes no per-item
// href; see marketplace-catalog/CLAUDE.md). So a "project" is a `blog_post` record (labelled
// Projects in the UI), its index is `/work` (the `blogPostGrid` cards link live to
// `/blog/:slug`), and its bespoke case-study detail is a `cms.blog_post` collection template
// authored with the shared `template-sites/article.ts` kit. This is the proven,
// functions-day-one path.
//
// WHY RELATIVE IMPORTS — see template-sites/harness.ts (marketplace-catalog has no
// node_modules). The silica node PRIMITIVES come through the silica-catalog package's own
// copy so the nodes this file mints and the nodes the catalog factories mint are the SAME
// module instance. The EMITTED blueprint.ts is the opposite discipline — pure data, sibling
// JSON only, never `@sparx/*`.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  pageBody,
  stampTree,
  el,
  type Node,
  type Theme,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { starterFrame } from '../../../packages/silica-catalog/src/site';
import type { FooterVariant, NavbarVariant } from '../../../packages/silica-catalog/src/site-chrome';
import { blogPostGrid } from '../../../packages/silica-catalog/src/cms';
import { resolveSparxTheme } from '../../../packages/silica-catalog/src/resolve-sparx-theme';
import { PORTFOLIO_THEME_BY_SLUG } from '../../../packages/silica-catalog/src/portfolio-themes';
import { colorToHex } from '../../../packages/site-themes/src/v2/color';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintsDir = join(here, '..', '..', 'blueprints');

/** The payload version every portfolio bundle ships. BUMP whenever the emitted content
 *  changes — a marketplace artifact is IMMUTABLE per `(category, slug, version)`, so without
 *  a bump the catalog keeps serving the OLD payload and a fresh install never sees the new
 *  pages. 1.0.0 is the first, full five-page portfolio pass. */
const BUNDLE_VERSION = '1.0.0';

// ── Types ─────────────────────────────────────────────────────────────────────

/** The pages every portfolio composes — the keys `seo` overrides address. `project` is the
 *  bespoke case-study detail (a `cms.blog_post` collection template); the other four are
 *  singletons. */
export type PortfolioPageKey = 'home' | 'work' | 'project' | 'about' | 'contact';

/** One portfolio template's authored spec. The home/work/project/about/contact bodies are
 *  the DISTINCT part; everything else follows the shared shape so the six stay uniform. */
export interface PortfolioSiteSpec {
  /** The `portfolio-<persona>` slug — the key into `PORTFOLIO_THEME_BY_SLUG`. */
  slug: string;
  /** The bundle key / directory name (`sparx-<slug>`). */
  key: string;
  /** Marketplace card identity. */
  name: string;
  summary: string;
  tagline: string;
  /** The industry facet + card badge (e.g. 'Product & UX designer'). */
  industry: string;
  /** A validation-consistency list, not an install gate — a portfolio leans on builder + cms
   *  (+ email for the contact-driven marketing starter). */
  requiresModules: string[];
  /** Sort weight on the marketplace grid. */
  sortWeight: number;
  /** IDENTITY ONLY — the person's name + tagline. Colours + fonts derive from the bespoke
   *  theme (below), never hand-typed, so the card can never drift from the look. */
  brand: { businessName: string; tagline: string };
  /** Site-chrome shape for this template — which navbar/footer the frame starts on and
   *  whether the bar carries a filled CTA. The nav is ALWAYS Work / About / Contact (a
   *  portfolio's real destinations), fed to the frame as an explicit `navLinks` override. */
  chrome?: { navbar?: NavbarVariant; footer?: FooterVariant; showCta?: boolean };
  /** REAL, person-voiced search title + description per page, so the shipped starter's link
   *  previews read like the real portfolio from the first install. `home` (and usually
   *  `about`) should always be authored here; the rest fall back to the composed standard. */
  seo?: Partial<Record<PortfolioPageKey, { title: string; description: string }>>;
  /** The home page's section sequence — the template's own distinct beats. */
  home: Node[];
  /** BESPOKE work-index sections shown ABOVE the live `blogPostGrid()` (the sanctioned,
   *  linkable `cms.blog_post` repeat) — the template's own "Selected work" masthead. The grid
   *  is ALWAYS appended, so the index stays live + linkable no matter the masthead. Omit for
   *  the neutral default masthead. */
  work?: Node[];
  /** The BESPOKE case-study PAGE — a `cms.blog_post` collection template, authored self-scoped
   *  with the shared `template-sites/article.ts` kit (`articlePage(header, { backHref: '/work' })`).
   *  Lands at `/blog/:slug`, `isDefault`, so every project wears THIS design. */
  project: Node;
  /** The About page body (defaults to a neutral two-band about if omitted). */
  about?: Node[];
  /** The Contact page body (defaults to a neutral reach-out prompt if omitted). */
  contact?: Node[];
  /** AuthorDecl[] — the byline persona(s) the projects reference by `authorSlug`. A portfolio
   *  usually ships ONE author (the person), so the case-study byline resolves to a real name +
   *  portrait + bio. */
  authors?: unknown[];
  /** ContentEntryDecl[] — the PROJECTS, as `blog_post` records (the work the portfolio shows). */
  content: unknown[];
  /** AssetDecl[] — every image URL the bundle references, each with alt. */
  assets: unknown[];
  /** EmailDecl[] — optional brand-voiced MARKETING starters (unkeyed; the platform's keyed
   *  transactional defaults are separate). A portfolio may ship one "let's work together"
   *  note or none. */
  emails?: unknown[];
}

// ── Small page-projection helpers (portfolio copies of the harness's private ones) ──

/** One singleton page, projected to the SiteDecl shape the loader validates. Home is the one
 *  page with no slug. Every root is fully STAMPED so the studio opens live, editable trees. */
function singleton(
  name: string,
  slug: string,
  root: Node,
  seo?: { title: string; description: string }
): Record<string, unknown> {
  return {
    name,
    kind: 'singleton',
    ...(slug ? { slug } : {}),
    ...(seo ? { seoTitle: seo.title, seoDescription: seo.description } : {}),
    root: stampTree(root),
  };
}

/** One record-template page (NO slug — the installer derives `/blog/:slug` from the
 *  `recordType`). `isDefault` makes the published bespoke case-study win over the starter. */
function collectionPage(
  name: string,
  recordType: string,
  root: Node,
  seo?: { title: string; description: string }
): Record<string, unknown> {
  return {
    name,
    kind: 'collection',
    recordType,
    isDefault: true,
    ...(seo ? { seoTitle: seo.title, seoDescription: seo.description } : {}),
    root: stampTree(root),
  };
}

/** Per-page search title + description for the five portfolio pages. The template's own
 *  `spec.seo` wins per page; the rest fall back to composed, person-voiced copy. Each entry is
 *  DISTINCT within the site (the SEO lint flags two pages sharing a title/description). */
function portfolioSeo(
  spec: PortfolioSiteSpec
): Record<PortfolioPageKey, { title: string; description: string }> {
  const bn = spec.brand.businessName;
  const ind = spec.industry;
  const composed: Record<PortfolioPageKey, { title: string; description: string }> = {
    home: { title: bn, description: `${bn} — ${ind.toLowerCase()}. Selected work, and how to get in touch.` },
    work: {
      title: `Work — ${bn}`,
      description: `Selected projects and case studies by ${bn} — the work, the thinking, and the outcome.`,
    },
    about: {
      title: `About — ${bn}`,
      description: `Who ${bn} is and how they work — background, approach, and the tools of the trade.`,
    },
    contact: {
      title: `Contact — ${bn}`,
      description: `Start a project with ${bn} — availability, what a good brief looks like, and where to reach them.`,
    },
    // The project template is a record template — per-project title/description at runtime.
    // This page-level pair is only the studio fallback for the template itself.
    project: {
      title: `Project — ${bn}`,
      description: `A project by ${bn} — the brief, the process, and the result, in one case study.`,
    },
  };
  const out = { ...composed };
  for (const [key, value] of Object.entries(spec.seo ?? {})) {
    if (value) out[key as PortfolioPageKey] = value;
  }
  return out;
}

/** A neutral default work-index masthead — used when a spec doesn't author its own. */
function defaultWorkMasthead(): Node[] {
  return [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
      children: [
        el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
          children: [
            el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
              text: 'Selected work',
            }),
            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
              text: 'A selection of recent projects. Each one opens to the full story — the brief, the work, and the result.',
            }),
          ],
        }),
      ],
    }),
  ];
}

/** A neutral default About body — used when a spec doesn't author its own. */
function defaultAbout(spec: PortfolioSiteSpec): Node[] {
  return [
    el('section', 'bg-base-100 @container px-6 py-20', {
      children: [
        el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
          children: [
            el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
              text: `About ${spec.brand.businessName}`,
            }),
            el('p', 'text-lg leading-relaxed text-base-content', {
              text: 'This is your story — who you are, what you make, and the work you want more of. Replace this with a few honest sentences; the people who find you here want to know the person behind the work.',
            }),
          ],
        }),
      ],
    }),
  ];
}

/** A neutral default Contact body — used when a spec doesn't author its own. */
function defaultContact(): Node[] {
  return [
    el('section', 'bg-base-100 @container px-6 py-20 text-center', {
      children: [
        el('div', 'mx-auto flex w-full max-w-xl flex-col items-center gap-5', {
          children: [
            el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
              text: 'Get in touch',
            }),
            el('p', 'text-lg leading-relaxed text-base-content', {
              text: 'Available for select projects. Tell me a little about what you have in mind and I will get back to you.',
            }),
            el('a', 'btn btn-primary btn-lg', {
              attrs: { href: 'mailto:hello@example.com' },
              text: 'Email me',
            }),
          ],
        }),
      ],
    }),
  ];
}

// ── Site composition ────────────────────────────────────────────────────────────

/** Compose ONE portfolio's distinct silica site as a SiteDecl (`{ frame, pages, theme }`).
 *  The bespoke theme comes from `PORTFOLIO_THEME_BY_SLUG[slug]`, resolved to the flat
 *  ship-ready token bag. The frame is chrome with NO commerce/cms module links and an
 *  explicit Work / About / Contact nav. */
export function composePortfolioSite(spec: PortfolioSiteSpec): Record<string, unknown> {
  const rawTheme = PORTFOLIO_THEME_BY_SLUG[spec.slug];
  if (!rawTheme) throw new Error(`portfolio-harness: no theme for slug "${spec.slug}"`);
  const theme = resolveSparxTheme(rawTheme);

  // A portfolio's chrome: no commerce, no scheduling, no cms nav link — an explicit
  // Work / About / Contact nav instead (the `navLinks` seam), so the header/footer never
  // invite a visitor into a Shop / Journal / Search route this site does not ship.
  const frameRoot = starterFrame({
    commerceEnabled: false,
    schedulingEnabled: false,
    cmsEnabled: false,
    navLinks: [
      ['Work', '/work'],
      ['About', '/about'],
      ['Contact', '/contact'],
    ],
    navbar: spec.chrome?.navbar ?? 'brandLeft',
    footer: spec.chrome?.footer ?? 'columns',
    showCta: spec.chrome?.showCta ?? true,
  }).root as Node;

  const seo = portfolioSeo(spec);
  // Work: the template's own masthead over the live, linkable post grid (blogPostGrid — the
  // one sanctioned `cms.blog_post` repeat whose cards link to `/blog/:slug`).
  const workBody = pageBody([...(spec.work ?? defaultWorkMasthead()), blogPostGrid()]);

  const pages = [
    singleton('Home', '', pageBody(spec.home), seo.home),
    singleton('Work', 'work', workBody, seo.work),
    singleton('About', 'about', pageBody(spec.about ?? defaultAbout(spec)), seo.about),
    singleton('Contact', 'contact', pageBody(spec.contact ?? defaultContact()), seo.contact),
    // The BESPOKE case-study detail — a `cms.blog_post` collection page (`isDefault`) the
    // installer lands at `/blog/:slug`, so every project wears the template's own design.
    // Appended last so the ordinary pages keep their positions.
    collectionPage('Project', 'cms.blog_post', spec.project, seo.project),
  ];

  return { frame: { root: frameRoot }, pages, theme };
}

// ── Bundle emission ──────────────────────────────────────────────────────────────

/** colorToHex, fail-fast — a theme role that won't resolve is a generator bug worth stopping
 *  on, not a silent `#000000`. */
function hex(value: string | undefined, ctx: string): string {
  const out = colorToHex(value ?? null);
  if (!out) throw new Error(`portfolio-harness: ${ctx} did not resolve to hex (got ${value})`);
  return out;
}

/** First family name in a silica font stack (`"Fraunces", serif` → `Fraunces`). */
function firstFamily(stack: string | undefined): string | undefined {
  const first = stack?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  return first || undefined;
}

/** The `heading`/`body` font families a theme states, reading its raw `.fonts` object. */
function faces(theme: Theme): { heading: string; body: string } {
  const fonts = (theme as { fonts?: { sans?: { family?: string }; head?: { family?: string } } })
    .fonts;
  const tokens = (theme as { tokens?: Record<string, string> }).tokens ?? {};
  const body = fonts?.sans?.family ?? firstFamily(tokens['--font-sans']) ?? 'Inter';
  const heading =
    fonts?.head?.family ??
    firstFamily(tokens['--font-head']) ??
    firstFamily(tokens['--font-heading']) ??
    body;
  return { heading, body };
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** The emitted, PURE-DATA blueprint.ts (sibling-JSON imports only — never `@sparx/*`). A
 *  portfolio ships NO commerce, so there is no `commerce.json` import or field. */
function blueprintTs(opts: {
  key: string;
  name: string;
  summary: string;
  requiresModules: string[];
  brand: unknown;
  theme: unknown;
  hasEmails: boolean;
}): string {
  return `// ${opts.name}: a personal-portfolio SITE TEMPLATE, composed distinct — its own home,
// a live work index, a bespoke case-study page, about + contact — dressed in the bespoke
// theme its persona pins.
//
// GENERATED by marketplace-catalog/_gen/gen-${opts.key.replace(/^sparx-/, '')}.ts via the
// shared _gen/portfolio-sites/harness.ts — do NOT hand-edit; edit the generator and
// regenerate. A blueprint is PURE DATA: the loader \`import()\`s this module with no
// workspace resolution, so it imports ONLY sibling JSON, never \`@sparx/*\`.
import site from './site.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import authors from './authors.json' with { type: 'json' };
import assets from './assets.json' with { type: 'json' };${
    opts.hasEmails ? `\nimport emails from './emails.json' with { type: 'json' };` : ''
  }

const blueprint = {
  key: ${JSON.stringify(opts.key)},
  version: '${BUNDLE_VERSION}',
  name: ${JSON.stringify(opts.name)},
  summary: ${JSON.stringify(opts.summary)},
  vertical: 'content',
  preview: 'media/preview.png',
  requiresModules: ${JSON.stringify(opts.requiresModules)},

  // Identity only (person's name + tagline + fonts + the theme's hex colours). The look
  // itself rides site.theme + the theme decl below; the installing tenant rebrands the name.
  brand: ${JSON.stringify(opts.brand, null, 2)},

  // The provisioned SiteTheme the installer creates + applies — the bespoke portfolio look
  // as a tenant-editable saved theme (base preset = the template's own theme key, plus its
  // brand snapshot).
  theme: ${JSON.stringify(opts.theme, null, 2)},

  assets,
  contentTypes: [],
  authors,
  content,

  // A portfolio has no commerce. The projects are CMS \`blog_post\` records (see content).
  ${opts.hasEmails ? 'emails,' : 'emails: [],'}
  sequences: [],

  // The composed distinct site (frame + home + a live /work index + about/contact + the
  // /blog/:slug case-study template), in the bespoke theme, fully stamped.
  site,
};

export default blueprint;
`;
}

/** The hand-maintained-shaped manifest (sparx.json). Emitted here for the first build; it
 *  survives regens afterward (like media/). */
function manifestJson(opts: {
  key: string;
  name: string;
  summary: string;
  tagline: string;
  industry: string;
  accent: string;
  sortWeight: number;
}): unknown {
  return {
    schemaVersion: 1,
    category: 'blueprint',
    slug: opts.key,
    name: opts.name,
    version: BUNDLE_VERSION,
    tagline: opts.tagline,
    description: opts.summary,
    payload: 'blueprint.ts',
    facets: {
      vertical: 'content',
      industry: opts.industry,
    },
    pricing: { model: 'free', priceCents: 0 },
    // A validation-consistency list, not an install gate — a portfolio's content is
    // independent of a tenant's active modules.
    requires: { modules: ['builder', 'cms', 'email'] },
    media: [
      { file: 'media/icon.png', kind: 'icon', alt: `${opts.name} icon` },
      { file: 'media/preview.png', kind: 'preview', alt: `${opts.name} — home page preview` },
    ],
    author: { displayName: 'sparx' },
    accent: opts.accent,
    sortWeight: opts.sortWeight,
  };
}

// ── Marketing-email starter ──────────────────────────────────────────────────────
//
// A portfolio's one brand-voiced MARKETING starter — a warm welcome for someone who joins
// the list (a draft on install), tokenized with the canonical merge tags so a fork re-themes
// to the tenant. The platform's keyed transactional defaults are separate and never
// duplicated here.

/** Build ONE silica `EmailDocument` (body → section → heading / paragraphs / button), with the
 *  `*Auto` colour flags so it re-themes light/dark per tenant. Node ids namespaced per email. */
function emailDoc(
  ns: string,
  o: {
    subject: string;
    preheader: string;
    heading: string;
    paragraphs: string[];
    button: { label: string; href: string };
  }
): Record<string, unknown> {
  let seq = 0;
  const eid = (k: string): string => `${ns}-${k}-${(seq += 1)}`;
  const text = (html: string, heading = false): Record<string, unknown> => ({
    id: eid('text'),
    kind: 'text',
    html,
    align: 'left',
    color: '#18181b',
    colorAuto: true,
    fontSize: heading ? 28 : 16,
    fontWeight: heading ? 'bold' : 'normal',
    lineHeight: heading ? 36 : 26,
  });
  const spacer = (height: number): Record<string, unknown> => ({
    id: eid('spacer'),
    kind: 'spacer',
    height,
  });

  const blocks: Record<string, unknown>[] = [text(o.heading, true), spacer(10)];
  o.paragraphs.forEach((p, i) => {
    blocks.push(text(p));
    blocks.push(spacer(i === o.paragraphs.length - 1 ? 22 : 14));
  });
  blocks.push({
    id: eid('button'),
    kind: 'button',
    label: o.button.label,
    href: o.button.href,
    bg: '#111827',
    bgAuto: true,
    color: '#ffffff',
    colorAuto: true,
    radius: 6,
    align: 'left',
    paddingX: 24,
    paddingY: 12,
  });

  return {
    version: '1',
    subject: o.subject,
    preheader: o.preheader,
    root: {
      id: eid('body'),
      kind: 'body',
      width: 600,
      bg: '#f4f4f5',
      bgAuto: true,
      contentBg: '#ffffff',
      contentBgAuto: true,
      fontFamily: 'Arial, Helvetica, sans-serif',
      colorScheme: 'light dark',
      children: [
        {
          id: eid('section'),
          kind: 'section',
          bg: '#ffffff',
          bgAuto: true,
          paddingX: 24,
          paddingY: 24,
          children: blocks,
        },
      ],
    },
  };
}

/** The default MARKETING starter for a portfolio — a warm welcome for a new subscriber, a
 *  draft on install. Person-voiced but persona-neutral (it reads right for a designer, a
 *  photographer or a writer alike); the CTA points at the site's live `/work`. */
function portfolioEmails(_spec: PortfolioSiteSpec): Record<string, unknown>[] {
  return [
    {
      name: 'Welcome',
      publish: false,
      doc: emailDoc('folio-welcome', {
        subject: 'Thanks for subscribing to {{site.name}}',
        preheader: 'A quick hello, and where to see the work.',
        heading: 'Hello, {{customer.firstName}}',
        paragraphs: [
          'Thanks for subscribing to {{site.name}}. I’ll send the occasional note when there’s new work worth sharing — no noise, and never often.',
          'In the meantime, have a look through the selected work. If something sparks an idea for a project, I’d love to hear about it.',
        ],
        button: { label: 'See the work', href: '{{site.url}}/work' },
      }),
    },
  ];
}

/** Build every part of one portfolio bundle and write it to `blueprints/<key>/`. Returns the
 *  resolved theme (light tokens) so a caller can render a preview against the exact look the
 *  bundle ships. */
export async function emitPortfolioBundle(
  spec: PortfolioSiteSpec
): Promise<{ dir: string; theme: Theme }> {
  const rawTheme = PORTFOLIO_THEME_BY_SLUG[spec.slug];
  if (!rawTheme) throw new Error(`portfolio-harness: no theme for slug "${spec.slug}"`);
  const resolved = resolveSparxTheme(rawTheme);
  const light = resolved.tokens ?? {};
  const { heading, body } = faces(rawTheme);

  const primary = hex(light['--color-primary'], `${spec.key} primary`);
  const primaryForeground = hex(light['--color-primary-content'], `${spec.key} primary-content`);
  const accent = hex(light['--color-accent'], `${spec.key} accent`);
  const secondary = hex(light['--color-secondary'], `${spec.key} secondary`);

  const brand = {
    businessName: spec.brand.businessName,
    tagline: spec.brand.tagline,
    colors: { primary, primaryForeground, accent, secondary },
    fonts: { heading, body },
  };

  const themeDecl = {
    name: spec.slug,
    basePresetKey: spec.slug,
    presentation: { v: 2, containerWidth: '1152px' },
    brand: {
      colorPrimary: primary,
      colorAccent: accent,
      colorSecondary: secondary,
      fontHeading: heading,
      fontBody: body,
      tokens: {},
    },
    apply: true,
  };

  const site = composePortfolioSite(spec);
  // A portfolio greets a new subscriber with one brand-voiced starter (a draft on install)
  // unless the spec authors its own. The platform's keyed transactional defaults are separate.
  const emailList = (spec.emails ?? portfolioEmails(spec)) as unknown[];
  const hasEmails = emailList.length > 0;

  const dir = join(blueprintsDir, spec.key);
  await fs.mkdir(join(dir, 'media'), { recursive: true });

  await fs.writeFile(join(dir, 'site.json'), json(site));
  await fs.writeFile(join(dir, 'authors.json'), json(spec.authors ?? []));
  await fs.writeFile(join(dir, 'content.json'), json(spec.content));
  await fs.writeFile(join(dir, 'assets.json'), json(spec.assets));
  if (hasEmails) await fs.writeFile(join(dir, 'emails.json'), json(emailList));
  await fs.writeFile(
    join(dir, 'blueprint.ts'),
    blueprintTs({
      key: spec.key,
      name: spec.name,
      summary: spec.summary,
      requiresModules: spec.requiresModules,
      brand,
      theme: themeDecl,
      hasEmails,
    })
  );
  await fs.writeFile(
    join(dir, 'sparx.json'),
    json(
      manifestJson({
        key: spec.key,
        name: spec.name,
        summary: spec.summary,
        tagline: spec.tagline,
        industry: spec.industry,
        accent: primary,
        sortWeight: spec.sortWeight,
      })
    )
  );

  return { dir, theme: resolved };
}
