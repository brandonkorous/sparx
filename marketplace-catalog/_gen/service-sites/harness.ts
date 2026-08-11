// The reusable composition harness for BOOKING-BACKED service-business templates
// (tattoo studios, salons, barbershops, spas, trades…). It is the sibling of
// `template-sites/harness.ts` (the ten commerce/content reference sites) and shares
// its discipline — a template is JUST a SPEC; this file composes the silica site and
// emits the bundle — but it composes a DIFFERENT site: the service page set
// (Home · Book · About · Contact) with the LIVE `scheduling.services` host core on the
// Book page, and it emits a `scheduling.json` the installer's scheduling slice replays
// into a working booking flow (a real service menu, bookable staff/rooms, hours, a
// deposit policy). A service template installs a business that FUNCTIONS on day one,
// not a look with a static “/book” page.
//
// WHY A SEPARATE HARNESS. The commerce harness hardcodes the shop page set (Shop / Cart /
// Product / PLP) with `scheduling off`; overloading it would risk the ten shipped
// reference sites. The two share the low-level machinery — `faces()`, `resolveSparxTheme`,
// `colorToHex`, `starterFrame`, the host cores — but compose different sites, so they are
// two harnesses over one kit.
//
// WHY RELATIVE IMPORTS (mirrors template-sites/harness.ts). marketplace-catalog has no
// node_modules, so a bare `@sparx/*` / `@wizeworks/*` can't resolve here; each workspace
// package is reached by relative path so tsx compiles it in place. The silica node
// PRIMITIVES come through silica-catalog's OWN copy of silicaui-html, so the nodes this
// file mints and the nodes the catalog factories mint are the SAME module instance. The
// EMITTED blueprint.ts is the opposite discipline — pure data, sibling JSON only.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  el,
  pageBody,
  stampTree,
  type Node,
  type Theme,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { starterFrame } from '../../../packages/silica-catalog/src/site';
import type {
  FooterVariant,
  NavbarVariant,
  SiteChromeOptions,
} from '../../../packages/silica-catalog/src/site-chrome';
import { HOST_KEYS, hostCore } from '../../../packages/silica-catalog/src/host-nodes';
import { resolveSparxTheme } from '../../../packages/silica-catalog/src/resolve-sparx-theme';
import { colorToHex } from '../../../packages/site-themes/src/v2/color';

// Re-export the theme-authoring kit so a blueprint imports EVERYTHING (its theme helpers
// AND the section kit + emit) from one place.
export {
  defineTheme,
  face,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  type Face,
} from '../../../packages/silica-catalog/src/themes';
// `faces()` (theme → heading/body Google families) is the commerce harness's, reused
// verbatim so both harnesses derive fonts identically. Re-exported so the service preview
// (and any consumer) can derive the same Google-Font families the bundle ships.
import { faces } from '../template-sites/harness';
export { faces };
export type { Node, Theme };

const here = dirname(fileURLToPath(import.meta.url));
const blueprintsDir = join(here, '..', '..', 'blueprints');

/** The payload version every service bundle ships. BUMP on any content change — a
 *  marketplace artifact is IMMUTABLE per `(category, slug, version)`, so without a bump
 *  the catalog keeps serving the OLD payload. */
const BUNDLE_VERSION = '1.0.0';

// ── Types ─────────────────────────────────────────────────────────────────────

/** The service-site page keys `seo` overrides address. `menu` is present only for
 *  hospitality templates that author a dedicated menu page. */
export type ServicePageKey = 'home' | 'menu' | 'book' | 'about' | 'contact';

/** One service-business template's authored spec. The `home` beats + the `scheduling`
 *  menu + the bespoke `theme` are the DISTINCT part; everything else follows the shared
 *  shape so the family stays uniform. */
export interface ServiceSiteSpec {
  /** The bundle key / directory name (`sparx-<slug>`). */
  key: string;
  /** Marketplace card identity. */
  name: string;
  summary: string;
  tagline: string;
  /** The industry facet + card badge label (e.g. 'Hair salon'). */
  industry: string;
  /** Sort weight on the marketplace grid. */
  sortWeight: number;
  /** The modules the install provisions into. A booking business is
   *  `builder + scheduling + crm + email` (commerce/cms optional). */
  requiresModules: string[];
  /** IDENTITY ONLY — business name + tagline. Colours + fonts derive from `theme`. */
  brand: { businessName: string; tagline: string };
  /** The bespoke silica theme this template SHIPS — a `defineTheme` output. Resolved to
   *  the flat ship-ready token bag (`site.theme`), which is what the storefront renders. */
  theme: Theme;
  /** The saved-theme editing base (one of the 6 foundations). Default `apex`. The LIVE
   *  look is `theme` above; this is only the tenant's editable starting point. */
  basePresetKey?: string;
  /** Optional site-chrome overrides. Merged OVER the service default
   *  (`commerce off · scheduling on · cms off`), so the navbar carries a Book link and
   *  no cart. `navLinks` overrides the module-derived nav (a restaurant wants Menu /
   *  Reserve / About / Contact); `ctaLabel`/`ctaHref` relabel the nav CTA ("Reserve"). */
  chrome?: {
    navbar?: NavbarVariant;
    footer?: FooterVariant;
    showCta?: boolean;
    navLinks?: [string, string][];
    ctaLabel?: string;
    ctaHref?: string;
  };
  /** A dedicated MENU page body (hospitality templates) — composed at `/menu` when present.
   *  Omit and no Menu page is added (the booking-service templates don't set it). */
  menu?: Node[];
  /** REAL, business-voiced search title + description per page. `home` should always be
   *  authored; the rest fall back to composed copy. */
  seo?: Partial<Record<ServicePageKey, { title: string; description: string }>>;
  /** The home page's section sequence — the template's own beat order. */
  home: Node[];
  /** Sections shown ABOVE the pinned live `scheduling.services` core on the Book page
   *  (a themed masthead / reassurance band). The core is ALWAYS appended beneath them,
   *  so the page stays a working booking surface no matter what the template puts on top.
   *  Omit for a plain heading. */
  bookIntro?: Node[];
  /** The About page body (defaults to a neutral two-band about). */
  about?: Node[];
  /** The Contact page body (defaults to a neutral reach-out prompt). */
  contact?: Node[];
  /** The SchedulingDecl (`{ policies?, resources, services }`) the installer replays into
   *  a live booking flow. Handle-based; `resourceRequirements` route to resources by
   *  kind + skill at booking time. */
  scheduling: unknown;
  /** Brand-voiced MARKETING email starters (`EmailDecl[]`), installed as DRAFTS. Optional —
   *  defaults to `serviceEmails(spec)` (a welcome + a come-back/rebook, tokenized so a fork
   *  re-themes to the tenant). MARKETING ONLY: a booking business's transactional sends
   *  (booking confirmation / reminder / reschedule / cancellation) are platform KEYED
   *  defaults (`default-emails.ts`) and must NEVER be duplicated here. */
  emails?: unknown[];
  /** AssetDecl[] — every image the bundle references (tree hot-links + scheduling images),
   *  each with alt. */
  assets: unknown[];
}

// ── Site composition ────────────────────────────────────────────────────────────

/** One singleton page, projected to the SiteDecl shape the loader validates. Home is the
 *  one page with no slug. Every root is fully STAMPED so the studio opens live trees. */
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

/** Per-page search copy — the template's own real copy wins; the rest fall back to
 *  composed functional copy naming the business (distinct per page for the SEO lint). */
function serviceSeo(
  spec: ServiceSiteSpec
): Record<ServicePageKey, { title: string; description: string }> {
  const bn = spec.brand.businessName;
  const tag = spec.brand.tagline;
  const ind = spec.industry;
  const composed: Record<ServicePageKey, { title: string; description: string }> = {
    home: { title: bn, description: `${tag} ${bn} — ${ind.toLowerCase()}. Book online.` },
    menu: {
      title: `Menu — ${bn}`,
      description: `See the full menu at ${bn} — dishes, drinks and prices — then reserve a table.`,
    },
    book: {
      title: `Book — ${bn}`,
      description: `See what ${bn} offers, with prices and how long each takes, and book your appointment online.`,
    },
    about: {
      title: `About — ${bn}`,
      description: `Who ${bn} is, what we do and the people behind the work.`,
    },
    contact: {
      title: `Visit — ${bn}`,
      description: `Where to find ${bn}, our hours, and how to reach us.`,
    },
  };
  const out = { ...composed };
  for (const [key, value] of Object.entries(spec.seo ?? {})) {
    if (value) out[key as ServicePageKey] = value;
  }
  return out;
}

/** Compose ONE service template's distinct silica site as a SiteDecl (`{ frame, pages,
 *  theme }`). The chrome is service-shaped: no shop/cart, a Book link in the navbar, the
 *  bespoke theme resolved to its flat token bag. */
export function composeServiceSite(spec: ServiceSiteSpec): Record<string, unknown> {
  const theme = resolveSparxTheme(spec.theme);

  // Service default: commerce OFF (no shop/cart chrome), scheduling ON (a Book link +
  // the /book surface), cms OFF. A template's own `chrome` merges OVER it.
  const chromeOpts: SiteChromeOptions = {
    commerceEnabled: false,
    schedulingEnabled: true,
    cmsEnabled: false,
    ...(spec.chrome ?? {}),
  };
  const frame = { root: starterFrame(chromeOpts).root as Node };

  const seo = serviceSeo(spec);

  // The Book page: the template's own masthead sections ABOVE the pinned live services
  // core (the real bookable menu, each service linking to its time-picker). The core is
  // ALWAYS appended, so the page stays a working booking surface. This authored `/book`
  // singleton is what the storefront route renders in place of its generic fallback.
  const bookBody = [
    ...(spec.bookIntro ?? [defaultBookIntro(spec)]),
    hostCore(HOST_KEYS.schedulingServices, 'mx-auto w-full max-w-5xl px-6 py-8'),
  ];

  const pages = [
    singleton('Home', '', pageBody(spec.home), seo.home),
    // A hospitality template's dedicated Menu page (between Home and the reservations
    // surface); absent for the booking-service templates that author no menu.
    ...(spec.menu ? [singleton('Menu', 'menu', pageBody(spec.menu), seo.menu)] : []),
    singleton('Book', 'book', pageBody(bookBody), seo.book),
    singleton('About', 'about', pageBody(spec.about ?? [defaultAbout(spec)]), seo.about),
    singleton('Contact', 'contact', pageBody(spec.contact ?? [defaultContact(spec)]), seo.contact),
  ];

  return { frame, pages, theme };
}

// ── Bundle emission ──────────────────────────────────────────────────────────────

/** colorToHex, fail-fast — a theme role that won't resolve is a generator bug worth
 *  stopping on, not a silent black. */
function hex(value: string | undefined, ctx: string): string {
  const out = colorToHex(value ?? null);
  if (!out) throw new Error(`service-harness: ${ctx} did not resolve to hex (got ${value})`);
  return out;
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** The emitted, PURE-DATA blueprint.ts (sibling-JSON imports only — never `@sparx/*`).
 *  Imports the site, the scheduling menu, and the assets; commerce/content are omitted
 *  (a booking business ships neither by default). Prettier reformats after generation. */
function blueprintTs(opts: {
  key: string;
  name: string;
  summary: string;
  requiresModules: string[];
  brand: unknown;
  theme: unknown;
}): string {
  return `// ${opts.name}: a BOOKING-BACKED service-business SITE TEMPLATE.
//
// GENERATED by marketplace-catalog/_gen/gen-${opts.key}.ts via the shared
// _gen/service-sites/harness.ts — do NOT hand-edit; edit the generator and regenerate.
// A blueprint is PURE DATA: the loader \`import()\`s this module with no workspace
// resolution, so it imports ONLY sibling JSON, never \`@sparx/*\`.
import site from './site.json' with { type: 'json' };
import scheduling from './scheduling.json' with { type: 'json' };
import emails from './emails.json' with { type: 'json' };
import assets from './assets.json' with { type: 'json' };

const blueprint = {
  key: ${JSON.stringify(opts.key)},
  version: '${BUNDLE_VERSION}',
  name: ${JSON.stringify(opts.name)},
  summary: ${JSON.stringify(opts.summary)},
  vertical: 'services',
  preview: 'media/preview.png',
  requiresModules: ${JSON.stringify(opts.requiresModules)},

  // Identity only (business name + tagline + fonts + the theme's hex colours). The look
  // rides site.theme + the theme decl below; the installing tenant rebrands the name.
  brand: ${JSON.stringify(opts.brand, null, 2)},

  // The provisioned SiteTheme the installer creates + applies — an editable saved theme
  // over a foundation base + the template's brand snapshot. The LIVE storefront look is
  // site.theme (the flat bespoke tokens), written last.
  theme: ${JSON.stringify(opts.theme, null, 2)},

  assets,
  contentTypes: [],

  // The booking spine — policies, bookable resources (staff/rooms/stations) with weekly
  // hours, and the service menu. The installer's scheduling slice replays it into a live
  // booking flow that the site's /book page renders.
  scheduling,

  // Brand-voiced MARKETING starters (a welcome + a come-back), installed as DRAFTS the
  // tenant switches on. The transactional booking sends — confirmation, reminder,
  // reschedule, cancellation, waitlist — are platform KEYED defaults, so they are covered
  // on email-module activation and are deliberately NOT duplicated here.
  emails,
  sequences: [],

  // The composed distinct site (frame + Home + Book + About + Contact) in the bespoke
  // theme, fully stamped.
  site,
};

export default blueprint;
`;
}

/** The hand-maintained-shaped manifest (sparx.json). Emitted for the first build; it
 *  survives regens afterward (like media/). */
function manifestJson(opts: {
  key: string;
  name: string;
  summary: string;
  tagline: string;
  industry: string;
  requiresModules: string[];
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
      vertical: 'services',
      industry: opts.industry,
      requiredModules: opts.requiresModules,
    },
    pricing: { model: 'free', priceCents: 0 },
    requires: { modules: opts.requiresModules },
    media: [
      { file: 'media/icon.png', kind: 'icon', alt: `${opts.name} icon` },
      { file: 'media/preview.png', kind: 'preview', alt: `${opts.name} — home page preview` },
    ],
    author: { displayName: 'sparx' },
    accent: opts.accent,
    sortWeight: opts.sortWeight,
  };
}

/** Build every part of one service bundle and write it to `blueprints/<key>/`. Returns
 *  the resolved theme so a caller can render a preview against the exact look. */
export async function emitServiceBundle(
  spec: ServiceSiteSpec
): Promise<{ dir: string; theme: Theme }> {
  const resolved = resolveSparxTheme(spec.theme);
  const light = resolved.tokens ?? {};
  const { heading, body } = faces(spec.theme);

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
    name: spec.theme.name,
    basePresetKey: spec.basePresetKey ?? 'apex',
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

  const site = composeServiceSite(spec);

  const dir = join(blueprintsDir, spec.key);
  await fs.mkdir(join(dir, 'media'), { recursive: true });

  await fs.writeFile(join(dir, 'site.json'), json(site));
  await fs.writeFile(join(dir, 'scheduling.json'), json(spec.scheduling));
  await fs.writeFile(join(dir, 'emails.json'), json(spec.emails ?? serviceEmails(spec)));
  await fs.writeFile(join(dir, 'assets.json'), json(spec.assets));
  await fs.writeFile(
    join(dir, 'blueprint.ts'),
    blueprintTs({
      key: spec.key,
      name: spec.name,
      summary: spec.summary,
      requiresModules: spec.requiresModules,
      brand,
      theme: themeDecl,
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
        requiresModules: spec.requiresModules,
        accent: primary,
        sortWeight: spec.sortWeight,
      })
    )
  );

  return { dir, theme: resolved };
}

// ── Marketing email starters ──────────────────────────────────────────────────────
// Every service bundle ships a small set of brand-voiced MARKETING email DRAFTS — the
// booking equivalent of the core blueprints' welcome pair — personalized with the
// canonical tokens (`{{site.name}}`, `{{customer.firstName}}`, `{{site.url}}`) so a fork
// re-themes to the tenant. MARKETING ONLY: booking confirmation / reminder / reschedule /
// cancellation are platform KEYED transactional defaults and are never duplicated here.

/** Build ONE silica `EmailDocument` in the shape the email editor saves + `renderSilicaEmail`
 *  sends (body → section → heading / paragraphs / button). Colours carry the `*Auto` flags
 *  so the mail re-themes light/dark per tenant, exactly like the core blueprints' emails.
 *  Node ids are namespaced per email so a doc's nodes stay unique. */
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
  const id = (k: string): string => `${ns}-${k}-${(seq += 1)}`;
  const text = (html: string, heading = false): Record<string, unknown> => ({
    id: id('text'),
    kind: 'text',
    html,
    align: 'left',
    color: '#18181b',
    colorAuto: true,
    fontSize: heading ? 28 : 16,
    fontWeight: heading ? 'bold' : 'normal',
    lineHeight: heading ? 36 : 26,
  });
  const spacer = (height: number): Record<string, unknown> => ({ id: id('spacer'), kind: 'spacer', height });

  const blocks: Record<string, unknown>[] = [text(o.heading, true), spacer(10)];
  o.paragraphs.forEach((p, i) => {
    blocks.push(text(p));
    blocks.push(spacer(i === o.paragraphs.length - 1 ? 22 : 14));
  });
  blocks.push({
    id: id('button'),
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
      id: id('body'),
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
          id: id('section'),
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

/** The default MARKETING starters for a booking business — a welcome and a come-back /
 *  rebook, both installed as drafts (`publish: false`, like every blueprint email). The
 *  copy is booking-voiced but vertical-neutral (it reads right for a salon, a plumber, or
 *  a dentist alike) and the CTA points at the site's live `/book` page. */
function serviceEmails(_spec: ServiceSiteSpec): Record<string, unknown>[] {
  return [
    {
      name: 'Welcome',
      publish: false,
      doc: emailDoc('svc-welcome', {
        subject: 'Welcome to {{site.name}}',
        preheader: 'So glad you found us — here’s where to start.',
        heading: 'Welcome, {{customer.firstName}}',
        paragraphs: [
          'Thanks for choosing {{site.name}}. Whether this is your first visit or your fifth, we’re glad you’re here.',
          'Whenever you’re ready, booking online takes about a minute — you’ll see live availability and pick the time that works for you.',
        ],
        button: { label: 'Book an appointment', href: '{{site.url}}/book' },
      }),
    },
    {
      name: 'Time for your next visit',
      publish: false,
      doc: emailDoc('svc-rebook', {
        subject: 'Time for your next visit, {{customer.firstName}}?',
        preheader: 'Book your next appointment with {{site.name}}.',
        heading: 'We’d love to see you again',
        paragraphs: [
          'It’s been a little while, {{customer.firstName}}. Whenever you’re ready for your next visit, {{site.name}} is here for you.',
          'Pick a time that suits you — it only takes a minute, and you’ll always see the latest availability.',
        ],
        button: { label: 'Book your next visit', href: '{{site.url}}/book' },
      }),
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════════
// THE SECTION KIT — the authoring vocabulary a service blueprint composes its pages
// from. Every builder returns a silica `Node` of NAMED Tailwind utilities (an arbitrary
// value emits nothing once stamped into a tenant's tree), on silica base-surface tokens
// so it re-themes per install. Tenant content, so a builder may hot-link a real photo,
// use a background image + overlay, and lean on the bespoke theme's fonts.
// ════════════════════════════════════════════════════════════════════════════════

/** Money → a display string, e.g. 6500 → "$65". Whole dollars drop the cents. */
export function price(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Minutes → a human duration, e.g. 90 → "1 hr 30 min", 45 → "45 min". */
export function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

interface Cta {
  label: string;
  href: string;
}

/** A FULL-BLEED PHOTO HERO — an edge-to-edge photograph under a legibility overlay, with
 *  the headline, one line of subhead and one or two calls to action stacked over it. The
 *  workhorse opening beat for a place a visitor walks into. */
export function photoHero(o: {
  image: string;
  alt: string;
  eyebrow?: string;
  title: string;
  sub?: string;
  primary: Cta;
  secondary?: Cta;
  /** Content anchor within the band. Default center. */
  align?: 'center' | 'start';
  /** Overlay strength for text legibility (white ink sits over it). Default 'dark'. */
  overlay?: 'dark' | 'darker' | 'soft';
}): Node {
  const overlayClass =
    o.overlay === 'darker'
      ? 'bg-black/65'
      : o.overlay === 'soft'
        ? 'bg-black/30'
        : 'bg-black/50';
  const alignItems = o.align === 'start' ? 'items-start text-left' : 'items-center text-center';
  return el('section', 'relative @container overflow-hidden', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: o.image, alt: o.alt, loading: 'eager' },
      }),
      el('div', `absolute inset-0 ${overlayClass}`, {}),
      el(
        'div',
        `relative mx-auto flex min-h-96 w-full max-w-5xl flex-col justify-center gap-6 px-6 py-28 text-white @3xl:py-40 ${alignItems}`,
        {
          children: [
            ...(o.eyebrow
              ? [
                  el('p', 'text-sm font-semibold uppercase tracking-widest', {
                    text: o.eyebrow,
                  }),
                ]
              : []),
            el(
              'h1',
              'max-w-3xl text-4xl font-bold leading-tight tracking-tight @2xl:text-5xl @3xl:text-6xl',
              { text: o.title }
            ),
            ...(o.sub
              ? [el('p', 'max-w-2xl text-lg leading-relaxed @2xl:text-xl', { text: o.sub })]
              : []),
            el(
              'div',
              `mt-2 flex flex-wrap gap-3 ${o.align === 'start' ? 'justify-start' : 'justify-center'}`,
              {
                children: [
                  el('a', 'btn btn-primary btn-lg', {
                    attrs: { href: o.primary.href },
                    text: o.primary.label,
                  }),
                  ...(o.secondary
                    ? [
                        el('a', 'btn btn-outline btn-lg', {
                          attrs: { href: o.secondary.href },
                          text: o.secondary.label,
                        }),
                      ]
                    : []),
                ],
              }
            ),
          ],
        }
      ),
    ],
  });
}

/** A TYPE-FIRST HERO — no photo, a bold typographic statement on a surface (or the brand
 *  primary), for a studio that leads with attitude over imagery. */
export function typeHero(o: {
  eyebrow?: string;
  title: string;
  sub?: string;
  primary: Cta;
  secondary?: Cta;
  surface?: 'base' | 'muted' | 'primary';
}): Node {
  const bg =
    o.surface === 'primary'
      ? 'bg-primary text-primary-content'
      : o.surface === 'muted'
        ? 'bg-base-200'
        : 'bg-base-100';
  const ink = o.surface === 'primary' ? '' : 'text-base-content';
  return el('section', `${bg} @container px-6 py-24 @3xl:py-32`, {
    children: [
      el('div', `mx-auto flex w-full max-w-4xl flex-col items-start gap-6 ${ink}`, {
        children: [
          ...(o.eyebrow
            ? [
                el('p', 'text-sm font-semibold uppercase tracking-widest opacity-80', {
                  text: o.eyebrow,
                }),
              ]
            : []),
          el(
            'h1',
            'text-5xl font-bold leading-none tracking-tight @2xl:text-6xl @3xl:text-7xl',
            { text: o.title }
          ),
          ...(o.sub
            ? [el('p', 'max-w-2xl text-lg leading-relaxed @2xl:text-xl', { text: o.sub })]
            : []),
          el('div', 'mt-2 flex flex-wrap gap-3', {
            children: [
              el('a', 'btn btn-primary btn-lg', {
                attrs: { href: o.primary.href },
                text: o.primary.label,
              }),
              ...(o.secondary
                ? [
                    el('a', 'btn btn-outline btn-lg', {
                      attrs: { href: o.secondary.href },
                      text: o.secondary.label,
                    }),
                  ]
                : []),
            ],
          }),
        ],
      }),
    ],
  });
}

interface MenuItem {
  name: string;
  priceCents: number;
  durationMin: number;
  desc?: string;
}

/** A STATIC SERVICE MENU — priced, timed cards a visitor scans before booking. Mirrors
 *  the scheduling menu the blueprint also provisions (a template authors both; the tenant
 *  edits both). Each card links to /book, where the live time-picker takes over. */
export function serviceMenu(o: {
  heading?: string;
  intro?: string;
  items: MenuItem[];
  cta?: Cta;
  surface?: 'base' | 'muted';
  columns?: 2 | 3;
}): Node {
  const bg = o.surface === 'muted' ? 'bg-base-200' : 'bg-base-100';
  const cols = o.columns === 3 ? '@2xl:grid-cols-3' : '@2xl:grid-cols-2';
  // Sub-item heading level adapts so the page outline never skips: an h3 under this
  // section's h2 heading, or an h2 when the section itself carries no heading.
  const itemTag = o.heading ? 'h3' : 'h2';
  return el('section', `${bg} @container px-6 py-16 @3xl:py-20`, {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
        children: [
          ...(o.heading || o.intro
            ? [
                el('div', 'flex flex-col gap-3', {
                  children: [
                    ...(o.heading
                      ? [
                          el(
                            'h2',
                            'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl',
                            { text: o.heading }
                          ),
                        ]
                      : []),
                    ...(o.intro
                      ? [
                          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                            text: o.intro,
                          }),
                        ]
                      : []),
                  ],
                }),
              ]
            : []),
          el('div', `grid grid-cols-1 gap-4 ${cols}`, {
            children: o.items.map((it) =>
              el('a', 'flex flex-col gap-2 border border-base-300 bg-base-100 p-6', {
                attrs: { href: '/book' },
                children: [
                  el('div', 'flex items-baseline justify-between gap-4', {
                    children: [
                      el(itemTag, 'text-xl font-semibold text-base-content', { text: it.name }),
                      // A price is DATA to read — a real ink token, never the accent (which
                      // fails contrast on a light ground and is caught by the sweep).
                      el('span', 'shrink-0 text-lg font-bold text-base-content', {
                        text: price(it.priceCents),
                      }),
                    ],
                  }),
                  el('p', 'text-sm font-medium uppercase tracking-wide text-secondary', {
                    text: duration(it.durationMin),
                  }),
                  ...(it.desc
                    ? [
                        el('p', 'text-base leading-relaxed text-base-content', { text: it.desc }),
                      ]
                    : []),
                ],
              })
            ),
          }),
          ...(o.cta
            ? [
                el('div', 'flex', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', {
                      attrs: { href: o.cta.href },
                      text: o.cta.label,
                    }),
                  ],
                }),
              ]
            : []),
        ],
      }),
    ],
  });
}

/** A THREE-UP VALUE ROW — the reasons to choose this place (licensed, walk-ins, aftercare…),
 *  each a short heading + a line. Trust, scannable. */
export function featureRow(o: {
  heading?: string;
  items: { title: string; body: string }[];
  surface?: 'base' | 'muted';
}): Node {
  const bg = o.surface === 'muted' ? 'bg-base-200' : 'bg-base-100';
  const itemTag = o.heading ? 'h3' : 'h2';
  return el('section', `${bg} @container px-6 py-16 @3xl:py-20`, {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
        children: [
          ...(o.heading
            ? [
                el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                  text: o.heading,
                }),
              ]
            : []),
          el('div', 'grid grid-cols-1 gap-8 @2xl:grid-cols-3', {
            children: o.items.map((it) =>
              el('div', 'flex flex-col gap-2', {
                children: [
                  el(itemTag, 'text-xl font-semibold text-base-content', { text: it.title }),
                  el('p', 'text-base leading-relaxed text-base-content', { text: it.body }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
  });
}

/** A SPLIT FEATURE — a photograph beside a block of text (about teaser, a signature
 *  service), reversible so a sequence of them alternates sides. */
export function splitFeature(o: {
  image: string;
  alt: string;
  heading: string;
  body: string[];
  cta?: Cta;
  reverse?: boolean;
  surface?: 'base' | 'muted';
}): Node {
  const bg = o.surface === 'muted' ? 'bg-base-200' : 'bg-base-100';
  return el('section', `${bg} @container px-6 py-16 @3xl:py-24`, {
    children: [
      el(
        'div',
        `mx-auto grid w-full max-w-5xl items-center gap-10 @3xl:grid-cols-2 @3xl:gap-16`,
        {
          children: [
            el('img', `aspect-video w-full bg-base-200 object-cover ${o.reverse ? '@3xl:order-2' : ''}`, {
              attrs: { src: o.image, alt: o.alt, loading: 'lazy' },
            }),
            el('div', 'flex flex-col gap-5', {
              children: [
                el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                  text: o.heading,
                }),
                ...o.body.map((t) =>
                  el('p', 'text-lg leading-relaxed text-base-content', { text: t })
                ),
                ...(o.cta
                  ? [
                      el('div', 'mt-1', {
                        children: [
                          el('a', 'btn btn-primary btn-lg', {
                            attrs: { href: o.cta.href },
                            text: o.cta.label,
                          }),
                        ],
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** A TEAM ROW — the people, each a portrait, a name, a role and a line of bio. The staff
 *  a client books; the human proof a service business runs on. */
export function teamRow(o: {
  heading?: string;
  intro?: string;
  members: { name: string; role: string; image: string; alt: string; bio?: string }[];
  surface?: 'base' | 'muted';
}): Node {
  const bg = o.surface === 'muted' ? 'bg-base-200' : 'bg-base-100';
  const nameTag = o.heading ? 'h3' : 'h2';
  return el('section', `${bg} @container px-6 py-16 @3xl:py-20`, {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
        children: [
          ...(o.heading || o.intro
            ? [
                el('div', 'flex flex-col gap-3', {
                  children: [
                    ...(o.heading
                      ? [
                          el(
                            'h2',
                            'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl',
                            { text: o.heading }
                          ),
                        ]
                      : []),
                    ...(o.intro
                      ? [
                          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                            text: o.intro,
                          }),
                        ]
                      : []),
                  ],
                }),
              ]
            : []),
          el('div', 'grid grid-cols-1 gap-8 @sm:grid-cols-2 @3xl:grid-cols-3', {
            children: o.members.map((m) =>
              el('div', 'flex flex-col gap-3', {
                children: [
                  el('img', 'aspect-square w-full bg-base-200 object-cover', {
                    attrs: { src: m.image, alt: m.alt, loading: 'lazy' },
                  }),
                  el('div', 'flex flex-col gap-1', {
                    children: [
                      el(nameTag, 'text-lg font-semibold text-base-content', { text: m.name }),
                      el('p', 'text-sm font-medium uppercase tracking-wide text-secondary', {
                        text: m.role,
                      }),
                      ...(m.bio
                        ? [
                            el('p', 'text-base leading-relaxed text-base-content', { text: m.bio }),
                          ]
                        : []),
                    ],
                  }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
  });
}

/** A GALLERY STRIP — a grid of real work. The portfolio a visitor judges the place by. */
export function galleryStrip(o: {
  heading?: string;
  images: { src: string; alt: string }[];
  surface?: 'base' | 'muted';
  columns?: 3 | 4;
}): Node {
  const bg = o.surface === 'muted' ? 'bg-base-200' : 'bg-base-100';
  const cols = o.columns === 4 ? '@2xl:grid-cols-4' : '@2xl:grid-cols-3';
  return el('section', `${bg} @container px-6 py-16 @3xl:py-20`, {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
        children: [
          ...(o.heading
            ? [
                el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                  text: o.heading,
                }),
              ]
            : []),
          el('div', `grid grid-cols-2 gap-3 ${cols}`, {
            children: o.images.map((im) =>
              el('img', 'aspect-square w-full bg-base-200 object-cover', {
                attrs: { src: im.src, alt: im.alt, loading: 'lazy' },
              })
            ),
          }),
        ],
      }),
    ],
  });
}

/** A TESTIMONIAL — one quote, attributed, on a quiet band. Social proof without a wall. */
export function testimonial(o: {
  quote: string;
  attribution: string;
  surface?: 'base' | 'muted' | 'primary';
}): Node {
  const bg =
    o.surface === 'primary'
      ? 'bg-primary text-primary-content'
      : o.surface === 'muted'
        ? 'bg-base-200'
        : 'bg-base-100';
  const ink = o.surface === 'primary' ? '' : 'text-base-content';
  return el('section', `${bg} @container px-6 py-20 @3xl:py-24`, {
    children: [
      el('div', `mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center ${ink}`, {
        children: [
          el('p', 'text-2xl font-medium leading-snug @3xl:text-3xl', { text: `“${o.quote}”` }),
          el('p', 'text-sm font-semibold uppercase tracking-wide opacity-80', {
            text: o.attribution,
          }),
        ],
      }),
    ],
  });
}

/** A BOOKING CTA BAND — the whole reason the site exists, in one confident band. */
export function bookingCta(o: {
  title: string;
  sub?: string;
  cta?: Cta;
  surface?: 'primary' | 'muted';
}): Node {
  const bg =
    o.surface === 'muted' ? 'bg-base-200 text-base-content' : 'bg-primary text-primary-content';
  const btn = o.surface === 'muted' ? 'btn btn-primary btn-lg' : 'btn btn-neutral btn-lg';
  return el('section', `${bg} @container px-6 py-20 @3xl:py-24`, {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight @3xl:text-4xl', { text: o.title }),
          ...(o.sub
            ? [el('p', 'max-w-xl text-lg leading-relaxed opacity-90', { text: o.sub })]
            : []),
          el('a', btn, {
            attrs: { href: o.cta?.href ?? '/book' },
            text: o.cta?.label ?? 'Book online',
          }),
        ],
      }),
    ],
  });
}

/** A HOURS + FIND-US band for the Contact page — opening hours as a list, the address, and
 *  a live `site.map` of the location (the tenant edits the address in the builder). */
export function findUs(o: {
  heading?: string;
  hours: { day: string; time: string }[];
  address: string[];
  mapLocation: string;
}): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2', {
        children: [
          el('div', 'flex flex-col gap-6', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: o.heading ?? 'Visit us',
              }),
              el('div', 'flex flex-col gap-1', {
                children: o.address.map((line) =>
                  el('p', 'text-lg leading-relaxed text-base-content', { text: line })
                ),
              }),
              el('div', 'flex flex-col gap-2', {
                children: o.hours.map((h) =>
                  el('div', 'flex items-baseline justify-between gap-6 border-b border-base-200 pb-1', {
                    children: [
                      el('span', 'font-medium text-base-content', { text: h.day }),
                      el('span', 'text-base-content', { text: h.time }),
                    ],
                  })
                ),
              }),
            ],
          }),
          hostCore(HOST_KEYS.siteMap, 'w-full', {
            location: o.mapLocation,
            title: 'Find us',
            zoom: 15,
            ratio: 'classic',
          }),
        ],
      }),
    ],
  });
}

// ── Neutral defaults (Book intro / About / Contact) ─────────────────────────────

/** A plain, editable Book-page masthead when a template authors none — a heading + one
 *  line over the pinned live services core. */
function defaultBookIntro(spec: ServiceSiteSpec): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-4', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-3', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
            text: 'Book an appointment',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: `Choose a service below to see live availability and book your time with ${spec.brand.businessName}. Pick a day that works, and you’re set.`,
          }),
        ],
      }),
    ],
  });
}

function defaultAbout(spec: ServiceSiteSpec): Node {
  return el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: `About ${spec.brand.businessName}`,
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'This is your story — who you are, the work you do, and why people keep coming back. Replace this with a few honest sentences; the people booking with you want to know the human behind it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Add photos, your team, and your hours from the builder. This page grows with you.',
          }),
        ],
      }),
    ],
  });
}

function defaultContact(spec: ServiceSiteSpec): Node {
  return el('section', 'bg-base-100 @container px-6 py-20 text-center', {
    children: [
      el('div', 'mx-auto flex w-full max-w-xl flex-col items-center gap-5', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'Get in touch',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: `Questions before you book? Reach ${spec.brand.businessName} — we’ll get back to you quickly.`,
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: '/book' },
            text: 'Book online',
          }),
        ],
      }),
    ],
  });
}
