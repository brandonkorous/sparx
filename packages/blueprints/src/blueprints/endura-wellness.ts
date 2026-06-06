// An Endura Wellness blueprint (docs/54 §12, sibling of beauty-salon-spa.ts):
// a boutique wellness clinic — "Endura Wellness" — with a tailored service menu
// (hormone therapy, weight loss, IV & ozone), a concierge membership band, a
// care team, a small nutraceutical shop, a journal, and book-now calls to
// action. It exercises builder + cms + commerce + email. Everything installs to
// DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Services are NOT sold online — the service menu is STATIC content in the
//     home/services trees (cards of name + description).
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (products, posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos with stable seeds so the
//     installed site looks designed out of the box (docs/54 §6 deferred).
//   · Layouts/grids/rows lean on the responsive renderer (docs/59): grids
//     collapse 1→2→N and rows-of-containers stack on mobile automatically.

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
const rid = (t: string): string => `enw-${t}-${(nid += 1)}`;
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

// ── Reusable cards ─────────────────────────────────────────────────────────────

/** A core-service card — title + short description (services aren't sold online). */
function serviceCard(title: string, body: string): BuilderNode {
  return node('Card', {
    box: { name: title, surface: 'subtle', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: title } }),
      node('Text', { props: { variant: 'body', text: body } }),
    ],
  });
}

/** A "what makes us different" point — title + body. */
function differenceCard(title: string, body: string): BuilderNode {
  return node('Card', {
    box: { name: title, surface: 'none', padding: 'md' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: title } }),
      node('Text', { props: { variant: 'body', text: body } }),
    ],
  });
}

/** A condition we treat — a single scannable line. */
function concernLine(text: string): BuilderNode {
  return node('Text', { box: { padding: 'sm' }, props: { variant: 'body', text: `— ${text}` } });
}

/** A membership benefit line. */
function benefitLine(text: string): BuilderNode {
  return node('Text', { props: { variant: 'body', text: `✓  ${text}` } });
}

/** A static team card — portrait via box.backgroundImage, name + role beneath. */
function teamCard(seed: string, name: string, role: string): BuilderNode {
  return node('Card', {
    box: { name, surface: 'none', padding: 'none' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Section', {
        box: {
          name: 'Portrait',
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'full',
          padding: 'none',
          backgroundImage: pic(seed, 600, 800),
        },
      }),
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'meta', text: role } }),
    ],
  });
}

/** A numbered "get started" step card. */
function stepCard(num: string, title: string, body: string): BuilderNode {
  return node('Card', {
    box: { name: title, surface: 'subtle', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Text', { props: { variant: 'meta', text: num } }),
      node('Heading', { props: { level: 'h3', text: title } }),
      node('Text', { props: { variant: 'body', text: body } }),
    ],
  });
}

// ── Page trees ─────────────────────────────────────────────────────────────────

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — calm full-bleed clinic photo with a scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('endura-hero-clinic', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Text', { props: { variant: 'meta', text: 'Boutique wellness · Lynchburg, VA' } }),
          node('Heading', { props: { level: 'h1', text: 'Feel like you again.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A boutique wellness clinic offering personalized, science-backed care for your hormones, weight, energy — and everything that makes you, you.',
            },
          }),
          node('Button', {
            props: { label: 'Book an appointment', style: 'primary', href: '/contact' },
          }),
        ],
      }),

      // SERVICES — the four core programs, static cards.
      node('Section', {
        box: { name: 'Services', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Care, tailored to you' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Every plan starts with a real conversation. From there we build the right mix of therapies to get you back to your best.',
            },
          }),
          node('Grid', {
            box: { name: 'Services grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              serviceCard(
                'Bio-Identical Hormone Therapy',
                'Restore balance, energy, mood and sleep with bio-identical hormone therapy designed around your labs and your life.'
              ),
              serviceCard(
                'Weight Loss Program',
                'A guided, 12-week medical weight-loss program built to help you reach your goals — and actually keep them.'
              ),
              serviceCard(
                'IV Therapy',
                'Targeted IV infusions that rehydrate, replenish and restore from the inside out — hydration, immunity and recovery.'
              ),
              serviceCard(
                'Ozone Therapy',
                'Advanced ozone therapy to support immunity, energy and whole-body wellness using treatments trusted worldwide.'
              ),
            ],
          }),
          node('Button', {
            props: { label: 'Explore all services', style: 'soft', href: '/services' },
          }),
        ],
      }),

      // CONCERNS — the conditions we help navigate.
      node('Section', {
        box: { name: 'Concerns', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: "We'll help you navigate these challenges" },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'We use deeper diagnostics and tailored plans to uncover and address the root cause — not just quiet the symptoms.',
            },
          }),
          node('Grid', {
            box: { name: 'Concerns grid', padding: 'none' },
            layout: { direction: 'grid', columns: 2, gap: 'sm' },
            children: [
              concernLine('Hormonal imbalances'),
              concernLine('Thyroid disorders'),
              concernLine('Weight management'),
              concernLine('Chronic fatigue'),
              concernLine('Immune support'),
              concernLine('Migraines'),
              concernLine('Anxiety & depression'),
              concernLine('Autoimmune conditions'),
              concernLine('Mold toxicity & inflammation'),
              concernLine('Nutrient deficiencies'),
            ],
          }),
        ],
      }),

      // DIFFERENTIATORS — what makes us different.
      node('Section', {
        box: { name: 'Difference', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'What makes us different' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Because every patient deserves to feel heard, understood and truly well — we prioritize deeper diagnostics, personal attention and a calm space built for healing.',
            },
          }),
          node('Grid', {
            box: { name: 'Difference grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              differenceCard(
                'Root-cause approach',
                "We don't just treat symptoms — we identify and address the underlying cause."
              ),
              differenceCard(
                'Personalized concierge care',
                "You're never just a number. Every visit is unhurried, one-on-one support."
              ),
              differenceCard(
                'Cutting-edge treatments',
                'Progressive, science-backed therapies used in clinics worldwide.'
              ),
              differenceCard(
                'A boutique experience',
                'A warm, inviting, stress-free space designed entirely around your comfort.'
              ),
            ],
          }),
        ],
      }),

      // CONCIERGE MEMBERSHIP — highlighted dark band with the $99/mo plan.
      node('Section', {
        box: {
          name: 'Concierge',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          padding: 'xl',
        },
        layout: { direction: 'row', gap: 'lg', alignItems: 'start' },
        children: [
          node('Stack', {
            box: { name: 'Plan intro', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Text', { props: { variant: 'meta', text: 'Concierge Wellness Plan' } }),
              node('Heading', { props: { level: 'h2', text: 'Elite care, extraordinary access' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Exclusive benefits for ongoing hormone-therapy patients — designed to save you money and give you VIP access to your care team.',
                },
              }),
              node('Heading', { props: { level: 'h2', text: '$99 / month' } }),
              node('Text', {
                props: {
                  variant: 'meta',
                  text: 'Save $700–$800 per year while getting priority, personalized care.',
                },
              }),
              node('Button', {
                props: { label: 'Join the plan', style: 'primary', href: '/contact' },
              }),
            ],
          }),
          node('Stack', {
            box: { name: 'Plan benefits', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              benefitLine('24/7 direct access to your Nurse Practitioner'),
              benefitLine('One monthly telehealth visit, as needed (save $75)'),
              benefitLine('One free injection per month (save $300+)'),
              benefitLine('Discounted hormone pellet therapy (save up to $300/yr)'),
              benefitLine('10% off nutraceuticals & select IV therapies'),
              benefitLine('Annual labs & consult discounts'),
            ],
          }),
        ],
      }),

      // TEAM — static care-team cards.
      node('Section', {
        box: { name: 'Team', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Meet the team' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A small, experienced team here to listen, support and guide you every step of the way.',
            },
          }),
          node('Grid', {
            box: { name: 'Team grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              teamCard(
                'endura-team-brittany',
                'Brittany Brown, NP',
                'Founder · Nurse Practitioner'
              ),
              teamCard('endura-team-megan', 'Megan Ringi, RN', 'Registered Nurse'),
              teamCard('endura-team-daria', 'Daria Ray', 'Patient Coordinator'),
            ],
          }),
        ],
      }),

      // PROCESS — the three-step "get started" path.
      node('Section', {
        box: { name: 'Process', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'Get started with your wellness journey' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'We keep the start simple. A clear, step-by-step path means you always know what comes next.',
            },
          }),
          node('Grid', {
            box: { name: 'Steps grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              stepCard(
                'Step 1',
                'Schedule your consultation',
                'Book an initial visit and tell us your story. Your service fee is included.'
              ),
              stepCard(
                'Step 2',
                'Build your plan',
                'Together we design a tailored, science-backed treatment plan around your goals.'
              ),
              stepCard(
                'Step 3',
                'Begin your journey',
                'Start treatment with concierge support and check-ins every step of the way.'
              ),
            ],
          }),
        ],
      }),

      // SHOP — the nutraceutical shelf; iterates products from Commerce.
      node('Section', {
        box: { name: 'Shop', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'The nutraceutical shop' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'The same professional-grade supplements we reach for in the clinic — vetted, trusted and ready to ship.',
            },
          }),
          node('Grid', {
            box: { name: 'Products grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            bind: 'commerce.product',
            children: [
              node('Card', {
                box: { name: 'Product card', surface: 'none', padding: 'sm' },
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

      // JOURNAL — CMS teaser; iterates posts.
      node('Section', {
        box: { name: 'Journal', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the journal' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Science-backed wellness notes, treatment guides and tips for feeling your best.',
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

      // STORY — warm band: founder photo beside the origin story.
      node('Section', {
        box: { name: 'Story', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Founder photo',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: pic('endura-story-founder', 700, 880),
            },
          }),
          node('Stack', {
            box: { name: 'Story copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', {
                props: { level: 'h2', text: 'Personalized care meets real science.' },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Endura Wellness was founded by Brittany Brown, NP, inspired by her own wellness journey and how rare it is to feel truly heard. We built a boutique clinic where deeper diagnostics and one-on-one attention come standard.',
                },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Hormone therapy, weight-loss support, IV and ozone treatments — all customized to you, in a space designed to feel warm, welcoming and calm.',
                },
              }),
              node('Text', { props: { variant: 'meta', text: '— Brittany Brown, NP' } }),
            ],
          }),
        ],
      }),

      // CONVERSION — centered band: book CTA + join the list (Signup).
      node('Section', {
        box: {
          name: 'Conversion',
          surface: 'muted',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'Now is the time to transform your health' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Book a consultation in under a minute — or join the list for wellness tips, exclusive offers and science-backed health insights.',
            },
          }),
          node('Button', {
            props: { label: 'Book an appointment', style: 'primary', href: '/contact' },
          }),
          node('Signup', { props: { cta: 'Join' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function servicesTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Services', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
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
        children: [
          node('Heading', { props: { level: 'h1', text: 'Our services' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Personalized, science-backed treatments designed around your labs, your goals and your life.',
            },
          }),
        ],
      }),
      node('Section', {
        box: { name: 'Service detail', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          node('Grid', {
            box: { name: 'Services grid', padding: 'none' },
            layout: { direction: 'grid', columns: 2, gap: 'lg' },
            children: [
              serviceCard(
                'Bio-Identical Hormone Therapy',
                'Bio-identical hormones matched to your body restore energy, mood, sleep and libido. We dose from comprehensive labs and adjust as you feel better — pellets, injections or creams.'
              ),
              serviceCard(
                'Weight Loss Program',
                'A medically guided, 12-week program combining modern medications, nutrition coaching and accountability so the weight comes off and stays off.'
              ),
              serviceCard(
                'IV Therapy',
                'Custom IV infusions deliver vitamins, minerals and antioxidants straight to your bloodstream for hydration, immune support, recovery and an energy reset.'
              ),
              serviceCard(
                'Ozone Therapy',
                'Medical ozone supports immune function, circulation and cellular energy — a progressive, well-tolerated therapy used in clinics around the world.'
              ),
            ],
          }),
          node('Button', {
            props: { label: 'Book an appointment', style: 'primary', href: '/contact' },
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
          text: 'Science-backed wellness notes, treatment guides and tips for feeling your best.',
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
        layout: { direction: 'row', justify: 'between', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
            children: [
              node('Logo', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Endura Wellness' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'About', href: '/about' },
                { label: 'Services', href: '/services' },
                { label: 'Shop', href: '/products' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('Button', { props: { label: 'Book', style: 'primary', href: '/contact' } }),
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
          node('Heading', { props: { level: 'h3', text: 'Endura Wellness' } }),
          node('Text', {
            props: {
              variant: 'meta',
              text: 'Boutique wellness clinic · 4327 Boonsboro Road, Suite 3, Lynchburg, VA · (434) 944-1674',
            },
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Services', href: '/services' },
                { label: 'Shop', href: '/products' },
                { label: 'Journal', href: '/journal' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Endura Wellness' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Endura Wellness' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "Thank you for joining us. We'll send wellness tips, exclusive offers and science-backed health insights — never anything noisy.",
        },
      }),
      node('Button', {
        props: { label: 'Book an appointment', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'Questions? Just reply to this email — a real person on our team reads it.',
        },
      }),
    ],
  });
}

function newsletterEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Your wellness check-in' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A few notes from the clinic this month — new treatments on the menu, seasonal IV blends, and the supplements we keep reaching for.',
        },
      }),
      node('Button', {
        props: { label: 'Book your next visit', href: '' },
        box: { align: 'start' },
      }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you joined the list at Endura Wellness. Unsubscribe whenever you like.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'endura-wellness',
  version: '0.1.0',
  name: 'Wellness Clinic',
  summary:
    'A boutique wellness-clinic site with a tailored service menu (hormone therapy, weight loss, IV & ozone), a concierge membership band, a care team, a small nutraceutical shop, a journal, and book-now calls to action — themed and ready to review.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'commerce', 'email'],

  brand: {
    businessName: 'Endura Wellness',
    tagline: 'Feel like you again.',
    colors: {
      primary: '#0F766E',
      primaryForeground: '#FFFFFF',
      accent: '#C2954A',
      secondary: '#1C3A34',
    },
    fonts: { heading: 'Fraunces', body: 'Jost' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drift` preset — soft/warm/light, matching the calm teal wellness identity.
  theme: {
    name: 'Endura',
    basePresetKey: 'drift',
    presentation: { v: 2, containerWidth: '1200px' },
    brand: {
      colorPrimary: '#0F766E',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#C2954A',
      colorSecondary: '#1C3A34',
      fontHeading: 'Fraunces',
      fontBody: 'Jost',
      tokens: { radiusBase: '14px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Endura+Wellness&background=0F766E&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Endura Wellness',
    },
    // Nutraceutical product imagery (stable seeds).
    {
      id: 'prod-multi',
      url: pic('endura-prod-multi', 1000, 1000),
      alt: 'Daily Foundations Multivitamin',
    },
    { id: 'prod-d3k2', url: pic('endura-prod-d3k2', 1000, 1000), alt: 'Vitamin D3 + K2' },
    { id: 'prod-mag', url: pic('endura-prod-mag', 1000, 1000), alt: 'Magnesium Glycinate' },
    { id: 'prod-omega', url: pic('endura-prod-omega', 1000, 1000), alt: 'Omega-3 Fish Oil' },
    {
      id: 'prod-bcomplex',
      url: pic('endura-prod-bcomplex', 1000, 1000),
      alt: 'Methylated B-Complex',
    },
    // Journal featured images (stable seeds).
    { id: 'journal-1-img', url: pic('endura-journal-1', 800, 600), alt: 'Hormone balance' },
    { id: 'journal-2-img', url: pic('endura-journal-2', 800, 600), alt: 'IV therapy session' },
    { id: 'journal-3-img', url: pic('endura-journal-3', 800, 600), alt: 'Healthy meal prep' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'signs-your-hormones-are-off',
      body: {
        title: '5 signs your hormones may be out of balance',
        excerpt:
          'Fatigue, stubborn weight, low mood and poor sleep are easy to dismiss — but together they often point to a hormone imbalance worth investigating.',
        body: doc(
          'Hormones are the body’s messengers, and when they drift out of range the symptoms rarely announce themselves clearly. Most people simply feel "off" for months before they connect the dots.',
          'The five signs we see most often are persistent fatigue that sleep does not fix, weight that will not move despite your effort, low mood or irritability, disrupted sleep, and a dip in libido or drive.',
          'The good news: a comprehensive lab panel can map exactly what is happening, and a bio-identical plan can bring things back into balance gradually and safely. If two or more of these sound familiar, it is worth a conversation.'
        ),
        featuredImage: assetRef('journal-1-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'what-to-expect-from-iv-therapy',
      body: {
        title: 'What to expect from your first IV therapy session',
        excerpt:
          'IV therapy delivers hydration and nutrients straight to your bloodstream. Here is exactly how a first visit goes — start to finish.',
        body: doc(
          'IV therapy sounds clinical, but a session is genuinely relaxing. You will settle into a comfortable chair while we review your goals and choose the right blend for the day.',
          'The infusion itself takes 30 to 45 minutes. Most people read, scroll, or simply rest while vitamins, minerals and antioxidants go to work. A small pinch at the start is the only discomfort.',
          'Afterward, many people notice better hydration, steadier energy and a clearer head within hours. We will recommend a cadence — from a one-off reset to a regular cadence — based on how you respond.'
        ),
        featuredImage: assetRef('journal-2-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'weight-loss-that-lasts',
      body: {
        title: 'Building a weight-loss plan that actually lasts',
        excerpt:
          'Crash diets fail because they fight your biology. A medical program works with it — here is what a durable plan looks like.',
        body: doc(
          'Most weight-loss attempts fail not from a lack of willpower but because they ignore how the body defends its set point. Hunger hormones surge, metabolism slows, and the weight returns.',
          'A medical program changes the math. Modern medications, paired with nutrition coaching and steady accountability, make the deficit sustainable instead of punishing — so progress sticks.',
          'Our 12-week framework is built around small, repeatable habits and regular check-ins. The goal is never a number for a single week; it is a body and routine you can actually live in for good.'
        ),
        featuredImage: assetRef('journal-3-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Endura Wellness',
        excerpt:
          'A boutique wellness clinic in Lynchburg, VA where personalized care meets real science.',
        body: doc(
          'Endura Wellness was founded by Brittany Brown, NP, after her own wellness journey showed her how rare it is to feel truly heard. She set out to build the clinic she wished existed — one where deeper diagnostics and one-on-one attention come standard.',
          'We offer bio-identical hormone therapy, medical weight-loss support, IV and ozone treatments, and a curated nutraceutical shelf — all customized to you. Our friendly, experienced team is here to listen, support and guide you every step of the way.',
          'Our clinic is welcoming and family-friendly, designed with your comfort in mind: warm, inviting and unhurried, so healing has the space it needs.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Visit Endura Wellness',
        excerpt: 'Find us in Lynchburg, VA — by appointment, Monday through Friday.',
        body: doc(
          'You will find us at 4327 Boonsboro Road, Suite 3, Lynchburg, VA. We are open Monday through Thursday 8am–4:30pm, and Friday 8am–noon.',
          'To book, call (434) 944-1674 or use the appointment request and we will find a time that suits. New patients, let us know a little about what you are hoping to address so we can plan the right amount of time.',
          'For the concierge plan, the nutraceutical shop, or general questions, reach out the same way and we will point you to the right person.'
        ),
      },
    },
  ],

  commerce: {
    categories: [{ handle: 'supplements', name: 'Supplements', position: 0, featured: true }],
    collections: [
      {
        handle: 'nutraceutical-shelf',
        name: 'The Nutraceutical Shelf',
        type: 'manual',
        featured: true,
        productHandles: [
          'daily-foundations-multivitamin',
          'vitamin-d3-k2',
          'magnesium-glycinate',
          'omega-3-fish-oil',
          'methylated-b-complex',
        ],
      },
    ],
    products: [
      {
        handle: 'daily-foundations-multivitamin',
        title: 'Daily Foundations Multivitamin',
        description:
          '<p>A complete, highly-bioavailable daily multivitamin built on the foundations most adults are missing — methylated B vitamins, chelated minerals and antioxidants.</p>',
        productType: 'Supplement',
        vendor: 'Endura Wellness',
        tags: ['supplement', 'daily', 'foundations'],
        categoryHandles: ['supplements'],
        collectionHandles: ['nutraceutical-shelf'],
        variants: [{ sku: 'MULTI-60', priceCents: 4200, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-multi', isPrimary: true, position: 0 }],
      },
      {
        handle: 'vitamin-d3-k2',
        title: 'Vitamin D3 + K2',
        description:
          '<p>Vitamin D3 paired with K2 (MK-7) for immune support, mood and bone health — the synergy your body actually needs.</p>',
        productType: 'Supplement',
        vendor: 'Endura Wellness',
        tags: ['supplement', 'vitamin-d', 'immune'],
        categoryHandles: ['supplements'],
        collectionHandles: ['nutraceutical-shelf'],
        variants: [{ sku: 'D3K2-60', priceCents: 2800, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-d3k2', isPrimary: true, position: 0 }],
      },
      {
        handle: 'magnesium-glycinate',
        title: 'Magnesium Glycinate',
        description:
          '<p>A gentle, highly-absorbable magnesium glycinate to support restful sleep, calm and muscle recovery — without the digestive upset of cheaper forms.</p>',
        productType: 'Supplement',
        vendor: 'Endura Wellness',
        tags: ['supplement', 'magnesium', 'sleep'],
        categoryHandles: ['supplements'],
        collectionHandles: ['nutraceutical-shelf'],
        variants: [{ sku: 'MAG-120', priceCents: 3200, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-mag', isPrimary: true, position: 0 }],
      },
      {
        handle: 'omega-3-fish-oil',
        title: 'Omega-3 Fish Oil',
        description:
          '<p>A clean, high-potency EPA/DHA fish oil for heart, brain and joint health — molecularly distilled and third-party tested for purity.</p>',
        productType: 'Supplement',
        vendor: 'Endura Wellness',
        tags: ['supplement', 'omega-3', 'heart'],
        categoryHandles: ['supplements'],
        collectionHandles: ['nutraceutical-shelf'],
        variants: [{ sku: 'OMEGA-90', priceCents: 3800, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-omega', isPrimary: true, position: 0 }],
      },
      {
        handle: 'methylated-b-complex',
        title: 'Methylated B-Complex',
        description:
          '<p>An active, methylated B-complex for energy, stress resilience and healthy methylation — ideal for those with MTHFR variants.</p>',
        productType: 'Supplement',
        vendor: 'Endura Wellness',
        tags: ['supplement', 'b-complex', 'energy'],
        categoryHandles: ['supplements'],
        collectionHandles: ['nutraceutical-shelf'],
        variants: [{ sku: 'BCMP-60', priceCents: 3400, isDefault: true, position: 0 }],
        images: [{ assetId: 'prod-bcomplex', isPrimary: true, position: 0 }],
      },
    ],
  },

  components: [],

  layout: { name: 'Endura layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    {
      name: 'Home',
      kind: 'singleton',
      tree: homeTree(),
      seoTitle: 'Endura Wellness — Boutique Wellness Clinic in Lynchburg, VA',
    },
    { name: 'Services', kind: 'singleton', slug: 'services', tree: servicesTree() },
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
      subject: 'Welcome to Endura Wellness',
      preheader: "You're on the list — wellness tips and exclusive offers, never noise.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'Wellness check-in',
      subject: 'Your wellness check-in',
      preheader: 'New treatments, seasonal IV blends, and shelf favourites.',
      tree: newsletterEmailTree(),
    },
  ],
};

export const enduraWellness: Blueprint = parseBlueprint(manifest);
