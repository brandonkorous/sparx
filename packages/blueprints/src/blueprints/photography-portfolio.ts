// A photography portfolio blueprint (docs/54 §12, sibling of retail-store-blog.ts):
// a quiet, image-forward portfolio site for a documentary & portrait photographer
// — "Mara North Studio" — with project write-ups in the journal, an about page,
// a contact page, and a gallery-led home. No commerce — this is a pure content
// site. It exercises builder + cms + email. Everything installs to DRAFT
// (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · The home is deliberately image-led — full-bleed photos via box.backgroundImage
//     and a project grid bound to the journal posts.
//   · Project write-ups carry a featuredImage via an `{ $asset }` ref; the rest of
//     the imagery in trees hot-links a raw URL.

import {
  seedNode,
  type BoxStyle,
  type BuilderNode,
  type LayoutStyle,
} from '@sparx/builder-schemas';

import type { Blueprint } from '../manifest';
import { assetRef } from '../refs';
import { parseBlueprint } from '../validate';

// ── Tree authoring helpers (mirror builder-schemas/starters.ts) ────────────────

let nid = 0;
const rid = (t: string): string => `pho-${t}-${(nid += 1)}`;

function node(
  type: string,
  opts: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    bind?: string;
    /** Extra verbatim classes (e.g. an archetype/recipe seed). */
    cls?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  return seedNode(rid(type), type, opts);
}

/** A minimal TipTap rich-text doc from plain paragraphs (content_entries.body). */
const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

/** A deterministic placeholder image URL (hot-linked; docs/54 §6 D3). */
const pic = (seed: string, w = 1200, h = 900): string =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** A static gallery tile — full-bleed image via box.backgroundImage. */
function galleryTile(seed: string, w: number, h: number): BuilderNode {
  return node('Section', {
    box: {
      name: 'Frame',
      height: 'md',
      backgroundWidth: 'full',
      contentWidth: 'full',
      padding: 'none',
      backgroundImage: pic(seed, w, h),
    },
  });
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — a single full-bleed photograph with a quiet name + line.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('maranorth-hero-portrait', 2000, 1200),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Mara North' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Documentary and portrait photography — quiet, honest pictures of people and the places they keep.',
            },
          }),
          node('Button', {
            props: { label: 'See the work', style: 'primary', href: '/work' },
          }),
        ],
      }),

      // SELECTED FRAMES — a static, asymmetric gallery of recent images.
      node('Section', {
        box: { name: 'Frames', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Selected frames' } }),
          node('Grid', {
            box: { name: 'Frames grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'md' },
            children: [
              galleryTile('maranorth-frame-1', 800, 1000),
              galleryTile('maranorth-frame-2', 800, 533),
              galleryTile('maranorth-frame-3', 800, 800),
              galleryTile('maranorth-frame-4', 800, 533),
              galleryTile('maranorth-frame-5', 800, 1000),
              galleryTile('maranorth-frame-6', 800, 800),
            ],
          }),
        ],
      }),

      // PROJECTS — CMS as a section; iterates project write-ups.
      node('Section', {
        box: { name: 'Projects', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Recent projects' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Longer bodies of work — a series, a commission, a place returned to over months.',
            },
          }),
          node('Grid', {
            box: { name: 'Projects grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Project card', surface: 'none', padding: 'sm' },
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
      }),

      // ABOUT band — a portrait beside a short bio.
      node('Section', {
        box: { name: 'About', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Self-portrait',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: pic('maranorth-self-portrait', 800, 1000),
            },
          }),
          node('Stack', {
            box: { name: 'Bio', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', { props: { level: 'h2', text: 'Behind the camera' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'I make slow, observational pictures — the kind that ask you to stand still for a second longer. Most of my work lives in the space between a portrait and a document.',
                },
              }),
              node('Button', {
                props: { label: 'Read more', style: 'soft', href: '/about' },
                box: { align: 'start' },
              }),
            ],
          }),
        ],
      }),

      // CONTACT band — centered: commission CTA + join the list (Signup).
      node('Section', {
        box: {
          name: 'Contact',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: "Let's make something" } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Commissions, editorial, and prints — get in touch, or join the list for new work and the occasional studio note.',
            },
          }),
          node('Button', {
            props: { label: 'Start a project', style: 'primary', href: '/contact' },
          }),
          node('Signup', { props: { cta: 'Join the list' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function workIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Work', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'The work' } }),
      node('Text', {
        props: { variant: 'body', text: 'Selected projects and series, most recent first.' },
      }),
      node('Grid', {
        box: { name: 'Projects grid', padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        bind: 'cms.blog_post',
        children: [
          node('Card', {
            box: { name: 'Project card', surface: 'subtle', padding: 'md' },
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
    box: { name: 'Project', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'md',
          surface: 'muted',
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
          node('Text', { props: { variant: 'body' }, bind: 'blog_post.body' }),
        ],
      }),
    ],
  });
}

// A `cms.page` template (About, Contact, …) — binds the page entry's fields.
function pageTemplateTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'sm',
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
        children: [node('Text', { props: { variant: 'body' }, bind: 'page.body' })],
      }),
    ],
  });
}

function siteLayoutTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Site layout', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          surface: 'none',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'md',
        },
        layout: { direction: 'row', collapse: false, justify: 'between', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', collapse: false, gap: 'sm', alignItems: 'center' },
            children: [
              node('Wordmark', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Mara North Studio' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Work', href: '/work' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'subtle',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'lg',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Work', href: '/work' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Mara North Studio' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome — thanks for following along' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "I'll send new projects, the occasional print release, and a quiet note from the studio — never too often.",
        },
      }),
      node('Button', { props: { label: 'See recent work', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Want to commission something? Just reply to this email.' } }),
    ],
  });
}

function newWorkEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New work in the journal' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A new project just went up — a few months of frames from a single place, with a short note on how it came together.',
        },
      }),
      node('Button', { props: { label: 'View the project', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you joined the list at Mara North Studio.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'photography-portfolio',
  version: '1.0.0',
  name: 'Photography Portfolio',
  summary:
    'A quiet, image-forward portfolio for a documentary & portrait photographer — a gallery-led home, project write-ups in the journal, an about page, and commission/contact calls to action, themed and ready to review.',
  vertical: 'content',
  requiresModules: ['builder', 'cms', 'email'],

  brand: {
    businessName: 'Mara North Studio',
    tagline: 'Documentary & portrait photography.',
    colors: {
      primary: '#111111',
      primaryForeground: '#FFFFFF',
      accent: '#737373',
      secondary: '#1A1A1A',
    },
    fonts: { heading: 'Archivo', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drift` preset — minimal and near-monochrome so the photographs lead.
  theme: {
    name: 'Mara North',
    basePresetKey: 'drift',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#111111',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#737373',
      fontHeading: 'Archivo',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Mara+North&background=111111&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Mara North Studio',
    },
    // Project featured images.
    { id: 'project-harbor-img', url: pic('maranorth-project-harbor', 1200, 800), alt: 'Harbor at first light' },
    { id: 'project-elders-img', url: pic('maranorth-project-elders', 1200, 800), alt: 'Portrait of an elder' },
    { id: 'project-highlands-img', url: pic('maranorth-project-highlands', 1200, 800), alt: 'Misted highland field' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'the-harbor-at-five',
      body: {
        title: 'The harbor at five',
        excerpt:
          'A winter spent photographing a fishing harbor before dawn — the crews, the cold, and the blue half-hour before the light.',
        body: doc(
          'For three months I drove to the harbor before five, when the only light came from sodium lamps and the breath of men loading crates. I wanted the in-between hour, before the day decided what it would be.',
          'The crews were wary at first and then, slowly, indifferent — which is the best thing that can happen to a documentary photographer. I became part of the cold, a person who was simply always there.',
          'What I kept were the small gestures: a thermos passed without a word, a glance toward a sky that would not quite lighten. The harbor was never about boats. It was about waiting, together, for the light.'
        ),
        featuredImage: assetRef('project-harbor-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'elders-a-portrait-series',
      body: {
        title: 'Elders: a portrait series',
        excerpt:
          'Twelve portraits of people over eighty, made slowly, in their own front rooms, with a single window for light.',
        body: doc(
          'I asked each person for an hour and most gave me an afternoon. We talked until the camera stopped being the point, then I made a few frames by the window and put it down again.',
          'There is a particular honesty in a face that has stopped performing for the lens. It takes time to arrive at — you cannot rush someone into being themselves — so the whole method was simply to be patient and unhurried.',
          'The series is not about age so much as attention: what a life looks like when you finally hold still long enough to really see it. Each portrait is one window, one chair, and as long as it took.'
        ),
        featuredImage: assetRef('project-elders-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'highlands-in-mist',
      body: {
        title: 'Highlands in mist',
        excerpt:
          'A landscape commission that became a study in patience — waiting whole days for the weather to make a picture.',
        body: doc(
          'The brief was simple — photograph the highlands for a small press book — and the weather made it anything but. For a week the mist refused to lift, and I learned to stop fighting it.',
          'Once I gave up on the grand vista, the work got better. Mist flattens a landscape into shapes and tones, and suddenly a single fence post or a line of sheep carried the whole frame.',
          'I came back with fewer pictures than I planned and more than I needed. The lesson, again: the weather is not in the way of the photograph. Often it is the photograph.'
        ),
        featuredImage: assetRef('project-highlands-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Mara North',
        excerpt: 'A documentary and portrait photographer working slowly, on film and digital.',
        body: doc(
          'I am Mara North, a documentary and portrait photographer based on the coast. I make quiet, observational pictures of people and the places they keep, and I tend to stay with a subject for months rather than minutes.',
          'My work has appeared in editorial and book projects, and I take a small number of commissions each year — portraits, reportage, and the occasional landscape series. I shoot on both film and digital, whichever serves the picture.',
          'If we work together, expect a slow, generous process. I would rather make a few true frames than a hundred busy ones.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact & commissions',
        excerpt: 'Commissions, editorial, prints, and print sales — get in touch.',
        body: doc(
          'For commissions, editorial assignments, or licensing, email studio@maranorth.example with a little about the project, the dates, and where it would run. I reply to everything within a few days.',
          'Prints from any series are available in a small range of sizes; just name the frame and the size you have in mind and I will send a quote and timeline.',
          'For teaching, talks, or workshop enquiries, reach out the same way and I will get back when I am off a shoot.'
        ),
      },
    },
  ],

  components: [],

  layout: { name: 'Mara North layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Mara North Studio' },
    { name: 'Work', kind: 'singleton', slug: 'work', tree: workIndexTree() },
    {
      name: 'Project',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: blogPostTree(),
    },
    {
      name: 'Page',
      kind: 'collection',
      recordType: 'cms.page',
      isDefault: true,
      tree: pageTemplateTree(),
    },
  ],

  emails: [
    {
      name: 'Welcome',
      subject: 'Welcome — thanks for following along',
      preheader: "You're on the list — new work and the odd print release.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'New work',
      subject: 'New work in the journal',
      preheader: 'A new project just went up, with a short note on the making.',
      tree: newWorkEmailTree(),
    },
  ],
};

export const photographyPortfolio: Blueprint = parseBlueprint(manifest);
