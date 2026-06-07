// A SaaS "team workspace" marketing site (docs/54) — the iconic clean/light
// workspace look (whitespace-heavy hero, alternating feature panels, a feature
// grid, stats, a testimonial, a pricing teaser, a resources blog, and a final
// CTA band). Fictional brand "Mosaic". NO commerce — pricing is a STATIC teaser
// section, not a catalog — so this is the first `content`-vertical blueprint:
// requiresModules = builder + cms + email. Everything installs to DRAFT (docs/54
// D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes (learned from the renderer, apps/site/components/builder-renderer):
//   · Static tree imagery MUST ride box.backgroundImage on a `backgroundWidth:'full'`
//     section with a height — an UNBOUND ImageDisplay renders nothing (it only
//     paints a *bound* record image). Record imagery (blog featuredImage) binds.
//   · The hero + feature-panel "screenshots" are NODE-BUILT faux UI on Notion's
//     soft color tints (NOT photos) — the look the mockup nails. Tints ride
//     box.backgroundImage as a 1×1 solid-color SVG data URI (see `tint`), so a
//     panel is a real color block with no external image. Only the blog
//     thumbnails hot-link a real photo (picsum) — appropriate for article cards.
//   · No `Signup` leaf (the renderer returns null for it) and no `eyebrow` Text
//     variant (the platform no-eyebrows rule) — hierarchy is scale/weight/color.
//   · `surface` is token-paired: none(transparent) · subtle(base-200) ·
//     muted(base-300) · inverse(base-content bg / base-100 fg) · brand(primary).

import {
  DEFAULT_BOX,
  DEFAULT_LAYOUT,
  type BoxBase,
  type BuilderNode,
  type LayoutBase,
} from '@sparx/builder-schemas';

import type { Blueprint } from '../manifest';
import { assetRef } from '../refs';
import { parseBlueprint } from '../validate';

// ── Tree authoring helpers (mirror builder-schemas/starters.ts) ────────────────

let nid = 0;
const rid = (t: string): string => `mw-${t}-${(nid += 1)}`;
const box = (o: Partial<BoxBase> = {}): BoxBase => ({ ...DEFAULT_BOX, ...o });
const lay = (o: Partial<LayoutBase> = {}): LayoutBase => ({ ...DEFAULT_LAYOUT, ...o });

function node(
  type: string,
  opts: {
    box?: Partial<BoxBase>;
    layout?: Partial<LayoutBase>;
    props?: Record<string, unknown>;
    bind?: string;
    /** docs/47 class-first chrome (e.g. 'bx-card' / 'bx-panel') applied verbatim. */
    cls?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  const out: BuilderNode = { id: rid(type), type, box: box(opts.box), props: opts.props ?? {} };
  if (opts.layout) out.layout = lay(opts.layout);
  if (opts.bind) out.binding = { path: opts.bind };
  if (opts.cls) out.class = opts.cls;
  if (opts.children) out.children = opts.children;
  return out;
}

/** A minimal TipTap rich-text doc from plain paragraphs (content_entries.body). */
const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

/** A deterministic placeholder PHOTO (hot-linked; docs/54 §6 D3) — used only for
 *  blog thumbnails, where a real image is the right call. */
const pic = (seed: string, w = 1200, h = 900): string =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** A flat color panel as a 1×1 solid-color SVG data URI (Notion's soft tints).
 *  Rides box.backgroundImage (stretched cover → a solid block) with NO external
 *  request. `hex` is the 6-digit color WITHOUT the leading # (encoded as %23 so
 *  the data URI stays a valid url()). The renderer strips only " and \, so the
 *  single-quoted SVG attributes survive intact. */
const tint = (hex: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23${hex}'/%3E%3C/svg%3E`;

// Notion's soft block palette + a true white for the floating cards.
const TINT = {
  coral: 'FFF1EC',
  mint: 'ECF8F1',
  violet: 'F1EEFE',
  sky: 'EAF3FF',
  amber: 'FFF7E6',
  white: 'FFFFFF',
} as const;

// ── Faux-UI building blocks (the "screenshots", built from nodes) ──────────────

/** A floating white "card" inside a tinted panel — the mockup's pcard (rounded,
 *  soft shadow via the bx-card chrome; white via a solid-color bg). */
function card(children: BuilderNode[]): BuilderNode {
  return node('Section', {
    box: {
      backgroundWidth: 'full',
      contentWidth: 'full',
      padding: 'md',
      backgroundImage: tint(TINT.white),
    },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    cls: 'bx-card',
    children,
  });
}

/** Docs panel mock: a doc card + an AI-assist card. */
function docsMock(): BuilderNode {
  return node('Stack', {
    box: { padding: 'none' },
    layout: { direction: 'stack', gap: 'sm' },
    children: [
      card([
        node('Heading', { props: { level: 'h3', text: 'Product brief' } }),
        node('Text', {
          props: { variant: 'body', text: 'Goals, scope, and timeline — all on one page.' },
        }),
        node('Text', {
          props: { variant: 'meta', text: 'Shared with 4 people · edited just now' },
        }),
      ]),
      card([
        node('Text', { props: { variant: 'body', text: '✨  Ask Mosaic AI' } }),
        node('Text', { props: { variant: 'meta', text: 'Summarize this doc →' } }),
      ]),
    ],
  });
}

/** Projects panel mock: a sprint card with a checklist. */
function projectsMock(): BuilderNode {
  return card([
    node('Heading', { props: { level: 'h3', text: 'Sprint 14' } }),
    node('Text', { props: { variant: 'body', text: '✓  Ship onboarding revamp' } }),
    node('Text', { props: { variant: 'body', text: '✓  Draft Q3 planning doc' } }),
    node('Text', { props: { variant: 'body', text: '○  Review design handoff' } }),
    node('Text', { props: { variant: 'body', text: '○  Sync with partnerships' } }),
  ]);
}

/** Knowledge panel mock: a wiki nav card. */
function wikiMock(): BuilderNode {
  return card([
    node('Heading', { props: { level: 'h3', text: 'Company wiki' } }),
    node('Text', { props: { variant: 'body', text: 'Getting started' } }),
    node('Text', { props: { variant: 'body', text: 'Engineering' } }),
    node('Text', { props: { variant: 'body', text: 'People ops' } }),
    node('Text', { props: { variant: 'body', text: 'Brand & assets' } }),
  ]);
}

// ── Reusable section builders ──────────────────────────────────────────────────

/** A 50/50 feature panel: a copy column and a tinted "screenshot" column built
 *  from nodes. `flip` puts the visual on the left. A Grid (not a row) so the
 *  visual cell keeps half the width regardless of its content. */
function featureSplit(opts: {
  heading: string;
  body: string;
  linkLabel: string;
  tintHex: string;
  mock: BuilderNode;
  flip?: boolean;
  surface?: BoxBase['surface'];
}): BuilderNode {
  const copy = node('Stack', {
    box: { padding: 'lg', align: 'start' },
    layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h2', text: opts.heading } }),
      node('Text', { props: { variant: 'body', text: opts.body } }),
      node('Button', { props: { label: opts.linkLabel, style: 'link', href: '/' } }),
    ],
  });
  const visual = node('Section', {
    box: {
      name: 'Panel',
      height: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'full',
      padding: 'lg',
      backgroundImage: tint(opts.tintHex),
    },
    layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'stretch' },
    cls: 'bx-panel',
    children: [opts.mock],
  });
  return node('Section', {
    box: {
      name: opts.heading,
      surface: opts.surface ?? 'none',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Grid', {
        box: { padding: 'none' },
        layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'stretch' },
        children: opts.flip ? [visual, copy] : [copy, visual],
      }),
    ],
  });
}

/** The hero "product screenshot": a clean Notion-style doc card with colored
 *  tiles — node-built (rounded, shadowed via bx-card) instead of a stock photo.
 *  Sits inside the full-height hero, beneath the headline. */
function heroPreviewCard(): BuilderNode {
  const tile = (label: string, hex: string): BuilderNode =>
    node('Section', {
      box: {
        backgroundWidth: 'full',
        contentWidth: 'full',
        padding: 'md',
        align: 'center',
        backgroundImage: tint(hex),
      },
      layout: { direction: 'stack', gap: 'none', justify: 'center', alignItems: 'center' },
      cls: 'bx-panel',
      children: [
        node('Text', { box: { align: 'center' }, props: { variant: 'body', text: label } }),
      ],
    });
  return node('Section', {
    box: {
      name: 'App preview',
      backgroundWidth: 'full',
      contentWidth: 'full',
      padding: 'lg',
      backgroundImage: tint(TINT.white),
    },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    cls: 'bx-card',
    children: [
      node('Heading', { props: { level: 'h3', text: 'Q3 Product Plan' } }),
      node('Text', { props: { variant: 'meta', text: 'Owner: Dana Okafor · Status: On track' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'body',
          text: 'This quarter we focus on three bets: faster onboarding, a connected wiki, and AI that drafts the first version of everything.',
        },
      }),
      node('Grid', {
        box: { padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'md' },
        children: [
          tile('📄  Docs', TINT.coral),
          tile('✓  Projects', TINT.mint),
          tile('📚  Wiki', TINT.violet),
        ],
      }),
    ],
  });
}

/** The 3-tier pricing teaser, reused on the home page and the /pricing page. */
function plansGrid(): BuilderNode {
  const plan = (opts: {
    name: string;
    price: string;
    unit: string;
    features: string[];
    cta: string;
    featured?: boolean;
  }): BuilderNode =>
    node('Card', {
      box: opts.featured
        ? {
            surface: 'brand',
            backgroundWidth: 'full',
            contentWidth: 'full',
            padding: 'lg',
            align: 'start',
          }
        : {
            backgroundWidth: 'full',
            contentWidth: 'full',
            padding: 'lg',
            align: 'start',
            backgroundImage: tint(TINT.white),
          },
      layout: { direction: 'stack', gap: 'sm', justify: 'start', alignItems: 'start' },
      cls: 'bx-card',
      children: [
        node('Heading', { props: { level: 'h3', text: opts.name } }),
        node('Heading', { props: { level: 'h2', text: opts.price } }),
        node('Text', { props: { variant: 'meta', text: opts.unit } }),
        ...opts.features.map((f) => node('Text', { props: { variant: 'body', text: `✓  ${f}` } })),
        node('Button', {
          props: { label: opts.cta, style: opts.featured ? 'glass' : 'primary', href: '/' },
        }),
      ],
    });
  return node('Grid', {
    box: { padding: 'none' },
    layout: { direction: 'grid', columns: 3, gap: 'lg', alignItems: 'stretch' },
    children: [
      plan({
        name: 'Free',
        price: '$0',
        unit: 'Free forever',
        features: ['Unlimited pages & blocks', 'Up to 10 guests', '7-day page history'],
        cta: 'Get started',
      }),
      plan({
        name: 'Plus',
        price: '$10',
        unit: 'per user / month',
        features: ['Everything in Free', 'Unlimited guests & history', 'Mosaic AI included'],
        cta: 'Start free trial',
        featured: true,
      }),
      plan({
        name: 'Business',
        price: '$18',
        unit: 'per user / month',
        features: ['Everything in Plus', 'SAML SSO & advanced security', 'Dedicated support'],
        cta: 'Contact sales',
      }),
    ],
  });
}

/** A 3-up "From the blog" teaser that iterates the seeded posts. */
function blogTeaser(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Resources',
      surface: 'subtle',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h2', text: 'From the blog' } }),
      node('Text', {
        props: { variant: 'body', text: 'Guides and ideas for working better, together.' },
      }),
      node('Grid', {
        box: { padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        bind: 'cms.blog_post',
        children: [
          node('Card', {
            box: { surface: 'none', padding: 'sm', align: 'start' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'item.featuredImage' }),
              node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
              node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  const featureCard = (heading: string, body: string): BuilderNode =>
    node('Card', {
      box: {
        backgroundWidth: 'full',
        contentWidth: 'full',
        padding: 'lg',
        align: 'start',
        backgroundImage: tint(TINT.white),
      },
      layout: { direction: 'stack', gap: 'sm' },
      cls: 'bx-card',
      children: [
        node('Heading', { props: { level: 'h3', text: heading } }),
        node('Text', { props: { variant: 'body', text: body } }),
      ],
    });

  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-viewport, centered headline + two CTAs + the product-preview
      // card, vertically centered (height 'full' = ~100vh). Each text node sets
      // its OWN align:'center' — a section's align doesn't cascade through the
      // per-node wrappers (each wrapper re-applies its box.align).
      node('Section', {
        box: {
          name: 'Hero',
          height: 'full',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'lg', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            box: { align: 'center' },
            props: {
              level: 'h1',
              size: 'display',
              text: 'One workspace for your docs, projects, and knowledge',
            },
          }),
          node('Text', {
            box: { align: 'center' },
            props: {
              variant: 'body',
              text: 'Mosaic brings your notes, wikis, and projects together — with an AI assistant that drafts, finds, and connects everything your team needs. Replace a dozen tools with one calm place to work.',
            },
          }),
          node('Stack', {
            box: { padding: 'none', align: 'center' },
            layout: { direction: 'row', gap: 'sm', justify: 'center', alignItems: 'center' },
            children: [
              node('Button', { props: { label: 'Get Mosaic free', style: 'primary', href: '/' } }),
              node('Button', {
                props: { label: 'Request a demo', style: 'soft', href: '/contact' },
              }),
            ],
          }),
          node('Text', {
            box: { align: 'center' },
            props: { variant: 'meta', text: 'Free for individuals · No credit card required' },
          }),
          // PRODUCT PREVIEW — node-built Notion doc card (no photo), in-view in the hero.
          heroPreviewCard(),
        ],
      }),

      // LOGO CLOUD — a muted line over a wrapping row of names.
      node('Section', {
        box: {
          name: 'Logo cloud',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'lg',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Text', {
            props: { variant: 'meta', text: 'Powering focused teams at companies of every size' },
          }),
          node('Stack', {
            box: { padding: 'none', align: 'center' },
            layout: {
              direction: 'row',
              gap: 'lg',
              justify: 'center',
              alignItems: 'center',
              wrap: true,
            },
            children: [
              node('Heading', { props: { level: 'h3', text: 'Northwind' } }),
              node('Heading', { props: { level: 'h3', text: 'Brightline' } }),
              node('Heading', { props: { level: 'h3', text: 'Meridian' } }),
              node('Heading', { props: { level: 'h3', text: 'Atlas Labs' } }),
              node('Heading', { props: { level: 'h3', text: 'Foundry' } }),
              node('Heading', { props: { level: 'h3', text: 'Lumen' } }),
            ],
          }),
        ],
      }),

      // FEATURE SPLITS — alternating copy / tinted-panel mocks.
      featureSplit({
        heading: 'Docs that practically write themselves',
        body: 'Start with a blank page or ask Mosaic AI to draft it. Rich blocks, real-time editing, and version history keep every doc current — and beautiful.',
        linkLabel: 'Explore docs →',
        tintHex: TINT.coral,
        mock: docsMock(),
      }),
      featureSplit({
        heading: 'Projects, finally in sync',
        body: 'Plan sprints, track tasks, and see the whole roadmap in one view. Switch between board, timeline, and calendar without leaving the page.',
        linkLabel: 'Explore projects →',
        tintHex: TINT.mint,
        mock: projectsMock(),
        flip: true,
        surface: 'subtle',
      }),
      featureSplit({
        heading: 'One source of truth for the whole team',
        body: 'Wikis, policies, and onboarding live in a single connected workspace. Ask a question in plain language and Mosaic AI answers from everything you have written.',
        linkLabel: 'Explore the knowledge base →',
        tintHex: TINT.violet,
        mock: wikiMock(),
      }),

      // FEATURE GRID — six capability cards on white (subtle cards).
      node('Section', {
        box: {
          name: 'Everything you need',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'Everything your team needs, in one place' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Replace scattered tools with a single workspace that adapts to how you work.',
            },
          }),
          node('Grid', {
            box: { padding: 'none', align: 'start' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              featureCard(
                'Docs & notes',
                'Beautiful, block-based pages for everything from meeting notes to specs.'
              ),
              featureCard(
                'Projects',
                'Boards, timelines, and calendars that stay in sync across your team.'
              ),
              featureCard(
                'Wikis',
                'A connected knowledge base your whole company can actually find.'
              ),
              featureCard('Calendar', 'Plans, deadlines, and meetings tied directly to your work.'),
              featureCard(
                'Mosaic AI',
                'An assistant that drafts, answers, and automates across your workspace.'
              ),
              featureCard(
                'Integrations',
                'Connect the tools you already use — and bring their data into Mosaic.'
              ),
            ],
          }),
        ],
      }),

      // STATS — four headline numbers.
      node('Section', {
        box: {
          name: 'Stats',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'none' },
        children: [
          node('Grid', {
            box: { padding: 'none', align: 'center' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              node('Stat', {
                box: { align: 'center' },
                props: { value: '100k+', label: 'Teams onboard' },
              }),
              node('Stat', {
                box: { align: 'center' },
                props: { value: '12→1', label: 'Tools consolidated' },
              }),
              node('Stat', {
                box: { align: 'center' },
                props: { value: '4.8/5', label: 'Average rating' },
              }),
              node('Stat', {
                box: { align: 'center' },
                props: { value: '99.9%', label: 'Uptime, every month' },
              }),
            ],
          }),
        ],
      }),

      // TESTIMONIAL — a large centered quote on a subtle band.
      node('Section', {
        box: {
          name: 'Testimonial',
          surface: 'subtle',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', {
            props: {
              level: 'h2',
              text: '“We replaced four tools with Mosaic in a week. Our docs, projects, and wiki finally live in one place — and the team actually uses it.”',
            },
          }),
          node('Text', {
            props: { variant: 'body', text: 'Dana Okafor · Head of Operations, Brightline' },
          }),
        ],
      }),

      // PRICING TEASER.
      node('Section', {
        box: {
          name: 'Pricing',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Simple pricing that scales with you' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Start free. Upgrade when your team grows. Cancel anytime.',
            },
          }),
          plansGrid(),
        ],
      }),

      // BLOG TEASER — iterates the seeded posts.
      blogTeaser(),

      // CTA BAND — warm near-black (inverse), one frosted CTA.
      node('Section', {
        box: {
          name: 'CTA',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: "Your team's next workspace starts here" },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Get started free — bring your team in minutes, not months.',
            },
          }),
          node('Button', { props: { label: 'Get Mosaic free', style: 'glass', href: '/' } }),
        ],
      }),
    ],
  });
}

function pricingPageTree(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Pricing',
      padding: 'xl',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
    },
    layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Pricing' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Start free. Upgrade when your team grows. Cancel anytime.',
        },
      }),
      plansGrid(),
    ],
  });
}

function blogIndexTree(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Blog',
      padding: 'xl',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'start',
    },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Resources' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Guides, playbooks, and ideas for working better, together.',
        },
      }),
      node('Grid', {
        box: { padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        bind: 'cms.blog_post',
        children: [
          node('Card', {
            box: { surface: 'subtle', padding: 'md', align: 'start' },
            layout: { direction: 'stack', gap: 'sm' },
            children: [
              node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'item.featuredImage' }),
              node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
              node('Text', { props: { variant: 'body' }, bind: 'item.excerpt' }),
            ],
          }),
        ],
      }),
    ],
  });
}

function blogPostTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Blog post', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          surface: 'subtle',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { props: { level: 'h1' }, bind: 'blog_post.title' }),
          node('Text', { props: { variant: 'body' }, bind: 'blog_post.excerpt' }),
        ],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('ImageDisplay', { props: { ratio: 'wide' }, bind: 'blog_post.featuredImage' }),
          node('Prose', { bind: 'blog_post.body' }),
        ],
      }),
    ],
  });
}

function pageTemplateTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          surface: 'subtle',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [node('Heading', { props: { level: 'h1' }, bind: 'page.title' })],
      }),
      node('Section', {
        box: { name: 'Body', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [node('Prose', { bind: 'page.body' })],
      }),
    ],
  });
}

function siteLayoutTree(): BuilderNode {
  const navLinks = [
    { label: 'Product', href: '/' },
    { label: 'Solutions', href: '/' },
    { label: 'Resources', href: '/blog' },
    { label: 'Pricing', href: '/pricing' },
  ];
  const footCol = (title: string, links: { label: string; href: string }[]): BuilderNode =>
    node('Stack', {
      box: { padding: 'none', align: 'start' },
      layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
      children: [
        node('Heading', { props: { level: 'h3', text: title } }),
        node('NavMenu', { props: { orientation: 'stack', links } }),
      ],
    });

  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HEADER — logo, primary nav, and a CTA button.
      node('Section', {
        box: {
          name: 'Header',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'md',
        },
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Logo', { bind: 'site.identity' }),
          node('NavMenu', { props: { orientation: 'row', links: navLinks } }),
          node('Button', { props: { label: 'Get Mosaic free', style: 'primary', href: '/' } }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      // FOOTER — four link columns, then brand + social + copyright.
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'start' },
        children: [
          node('Grid', {
            box: { padding: 'none', align: 'start' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              footCol('Product', [
                { label: 'Docs', href: '/' },
                { label: 'Projects', href: '/' },
                { label: 'Wikis', href: '/' },
                { label: 'Pricing', href: '/pricing' },
              ]),
              footCol('Solutions', [
                { label: 'For startups', href: '/' },
                { label: 'For enterprise', href: '/' },
                { label: 'For personal use', href: '/' },
              ]),
              footCol('Resources', [
                { label: 'Blog', href: '/blog' },
                { label: 'Help center', href: '/' },
                { label: 'Templates', href: '/' },
              ]),
              footCol('Company', [
                { label: 'About', href: '/about' },
                { label: 'Careers', href: '/' },
                { label: 'Contact', href: '/contact' },
              ]),
            ],
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', {
            props: { variant: 'meta', text: '© Mosaic. One workspace for your whole team.' },
          }),
        ],
      }),
    ],
  });
}

// ── Email trees ────────────────────────────────────────────────────────────────

function welcomeEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Welcome to Mosaic 👋' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "You're in. Mosaic is one calm place for your docs, projects, and knowledge — here's how to get your team started.",
        },
      }),
      node('Button', {
        props: { label: 'Open your workspace', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Questions? Just reply to this email.' } }),
    ],
  });
}

function tipsEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Get more out of Mosaic' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Three quick wins for your first week: turn meeting notes into tasks, build a team wiki, and let Mosaic AI draft your next doc.',
        },
      }),
      node('Button', { props: { label: 'See the guides', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'You can manage email preferences anytime.' },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'notion-workspace',
  version: '0.1.0',
  name: 'Team Workspace + Docs',
  summary:
    'A polished SaaS landing site for an all-in-one team workspace — a whitespace-led hero, alternating feature sections, a feature grid, stats, a testimonial, a pricing teaser, and a resources blog, all in the clean Mosaic theme. No commerce; ready to review.',
  vertical: 'content' as const,
  preview: '/blueprint-previews/notion-workspace.png',
  requiresModules: ['builder', 'cms', 'email'] as const,

  brand: {
    businessName: 'Mosaic',
    tagline: 'One workspace for your docs, projects, and knowledge.',
    colors: {
      primary: '#1A1A18',
      primaryForeground: '#FFFFFF',
      accent: '#2E7CF6',
      secondary: '#2B2926',
    },
    fonts: { heading: 'Inter', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme the blueprint ships (docs/54 D5): a named SiteTheme over the
  // `apex` base preset. The `presentation.light` overlay sets the warm Notion
  // palette precisely — base-100 white page, base-200 the off-white panel
  // (surface:'subtle'), base-content the warm near-black (text + inverse band).
  theme: {
    name: 'Mosaic',
    basePresetKey: 'apex' as const,
    presentation: {
      v: 2 as const,
      containerWidth: '1140px',
      light: {
        base100: '#FFFFFF',
        base200: '#F7F6F3',
        base300: '#EFECE6',
        baseContent: '#2B2926',
      },
    },
    brand: {
      colorPrimary: '#1A1A18',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#2E7CF6',
      colorSecondary: '#2B2926',
      fontHeading: 'Inter',
      fontBody: 'Inter',
      tokens: { radiusBase: '12px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Mosaic&background=1A1A18&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Mosaic',
    },
    { id: 'blog-1-img', url: pic('mosaic-blog-wiki'), alt: 'A team wiki on a laptop' },
    { id: 'blog-2-img', url: pic('mosaic-blog-truth'), alt: 'Organized notes and documents' },
    { id: 'blog-3-img', url: pic('mosaic-blog-projects'), alt: 'A project board' },
  ],

  // Built-in content types only (page, blog_post) — no custom types.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'team-wiki-that-works',
      body: {
        title: 'How to build a team wiki people actually use',
        excerpt:
          'A wiki is only useful if it stays current. Here is how to structure one that does.',
        body: doc(
          'Most wikis fail the same way: they start strong, then drift out of date until nobody trusts them. The fix is structure, not effort.',
          'Start with a clear home page, give every team a single owner, and review a handful of pages each month. Keep entries short and link generously — a connected wiki is easier to maintain than a deep one.',
          'With Mosaic AI you can ask the wiki questions in plain language and get answers with sources, so stale pages surface themselves.'
        ),
        featuredImage: assetRef('blog-1-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'single-source-of-truth',
      body: {
        title: 'From scattered notes to a single source of truth',
        excerpt:
          'Consolidating tools is less about migration and more about a shared home for work.',
        body: doc(
          'When notes live in five apps, the real cost is not the subscriptions — it is the time spent deciding where something belongs.',
          'Pick one home for docs, projects, and knowledge, then move the highest-traffic content first. Momentum does the rest.',
          'A single workspace also means search, permissions, and AI all work across everything, instead of one silo at a time.'
        ),
        featuredImage: assetRef('blog-2-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'run-better-projects',
      body: {
        title: 'Run better projects in one workspace',
        excerpt:
          'Plans, tasks, and docs belong together. Here is a lightweight way to keep them in sync.',
        body: doc(
          'The best project setup is the one your team will actually keep updated. That usually means fewer fields and one view everyone trusts.',
          'Tie tasks to the docs that describe them, give each project a short status note, and let dashboards roll the rest up automatically.',
          'When the plan and the work live side by side, status meetings get shorter — and sometimes disappear.'
        ),
        featuredImage: assetRef('blog-3-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Mosaic',
        excerpt: 'One workspace for your whole team.',
        body: doc(
          'Mosaic started with a simple frustration: work was scattered across too many tools, and nobody could find anything.',
          'So we built one connected workspace for docs, projects, and knowledge — with AI that helps you write, find, and organize. Calm, fast, and made for teams.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact us',
        excerpt: 'Talk to the Mosaic team.',
        body: doc(
          'Email hello@mosaic.example and we will get back within a business day.',
          'For demos, security reviews, or enterprise plans, include a few details about your team and we will route you to the right person.'
        ),
      },
    },
  ],

  // No commerce — pricing is a static teaser section, not a catalog.

  components: [],

  layout: { name: 'Mosaic layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    {
      name: 'Home',
      kind: 'singleton' as const,
      tree: homeTree(),
      seoTitle: 'Mosaic — one workspace for your whole team',
    },
    { name: 'Pricing', kind: 'singleton' as const, slug: 'pricing', tree: pricingPageTree() },
    { name: 'Resources', kind: 'singleton' as const, slug: 'blog', tree: blogIndexTree() },
    {
      name: 'Blog post',
      kind: 'collection' as const,
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: blogPostTree(),
    },
    {
      name: 'Page',
      kind: 'collection' as const,
      recordType: 'cms.page',
      isDefault: true,
      tree: pageTemplateTree(),
    },
  ],

  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome to Mosaic 👋',
      preheader: "You're in — here's how to get your team started.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'Getting started tips',
      subject: 'Get more out of Mosaic',
      preheader: 'Three quick wins for your first week.',
      tree: tipsEmailTree(),
    },
  ],
};

/** The Mosaic "Team Workspace + Docs" blueprint, parsed + integrity-checked at
 *  module load so an invalid edit fails fast (and defaults are applied). */
export const notionWorkspace: Blueprint = parseBlueprint(manifest);
