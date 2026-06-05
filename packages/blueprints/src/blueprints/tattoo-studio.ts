// A dark, gallery-style blueprint for a custom tattoo studio — "Ironleaf Tattoo".
// A sibling of retail-store-blog.ts (docs/54 §12): it exercises every module —
// brand + a NEW shipped theme, CMS content (journal posts + studio pages), a small
// aftercare/print shop, builder pages + the site layout, and marketing emails.
// Everything installs to DRAFT (docs/54 D4); the tenant reviews and goes live.
//
// Mood: a warm near-black gallery with a single gold accent. The base preset is
// light, so the drama comes from `surface: 'inverse'` bands and dark hero photos
// with `overlay: 'dark'` + `textTone: 'light'` (per the mockup at
// mockups/templates/tattoo-studio.html). Static imagery hot-links the same
// picsum.photos seeds the mockup uses; record imagery comes from seeded assets.

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
const rid = (t: string): string => `tat-${t}-${(nid += 1)}`;
const box = (o: Partial<BoxBase> = {}): BoxBase => ({ ...DEFAULT_BOX, ...o });
const lay = (o: Partial<LayoutBase> = {}): LayoutBase => ({ ...DEFAULT_LAYOUT, ...o });

function node(
  type: string,
  opts: {
    box?: Partial<BoxBase>;
    layout?: Partial<LayoutBase>;
    props?: Record<string, unknown>;
    bind?: string;
    children?: BuilderNode[];
  } = {}
): BuilderNode {
  const out: BuilderNode = { id: rid(type), type, box: box(opts.box), props: opts.props ?? {} };
  if (opts.layout) out.layout = lay(opts.layout);
  if (opts.bind) out.binding = { path: opts.bind };
  if (opts.children) out.children = opts.children;
  return out;
}

/** A minimal TipTap rich-text doc from plain paragraphs (content_entries.body). */
const doc = (...paragraphs: string[]): Record<string, unknown> => ({
  type: 'doc',
  content: paragraphs.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
});

/** A deterministic placeholder image URL (hot-linked; docs/54 §6 D3). */
const pic = (seed: string, w = 1200, h = 900): string =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-bleed dark photo with a dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('ironleaf-hero-arm', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Ink that ages like iron, not a trend.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A custom blackwork and fine-line studio in Greenpoint. We draw every piece by hand, for your skin and your story — booked one consultation at a time.',
            },
          }),
          node('Button', {
            props: { label: 'Book a consultation', style: 'primary', href: '/visit' },
          }),
        ],
      }),

      // PORTFOLIO — static image tiles in a grid (box.backgroundImage on cards).
      node('Section', {
        box: { name: 'Portfolio', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Recent work & available flash' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Hand-drawn pieces from the bench — blackwork, dotwork, fine line and the occasional bold traditional.',
            },
          }),
          node('Grid', {
            box: { name: 'Gallery', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            children: [
              node('Card', {
                box: {
                  name: 'Tile · sleeve',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-1', 700, 930),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [
                  node('Text', { props: { variant: 'meta', text: 'Blackwork · sleeve' } }),
                ],
              }),
              node('Card', {
                box: {
                  name: 'Tile · ribs',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-2', 1100, 620),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [node('Text', { props: { variant: 'meta', text: 'Fine line · ribs' } })],
              }),
              node('Card', {
                box: {
                  name: 'Tile · moth',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-3', 640, 640),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [
                  node('Text', { props: { variant: 'meta', text: 'Dotwork · available flash' } }),
                ],
              }),
              node('Card', {
                box: {
                  name: 'Tile · traditional',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-4', 640, 640),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [
                  node('Text', { props: { variant: 'meta', text: 'Traditional · flash' } }),
                ],
              }),
              node('Card', {
                box: {
                  name: 'Tile · spine',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-5', 700, 930),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [
                  node('Text', { props: { variant: 'meta', text: 'Ornamental · spine' } }),
                ],
              }),
              node('Card', {
                box: {
                  name: 'Tile · back',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-6', 1100, 620),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [
                  node('Text', { props: { variant: 'meta', text: 'Illustrative · back' } }),
                ],
              }),
              node('Card', {
                box: {
                  name: 'Tile · script',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-7', 640, 640),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [node('Text', { props: { variant: 'meta', text: 'Micro · script' } })],
              }),
              node('Card', {
                box: {
                  name: 'Tile · mandala',
                  height: 'md',
                  backgroundImage: pic('ironleaf-pf-8', 640, 640),
                  overlay: 'dark',
                  textTone: 'light',
                  padding: 'md',
                },
                layout: { direction: 'stack', gap: 'none', justify: 'end' },
                children: [
                  node('Text', { props: { variant: 'meta', text: 'Geometric · available flash' } }),
                ],
              }),
            ],
          }),
          node('Button', {
            props: { label: 'Browse the full portfolio', style: 'soft', href: '/journal' },
            box: { align: 'center' },
          }),
        ],
      }),

      // ARTISTS — static cards: image via box.backgroundImage + name + specialty.
      node('Section', {
        box: { name: 'Artists', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'The people at the bench' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Four resident artists, each with their own hand. Browse a portfolio, then request the one whose line speaks to you.',
            },
          }),
          node('Grid', {
            box: { name: 'Roster', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'md' },
            children: [
              node('Card', {
                box: { name: 'Artist · Mara', surface: 'subtle', padding: 'none' },
                layout: { direction: 'stack', gap: 'none' },
                children: [
                  node('Section', {
                    box: {
                      name: 'Photo',
                      height: 'md',
                      backgroundImage: pic('ironleaf-artist-mara', 600, 800),
                      padding: 'none',
                    },
                  }),
                  node('Stack', {
                    box: { name: 'Body', padding: 'md' },
                    layout: { direction: 'stack', gap: 'sm' },
                    children: [
                      node('Heading', { props: { level: 'h3', text: 'Mara Vance' } }),
                      node('Text', {
                        props: { variant: 'meta', text: 'Ornamental blackwork & dotwork' },
                      }),
                      node('Text', {
                        props: {
                          variant: 'body',
                          text: 'Founder. Builds dense, symmetrical pieces that wrap the body like armor.',
                        },
                      }),
                    ],
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Artist · Eli', surface: 'subtle', padding: 'none' },
                layout: { direction: 'stack', gap: 'none' },
                children: [
                  node('Section', {
                    box: {
                      name: 'Photo',
                      height: 'md',
                      backgroundImage: pic('ironleaf-artist-eli', 600, 800),
                      padding: 'none',
                    },
                  }),
                  node('Stack', {
                    box: { name: 'Body', padding: 'md' },
                    layout: { direction: 'stack', gap: 'sm' },
                    children: [
                      node('Heading', { props: { level: 'h3', text: 'Eli Sato' } }),
                      node('Text', {
                        props: { variant: 'meta', text: 'Fine line & micro-realism' },
                      }),
                      node('Text', {
                        props: {
                          variant: 'body',
                          text: 'Whisper-thin botanicals and portraits that read clean for decades.',
                        },
                      }),
                    ],
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Artist · Juno', surface: 'subtle', padding: 'none' },
                layout: { direction: 'stack', gap: 'none' },
                children: [
                  node('Section', {
                    box: {
                      name: 'Photo',
                      height: 'md',
                      backgroundImage: pic('ironleaf-artist-juno', 600, 800),
                      padding: 'none',
                    },
                  }),
                  node('Stack', {
                    box: { name: 'Body', padding: 'md' },
                    layout: { direction: 'stack', gap: 'sm' },
                    children: [
                      node('Heading', { props: { level: 'h3', text: 'Juno Reyes' } }),
                      node('Text', {
                        props: { variant: 'meta', text: 'Neo-traditional & bold color' },
                      }),
                      node('Text', {
                        props: {
                          variant: 'body',
                          text: 'Saturated, high-contrast work with a flair for animals and folklore.',
                        },
                      }),
                    ],
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Artist · Knox', surface: 'subtle', padding: 'none' },
                layout: { direction: 'stack', gap: 'none' },
                children: [
                  node('Section', {
                    box: {
                      name: 'Photo',
                      height: 'md',
                      backgroundImage: pic('ironleaf-artist-knox', 600, 800),
                      padding: 'none',
                    },
                  }),
                  node('Stack', {
                    box: { name: 'Body', padding: 'md' },
                    layout: { direction: 'stack', gap: 'sm' },
                    children: [
                      node('Heading', { props: { level: 'h3', text: 'Knox Aldridge' } }),
                      node('Text', {
                        props: { variant: 'meta', text: 'Illustrative & large-scale' },
                      }),
                      node('Text', {
                        props: {
                          variant: 'body',
                          text: 'Story-driven back pieces and sleeves drawn straight onto the skin.',
                        },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // HOW BOOKING WORKS — three steps as static cards.
      node('Section', {
        box: { name: 'Booking', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'How a tattoo gets made here' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every custom piece starts with a conversation. No surprise pricing, no rushed line — just a clear path from idea to healed skin.',
            },
          }),
          node('Grid', {
            box: { name: 'Steps', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              node('Card', {
                box: { name: 'Step 01', surface: 'none', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Consult' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Share your reference, placement and size. We talk it through in person or over video and match you to the right artist — free, no obligation.',
                    },
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Step 02', surface: 'none', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Design & deposit' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'A $100 deposit reserves your date and goes toward the final cost. Your artist draws a custom piece; we refine it together before the day.',
                    },
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Step 03', surface: 'none', padding: 'md' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Session & aftercare' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Show up rested and fed. We tattoo in a private, single-use, fully licensed station and send you home with a written aftercare plan.',
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // SHOP — Commerce as one section; iterates products.
      node('Section', {
        box: { name: 'Shop', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the studio shop' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Aftercare we trust, fine-line prints, studio apparel, and gift cards for the person who is ready.',
            },
          }),
          node('Grid', {
            box: { name: 'Products grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Product card', surface: 'subtle', padding: 'sm' },
                layout: { direction: 'stack', gap: 'sm' },
                children: [
                  node('ImageDisplay', { props: { ratio: 'square' }, bind: 'item.images' }),
                  node('Heading', { props: { level: 'h3' }, bind: 'item.title' }),
                  node('PriceTag', { bind: 'item.price' }),
                  node('Button', { props: { label: 'View', style: 'soft' } }),
                ],
              }),
            ],
          }),
        ],
      }),

      // JOURNAL teaser — CMS as another section; iterates posts.
      node('Section', {
        box: { name: 'Journal', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the journal' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Notes from the bench — aftercare, the craft, and the stories behind pieces we loved making.',
            },
          }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Article card', surface: 'none', padding: 'sm' },
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

      // ABOUT / STORY band — static photo beside the studio story.
      node('Section', {
        box: { name: 'About', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Frame',
              height: 'lg',
              backgroundImage: pic('ironleaf-studio-interior', 900, 1125),
              padding: 'none',
            },
          }),
          node('Stack', {
            box: { name: 'Story', padding: 'none' },
            layout: { direction: 'stack', gap: 'md' },
            children: [
              node('Heading', {
                props: {
                  level: 'h2',
                  text: 'A quiet room, a steady hand, and time to do it right.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: "Ironleaf opened in 2011 with one rule that hasn't changed: nobody leaves with a tattoo they'll outgrow. We'd rather talk you into the right piece than rush you through the wrong one.",
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'The space is small on purpose — three stations, a sketchbook for every client, and time to think. We tattoo people who want their ink to mean something in twenty years.',
                },
              }),
              node('Text', { props: { variant: 'meta', text: '— Mara & the Ironleaf crew' } }),
            ],
          }),
        ],
      }),

      // CONVERSION band — full-bleed dark photo + heading + text + button.
      node('Section', {
        box: {
          name: 'Convert',
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('ironleaf-convert-bg', 2000, 1000),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: "Ready when you are. Let's draw something." },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: "Book a free consultation and we'll match you with the right artist, or join the list for new flash drops and open dates.",
            },
          }),
          node('Button', {
            props: { label: 'Book a consultation', style: 'primary', href: '/visit' },
          }),
        ],
      }),
    ],
  });
}

function journalIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Journal', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'The journal' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Notes from the bench — aftercare, the craft, and the stories behind the ink.',
        },
      }),
      node('Grid', {
        box: { name: 'Posts grid', padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        bind: 'cms.blog_post',
        children: [
          node('Card', {
            box: { name: 'Article card', surface: 'subtle', padding: 'md' },
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
          height: 'md',
          surface: 'inverse',
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

function productTree(): BuilderNode {
  return node('Section', {
    box: {
      name: 'Product page',
      padding: 'lg',
      backgroundWidth: 'full',
      contentWidth: 'contained',
    },
    layout: { direction: 'stack', gap: 'lg' },
    children: [
      node('Section', {
        box: { name: 'Product', padding: 'none', contentWidth: 'full' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('ImageDisplay', { props: { ratio: 'square' }, bind: 'product.images' }),
          node('Stack', {
            box: { name: 'Buy', padding: 'none' },
            layout: { direction: 'stack', gap: 'md' },
            children: [
              node('Heading', { props: { level: 'h1' }, bind: 'product.title' }),
              node('PriceTag', { bind: 'product.price' }),
              node('Text', { props: { variant: 'body' }, bind: 'product.description' }),
              node('Button', { props: { label: 'Add to cart', style: 'primary' } }),
            ],
          }),
        ],
      }),
    ],
  });
}

// A `cms.page` template (The studio, Visit, …) — binds the page entry's fields.
function pageTemplateTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Page', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Header',
          height: 'sm',
          surface: 'inverse',
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
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'md',
        },
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
            children: [
              node('Logo', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Ironleaf Tattoo' } }),
            ],
          }),
          node('NavMenu', { props: { orientation: 'row' }, bind: 'site.primaryNav' }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'lg',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('NavMenu', { props: { orientation: 'row' }, bind: 'site.footerNav' }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Ironleaf Tattoo' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Ironleaf' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thanks for joining the flash list. Here's how booking works at the studio — and what to expect before your first session.",
        },
      }),
      node('Button', {
        props: { label: 'Book a consultation', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'Questions? Just reply — hello@ironleaf.studio.' },
      }),
    ],
  });
}

function flashDropEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New flash & open dates' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Fresh hand-drawn flash just dropped and a few session dates opened up this month. First come, first booked.',
        },
      }),
      node('Button', {
        props: { label: 'See available flash', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you joined the Ironleaf flash list.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'tattoo-studio',
  version: '0.1.0',
  name: 'Tattoo Studio',
  summary:
    'A dark, gallery-style site for a custom tattoo studio — a portfolio-led home, an artist roster, a journal, a small aftercare/print shop, and booking-focused calls to action, all themed and ready to review.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'commerce', 'email'],

  brand: {
    businessName: 'Ironleaf Tattoo',
    tagline: 'Custom blackwork & fine line.',
    colors: {
      primary: '#C9A24B',
      primaryForeground: '#0B0A09',
      accent: '#9A3B2E',
      secondary: '#17150F',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  theme: {
    name: 'Ironleaf',
    basePresetKey: 'apex',
    presentation: { v: 2, containerWidth: '1200px' },
    brand: {
      colorPrimary: '#C9A24B',
      colorPrimaryForeground: '#0B0A09',
      colorAccent: '#9A3B2E',
      fontHeading: 'Cormorant Garamond',
      fontBody: 'Inter',
      tokens: { radiusBase: '4px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Ironleaf+Tattoo&background=C9A24B&color=0B0A09&bold=true&size=128&format=svg',
      alt: 'Ironleaf Tattoo',
    },
    {
      id: 'journal-aftercare-img',
      url: pic('ironleaf-journal-1', 720, 540),
      alt: 'Fresh tattoo being wrapped',
    },
    {
      id: 'journal-craft-img',
      url: pic('ironleaf-journal-2', 720, 540),
      alt: 'Artist sketching a design by hand',
    },
    {
      id: 'journal-aging-img',
      url: pic('ironleaf-journal-3', 720, 540),
      alt: 'Detail of a healed blackwork tattoo',
    },
    { id: 'balm-img', url: pic('ironleaf-balm', 1000, 1000), alt: 'Tattoo aftercare balm tin' },
    { id: 'print-img', url: pic('ironleaf-print', 1000, 1000), alt: 'Fine-line art print' },
    { id: 'tee-img', url: pic('ironleaf-tee', 1000, 1000), alt: 'Ironleaf studio tee' },
    { id: 'giftcard-img', url: pic('ironleaf-giftcard', 1000, 1000), alt: 'Ironleaf gift card' },
    {
      id: 'cat-aftercare-hero',
      url: pic('ironleaf-cat-aftercare'),
      alt: 'Aftercare',
    },
    { id: 'cat-prints-hero', url: pic('ironleaf-cat-prints'), alt: 'Prints' },
    { id: 'cat-apparel-hero', url: pic('ironleaf-cat-apparel'), alt: 'Apparel' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'the-first-two-weeks',
      body: {
        title: 'The first two weeks, done right',
        excerpt:
          'A day-by-day guide to healing your tattoo so the line stays crisp and the color stays true.',
        body: doc(
          'Most of how a tattoo ages is decided in its first fortnight. Keep it clean, keep it moisturized, and keep your hands off it — the rest is patience.',
          'Days one to three: leave the wrap on as instructed, then wash gently with fragrance-free soap and pat dry. A thin layer of aftercare balm, twice a day, is plenty.',
          'Days four to fourteen: expect flaking and a little itch. Do not pick or scratch. No pools, no long soaks, and keep it out of direct sun until it has fully settled.'
        ),
        featuredImage: assetRef('journal-aftercare-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'why-we-draw-by-hand',
      body: {
        title: 'Why we draw every piece by hand',
        excerpt:
          'Stencils have their place — but a custom line drawn for your body is what makes a tattoo yours alone.',
        body: doc(
          'A flash sheet is a starting point, not a destination. The work that lasts is the work drawn for one body, one story, one placement.',
          'We sketch with you in the room, adjust to how a design wraps a forearm or follows a ribcage, and only ink once the drawing feels inevitable.',
          'It is slower. It is also the difference between a tattoo you tolerate and one you are still proud of in twenty years.'
        ),
        featuredImage: assetRef('journal-craft-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'how-blackwork-ages',
      body: {
        title: 'How blackwork ages over ten years',
        excerpt:
          "We revisited five clients a decade on. Here's what holds, what softens, and how to plan for it.",
        body: doc(
          'Heavy black is the most forgiving ink there is — but only if it was packed well and placed with aging in mind.',
          'Bold, solid fields hold beautifully. Fine ornamental detail softens, so we space it with that decade in mind rather than crowding the skin.',
          'The takeaway: design for the tattoo you will have at forty, not just the photo you will post next week.'
        ),
        featuredImage: assetRef('journal-aging-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'the-studio',
      body: {
        title: 'The studio',
        excerpt: 'A small, custom tattoo studio in Greenpoint, Brooklyn.',
        body: doc(
          'Ironleaf opened in 2011 with one rule that has not changed: nobody leaves with a tattoo they will outgrow.',
          'We are three stations and four resident artists, working by appointment with select walk-ins. Every piece is hand-drawn for the person wearing it.',
          'The room is intentionally quiet — a sketchbook for every client, single-use stations, and the time to get it right.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'visit',
      body: {
        title: 'Visit & booking',
        excerpt: 'Find the studio, book a consultation, or join the flash list.',
        body: doc(
          'We are at 148 Iron Street, Greenpoint, Brooklyn, NY 11222. Open Tuesday through Saturday, 12–8pm; Sunday and Monday by appointment.',
          'To book, start with a free consultation — share your reference, placement and size, and we will match you with the right artist. A $100 deposit reserves your date and goes toward the work.',
          'Questions, press, or large-scale projects: email hello@ironleaf.studio and we will get back within a business day.'
        ),
      },
    },
  ],

  commerce: {
    categories: [
      {
        handle: 'aftercare',
        name: 'Aftercare',
        position: 0,
        featured: true,
        heroAssetId: 'cat-aftercare-hero',
      },
      {
        handle: 'prints',
        name: 'Prints',
        position: 1,
        featured: true,
        heroAssetId: 'cat-prints-hero',
      },
      {
        handle: 'apparel',
        name: 'Apparel',
        position: 2,
        heroAssetId: 'cat-apparel-hero',
      },
    ],
    collections: [
      {
        handle: 'studio-shop',
        name: 'Studio shop',
        type: 'manual',
        featured: true,
        productHandles: ['aftercare-balm', 'fine-line-print', 'studio-tee', 'gift-card'],
      },
    ],
    products: [
      {
        handle: 'aftercare-balm',
        title: 'Aftercare Balm',
        description:
          '<p>A fragrance-free healing balm we use on every fresh piece. Vegan, 2oz tin.</p>',
        productType: 'Aftercare',
        vendor: 'Ironleaf',
        tags: ['aftercare', 'balm'],
        categoryHandles: ['aftercare'],
        collectionHandles: ['studio-shop'],
        variants: [{ sku: 'BALM-2OZ', priceCents: 1800, isDefault: true, position: 0 }],
        images: [{ assetId: 'balm-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'fine-line-print',
        title: 'Fine-Line Art Print',
        description:
          '<p>A giclée print of an Ironleaf flash design on heavyweight archival stock.</p>',
        productType: 'Prints',
        vendor: 'Ironleaf',
        tags: ['print', 'art'],
        categoryHandles: ['prints'],
        collectionHandles: ['studio-shop'],
        options: [
          {
            name: 'Size',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: '8×10', position: 0 },
              { value: '12×16', position: 1 },
              { value: '18×24', position: 2 },
            ],
          },
        ],
        variants: [
          {
            sku: 'PRINT-8X10',
            optionValues: { Size: '8×10' },
            priceCents: 2500,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'PRINT-12X16',
            optionValues: { Size: '12×16' },
            priceCents: 4500,
            position: 1,
          },
          {
            sku: 'PRINT-18X24',
            optionValues: { Size: '18×24' },
            priceCents: 7500,
            position: 2,
          },
        ],
        images: [{ assetId: 'print-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'studio-tee',
        title: 'Studio Tee',
        description:
          '<p>A heavyweight black tee with the Ironleaf mark, screen-printed in Brooklyn.</p>',
        productType: 'Apparel',
        vendor: 'Ironleaf',
        tags: ['apparel', 'tee'],
        categoryHandles: ['apparel'],
        collectionHandles: ['studio-shop'],
        options: [
          {
            name: 'Size',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: 'S', position: 0 },
              { value: 'M', position: 1 },
              { value: 'L', position: 2 },
              { value: 'XL', position: 3 },
            ],
          },
        ],
        variants: [
          {
            sku: 'TEE-S',
            optionValues: { Size: 'S' },
            priceCents: 3200,
            isDefault: true,
            position: 0,
          },
          { sku: 'TEE-M', optionValues: { Size: 'M' }, priceCents: 3200, position: 1 },
          { sku: 'TEE-L', optionValues: { Size: 'L' }, priceCents: 3200, position: 2 },
          { sku: 'TEE-XL', optionValues: { Size: 'XL' }, priceCents: 3200, position: 3 },
        ],
        images: [{ assetId: 'tee-img', isPrimary: true, position: 0 }],
      },
      {
        handle: 'gift-card',
        title: 'Gift Card',
        description:
          '<p>A digital gift card toward any tattoo session or shop order. Delivered by email.</p>',
        productType: 'Gift card',
        vendor: 'Ironleaf',
        tags: ['gift'],
        fulfillmentType: 'digital',
        requiresShipping: false,
        categoryHandles: ['aftercare'],
        collectionHandles: ['studio-shop'],
        options: [
          {
            name: 'Amount',
            displayType: 'segmented',
            position: 0,
            values: [
              { value: '$50', position: 0 },
              { value: '$100', position: 1 },
              { value: '$250', position: 2 },
            ],
          },
        ],
        variants: [
          {
            sku: 'GC-50',
            optionValues: { Amount: '$50' },
            priceCents: 5000,
            requiresShipping: false,
            isDefault: true,
            position: 0,
          },
          {
            sku: 'GC-100',
            optionValues: { Amount: '$100' },
            priceCents: 10000,
            requiresShipping: false,
            position: 1,
          },
          {
            sku: 'GC-250',
            optionValues: { Amount: '$250' },
            priceCents: 25000,
            requiresShipping: false,
            position: 2,
          },
        ],
        images: [{ assetId: 'giftcard-img', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Ironleaf layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Ironleaf Tattoo' },
    { name: 'Journal', kind: 'singleton', slug: 'journal', tree: journalIndexTree() },
    {
      name: 'Blog post',
      kind: 'collection',
      recordType: 'cms.blog_post',
      isDefault: true,
      tree: blogPostTree(),
    },
    {
      name: 'Product page',
      kind: 'collection',
      recordType: 'commerce.product',
      isDefault: true,
      tree: productTree(),
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
      subject: 'Welcome to Ironleaf',
      preheader: "You're on the list — here's how booking works.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'New flash & studio news',
      subject: 'New flash & open dates',
      preheader: 'Fresh hand-drawn flash and a few new session dates.',
      tree: flashDropEmailTree(),
    },
  ],
};

export const tattooStudio: Blueprint = parseBlueprint(manifest);
