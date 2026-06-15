// Brand-governed ARCHETYPES (docs/61 §6 Phase 6b) — the persisted contract for a
// curated section/layout STARTING POINT a user stamps onto a page. Stamping forks
// a COPY of `tree` (fresh ids) into the page, so an archetype is plain data: a
// named node subtree with NO versioning and NO references (unlike a tenant
// component, which is a live `custom:<key>` placement). Zod-only (no DB, no React),
// like the rest of @sparx/builder-schemas — safe to import from the editor's
// client components AND the server service layer.

import { z } from 'zod';
import { seedNode, type BoxStyle, type LayoutStyle } from './box-to-class';
import { BuilderNodeSchema, type BuilderNode } from './node';
import { ComponentSurface } from './component';

// ── Key, family, source ───────────────────────────────────────────────────────

export const ARCHETYPE_KEY_MAX = 64;
export const ArchetypeKey = z
  .string()
  .min(1)
  .max(ARCHETYPE_KEY_MAX)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.');
export type ArchetypeKey = z.infer<typeof ArchetypeKey>;

/** Layout families — a loose vocabulary stored as a plain string (a new family
 *  needs no migration). Known families autocomplete; any string is accepted. */
export const ARCHETYPE_FAMILIES = [
  'hero',
  'feature',
  'cta',
  'gallery',
  'testimonial',
  'content',
  'header',
  'footer',
] as const;
export type ArchetypeFamily = (typeof ARCHETYPE_FAMILIES)[number];

export const ARCHETYPE_SOURCES = ['platform', 'tenant'] as const;
export type ArchetypeSource = (typeof ARCHETYPE_SOURCES)[number];

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** An archetype without its tree — the catalog row. */
export interface ArchetypeSummaryDto {
  id: string;
  key: string;
  name: string;
  family: string;
  icon: string;
  description: string | null;
  surfaces: ComponentSurface[];
  source: ArchetypeSource;
  enabled: boolean;
  thumbnail: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** An archetype WITH its tree — what the Add palette stamps. */
export interface ArchetypeDto extends ArchetypeSummaryDto {
  tree: BuilderNode;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ───────────

export const CreateArchetypeInput = z.object({
  key: ArchetypeKey,
  name: z.string().min(1).max(120),
  family: z.string().min(1).max(32).default('content'),
  icon: z.string().max(64).default('box'),
  description: z.string().max(500).nullish(),
  surfaces: z.array(ComponentSurface).min(1).default(['page']),
  tree: BuilderNodeSchema,
  thumbnail: z.string().max(2048).nullish(),
});
export type CreateArchetypeInput = z.infer<typeof CreateArchetypeInput>;

export const UpdateArchetypeInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    family: z.string().min(1).max(32).optional(),
    icon: z.string().max(64).optional(),
    description: z.string().max(500).nullish(),
    surfaces: z.array(ComponentSurface).min(1).optional(),
    tree: BuilderNodeSchema.optional(),
    thumbnail: z.string().max(2048).nullish(),
    enabled: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdateArchetypeInput = z.infer<typeof UpdateArchetypeInput>;

// ── Platform default archetypes (seeded lazily on a tenant's first list) ───────
// Curated, brand-neutral SECTION starting points authored with the same box/layout
// DTO the starters use (compiled to a Tailwind-native `class` string by seedNode).
// STATIC by default — no data bindings — so a stamped section renders on any page
// regardless of which modules are on; the author edits the placeholder content.
// No "eyebrow" kicker labels (house rule): hierarchy comes from scale + weight.

let n = 0;
const sid = (t: string): string => `arch-${t}-${(n += 1)}`;

function node(
  type: string,
  opts: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  return seedNode(sid(type), type, opts);
}

function heroCentered(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Hero',
      height: 'lg',
      surface: 'muted',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'md', justify: 'center', alignItems: 'center' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'A bold headline that says what you do' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A supporting sentence that adds context and invites the visitor to take the next step.',
        },
      }),
      node('Button', { props: { label: 'Get started', style: 'primary' } }),
    ],
  });
}

function heroSplit(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Hero — split',
      surface: 'none',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      padding: 'xl',
    },
    layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
    children: [
      node('Stack', {
        box: { name: 'Copy', padding: 'none' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Tell your story, side by side' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Pair a clear message with a supporting image. Edit both to match your brand.',
            },
          }),
          node('Button', { props: { label: 'Learn more', style: 'primary' } }),
        ],
      }),
      node('Image', { box: { name: 'Image' }, props: { ratio: 'wide', alt: '' } }),
    ],
  });
}

function featureGrid(): BuilderNode {
  const card = (title: string): BuilderNode =>
    node('Card', {
      box: { name: 'Feature', surface: 'subtle', padding: 'lg' },
      layout: { direction: 'stack', gap: 'sm' },
      children: [
        node('Heading', { props: { level: 'h3', text: title } }),
        node('Text', {
          props: {
            variant: 'body',
            text: 'A sentence or two describing this feature and the value it delivers.',
          },
        }),
      ],
    });
  return node('Section', {
    box: { name: 'Features', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Heading', { props: { level: 'h2', text: 'Everything you need' } }),
      node('Grid', {
        box: { name: 'Feature grid', padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        children: [card('First feature'), card('Second feature'), card('Third feature')],
      }),
    ],
  });
}

function metricsRow(): BuilderNode {
  const metric = (value: string, label: string): BuilderNode =>
    node('Stack', {
      box: { name: 'Metric', padding: 'md', align: 'center' },
      layout: { direction: 'stack', gap: 'sm', alignItems: 'center' },
      children: [
        node('Heading', { props: { level: 'h2', text: value } }),
        node('Text', { props: { variant: 'meta', text: label } }),
      ],
    });
  return node('Section', {
    box: { name: 'Metrics', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'grid', columns: 3, gap: 'lg' },
    children: [metric('10k+', 'Customers'), metric('99.9%', 'Uptime'), metric('24/7', 'Support')],
  });
}

function ctaBand(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Call to action',
      surface: 'inverse',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      align: 'center',
      padding: 'xl',
    },
    layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
    children: [
      node('Heading', { props: { level: 'h2', text: 'Ready to get started?' } }),
      node('Text', {
        props: { variant: 'body', text: 'A short, confident nudge toward the next step.' },
      }),
      node('Button', { props: { label: 'Start now', style: 'primary' } }),
    ],
  });
}

function faqSection(): BuilderNode {
  const item = (q: string): BuilderNode =>
    node('Stack', {
      box: { name: 'Question', padding: 'none' },
      layout: { direction: 'stack', gap: 'sm' },
      children: [
        node('Heading', { props: { level: 'h3', text: q } }),
        node('Text', {
          props: {
            variant: 'body',
            text: 'A clear, concise answer that resolves the question and builds confidence.',
          },
        }),
      ],
    });
  return node('Section', {
    box: { name: 'FAQ', padding: 'xl', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Heading', { props: { level: 'h2', text: 'Frequently asked questions' } }),
      node('Stack', {
        box: { name: 'Questions', padding: 'none' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          item('What does this include?'),
          item('How does pricing work?'),
          item('Can I change plans later?'),
        ],
      }),
    ],
  });
}

function footerSection(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Footer',
      surface: 'muted',
      backgroundWidth: 'full',
      contentWidth: 'contained',
      padding: 'lg',
    },
    layout: { direction: 'row', justify: 'between', alignItems: 'center' },
    children: [
      node('Text', { props: { variant: 'meta', text: '© Your brand' } }),
      node('Text', { props: { variant: 'meta', text: 'Built with Sparx' } }),
    ],
  });
}

export interface PlatformArchetype {
  key: string;
  name: string;
  family: ArchetypeFamily;
  icon: string;
  description: string;
  surfaces: ComponentSurface[];
  tree: BuilderNode;
}

/** Built ONCE at module load — the `node()` id counter runs to completion here,
 *  giving each archetype tree a stable id sequence (cf. STARTER_PAGES). Never
 *  mutated. The service seeds these as `source:'platform'` rows on a tenant's
 *  first list; from then on they're ordinary catalog rows the brand-designer can
 *  enable/disable, edit, or delete. */
export const PLATFORM_ARCHETYPES: PlatformArchetype[] = [
  {
    key: 'hero_centered',
    name: 'Hero — centered',
    family: 'hero',
    icon: 'sparkles',
    description: 'A bold centered headline, supporting text, and a primary call to action.',
    surfaces: ['page', 'site'],
    tree: heroCentered(),
  },
  {
    key: 'hero_split',
    name: 'Hero — split',
    family: 'hero',
    icon: 'columns-2',
    description: 'A two-column hero pairing a message with a supporting image.',
    surfaces: ['page', 'site'],
    tree: heroSplit(),
  },
  {
    key: 'feature_grid',
    name: 'Feature grid',
    family: 'feature',
    icon: 'layout-grid',
    description: 'A three-up grid of features, each with a heading and short description.',
    surfaces: ['page', 'site'],
    tree: featureGrid(),
  },
  {
    key: 'metrics_row',
    name: 'Metrics row',
    family: 'feature',
    icon: 'bar-chart-3',
    description: 'Three headline numbers with labels — proof points at a glance.',
    surfaces: ['page', 'site'],
    tree: metricsRow(),
  },
  {
    key: 'cta_band',
    name: 'Call-to-action band',
    family: 'cta',
    icon: 'megaphone',
    description: 'A full-width accented band with a heading, nudge, and button.',
    surfaces: ['page', 'site'],
    tree: ctaBand(),
  },
  {
    key: 'faq',
    name: 'FAQ',
    family: 'content',
    icon: 'help-circle',
    description: 'A stacked list of questions and answers.',
    surfaces: ['page', 'site'],
    tree: faqSection(),
  },
  {
    key: 'footer_simple',
    name: 'Footer — simple',
    family: 'footer',
    icon: 'panel-bottom',
    description: 'A simple footer row with copyright and a tagline.',
    surfaces: ['page', 'site'],
    tree: footerSection(),
  },
];
