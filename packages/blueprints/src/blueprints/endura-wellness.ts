// An Endura Wellness blueprint (docs/54 §12, sibling of beauty-salon-spa.ts):
// a boutique wellness clinic — "Endura Wellness" — with a tailored service menu
// (hormone therapy, weight loss, IV & ozone), a concierge membership band, a
// care team, a small nutraceutical shop, a journal, and book-now calls to
// action. It exercises builder + cms + commerce + email. Everything installs to
// DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Design notes — this template is deliberately RICH (the anti-bland test):
//   · It drives the THEME's v2 presentation overlay (docs/33 §3) to a warm
//     cream / sand / forest palette, so the whole site reads boutique-organic
//     rather than stark-white. The brand layers teal (primary) + mustard (accent)
//     over it. base-content = deep forest, so `surface:'inverse'` bands are forest.
//   · It works a COLOUR RHYTHM through the page: photo hero → teal stat band →
//     cream services → sand concerns → forest "what's different" → teal concierge
//     → cream team → sand process → cream story. No two flat-white sections in a
//     row (the thing that made v1 bland).
//   · Service / differentiator cards lead with a crisp LINE ICON (the source's
//     minimalist-icon aesthetic) — no incoherent stock photos. Real photography
//     is reserved for where it belongs: the hero, the botanical concerns band,
//     the team portraits, and the founder story.
//   · Static imagery hot-links CURATED, specific Unsplash photo ids (docs/54
//     §6 D3) — hand-picked per slot (serene treatment hero, warm team portraits,
//     a calming botanical, clinical journal art) so the site looks art-directed,
//     not stock-randomised.
//   · Layouts/grids/rows lean on the responsive renderer (docs/59): grids
//     collapse 1→2→N and rows-of-containers stack on mobile automatically.

import {
  navbar,
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
const rid = (t: string): string => `enw-${t}-${(nid += 1)}`;

function node(
  type: string,
  opts: {
    box?: BoxStyle;
    layout?: LayoutStyle;
    props?: Record<string, unknown>;
    bind?: string;
    /** Extra verbatim classes (e.g. an archetype/recipe seed). */
    cls?: string;
    /** Verbatim node name (e.g. for raw `el:*` site-chrome zones). */
    name?: string;
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

/** A curated, hot-linked photo (docs/54 §6 D3). We pin a SPECIFIC Unsplash
 *  photo id rather than a keyword feed (loremflickr's tag matching is too loose
 *  — it served a street-cat statue for "spa,wellness,calm"), so the installed
 *  site looks intentionally art-directed. `auto=format` serves WebP/AVIF and
 *  `fit=crop` honours the requested aspect ratio. */
const unsplash = (id: string, w = 1200, h = 900): string =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

// ── Reusable pieces ──────────────────────────────────────────────────────────

/** A core-service card — line icon + title + short description, on a card. */
function serviceCard(icon: string, title: string, body: string): BuilderNode {
  return node('Card', {
    box: { name: title, surface: 'subtle', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Icon', { props: { name: icon } }),
      node('Heading', { props: { level: 'h3', text: title } }),
      node('Text', { props: { variant: 'body', text: body } }),
    ],
  });
}

/** A "what makes us different" point — line icon + title + body, on the forest
 *  band (no card surface; the band itself carries the colour). */
function differenceCard(icon: string, title: string, body: string): BuilderNode {
  return node('Stack', {
    box: { name: title, surface: 'none', padding: 'none' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Icon', { props: { name: icon } }),
      node('Heading', { props: { level: 'h3', text: title } }),
      node('Text', { props: { variant: 'body', text: body } }),
    ],
  });
}

/** A condition we treat — a single scannable line with a leading accent mark. */
function concernLine(text: string): BuilderNode {
  return node('Text', { box: { padding: 'sm' }, props: { variant: 'body', text: `›  ${text}` } });
}

/** A membership benefit line. */
function benefitLine(text: string): BuilderNode {
  return node('Text', { props: { variant: 'body', text: `✓  ${text}` } });
}

/** A KPI for the trust band. */
function statItem(value: string, label: string): BuilderNode {
  return node('Stat', { props: { value, label } });
}

/** A static team card — a tall portrait via box.backgroundImage, name + role. */
function teamCard(img: string, name: string, role: string): BuilderNode {
  return node('Card', {
    box: { name, surface: 'none', padding: 'none' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Section', {
        box: {
          name: 'Portrait',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'full',
          padding: 'none',
          backgroundImage: img,
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
    box: { name: title, surface: 'none', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h2', text: num } }),
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
      // HERO — full-bleed warm photo, top+bottom gradient scrim, light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: unsplash('photo-1512290923902-8a9f81dc236c', 2000, 1200),
          overlay: 'gradient',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'md', justify: 'center', alignItems: 'center' },
        children: [
          node('Text', {
            props: { variant: 'eyebrow', text: 'Boutique wellness · Lynchburg, VA' },
          }),
          node('Heading', { props: { level: 'h1', text: 'Feel like you again.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Personalized, science-backed care for your hormones, weight, energy — and everything that makes you, you.',
            },
          }),
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', gap: 'sm', justify: 'center', alignItems: 'center' },
            children: [
              node('Button', {
                props: { label: 'Book an appointment', style: 'glass', href: '/contact' },
              }),
              node('Button', {
                props: { label: 'Our services', style: 'dark', href: '/services' },
              }),
            ],
          }),
        ],
      }),

      // TRUST — a teal band of KPIs, the first hit of brand colour.
      node('Section', {
        box: { name: 'Trust', surface: 'brand', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'none' },
        children: [
          node('Grid', {
            box: { name: 'Stats grid', padding: 'none' },
            layout: { direction: 'grid', columns: 4, gap: 'lg' },
            children: [
              statItem('1,200+', 'patients cared for'),
              statItem('15+ yrs', 'clinical experience'),
              statItem('4', 'core therapies'),
              statItem('98%', 'would refer a friend'),
            ],
          }),
        ],
      }),

      // SERVICES — the four core programs, icon-led cards on cream.
      node('Section', {
        box: { name: 'Services', surface: 'none', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'What we do' } }),
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
                'activity',
                'Bio-Identical Hormone Therapy',
                'Restore balance, energy, mood and sleep with hormones matched to your labs and your life.'
              ),
              serviceCard(
                'scale',
                'Weight Loss Program',
                'A guided, 12-week medical program built to help you reach your goals — and actually keep them.'
              ),
              serviceCard(
                'droplet',
                'IV Therapy',
                'Targeted infusions that rehydrate, replenish and restore from the inside out.'
              ),
              serviceCard(
                'wind',
                'Ozone Therapy',
                'Advanced ozone therapy to support immunity, energy and whole-body wellness.'
              ),
            ],
          }),
          node('Button', {
            props: { label: 'Explore all services', style: 'soft', href: '/services' },
          }),
        ],
      }),

      // CONCERNS — botanical photo beside the conditions list, on a sand band.
      node('Section', {
        box: { name: 'Concerns', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        // Two-column image|text: a GRID (not a row) so the image-only column claims
        // half the width. A flex row collapses a child that has only a background
        // image (no content) to 0 width. Collapses to 1 column on mobile (docs/59).
        layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Botanical',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: unsplash('photo-1502082553048-f009c37129b9', 800, 1000),
            },
          }),
          node('Stack', {
            box: { name: 'Concerns copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
            children: [
              node('Text', { props: { variant: 'eyebrow', text: 'Root-cause medicine' } }),
              node('Heading', {
                props: { level: 'h2', text: "We'll help you navigate these challenges" },
              }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Deeper diagnostics and tailored plans to uncover and address the root cause — not just quiet the symptoms.',
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
                  concernLine('Mold toxicity'),
                  concernLine('Nutrient deficiencies'),
                ],
              }),
            ],
          }),
        ],
      }),

      // DIFFERENTIATORS — the dramatic forest band, icon-led, light text.
      node('Section', {
        box: { name: 'Difference', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'Why Endura' } }),
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
                'target',
                'Root-cause approach',
                "We don't just treat symptoms — we identify and address the underlying cause."
              ),
              differenceCard(
                'heart-handshake',
                'Concierge care',
                "You're never just a number. Every visit is unhurried, one-on-one support."
              ),
              differenceCard(
                'microscope',
                'Cutting-edge treatments',
                'Progressive, science-backed therapies used in clinics worldwide.'
              ),
              differenceCard(
                'home',
                'A boutique experience',
                'A warm, inviting, stress-free space designed entirely around your comfort.'
              ),
            ],
          }),
        ],
      }),

      // CONCIERGE MEMBERSHIP — a teal band: the plan beside its benefits.
      node('Section', {
        box: { name: 'Concierge', surface: 'brand', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'lg', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { name: 'Plan intro', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Text', { props: { variant: 'eyebrow', text: 'Concierge Wellness Plan' } }),
              node('Heading', { props: { level: 'h2', text: 'Elite care, extraordinary access' } }),
              node('Text', {
                props: {
                  variant: 'body',
                  text: 'Exclusive benefits for ongoing hormone-therapy patients — designed to save you money and give you VIP access to your care team.',
                },
              }),
              node('Heading', { props: { level: 'h1', text: '$99 / month' } }),
              node('Text', {
                props: {
                  variant: 'meta',
                  text: 'Save $700–$800 per year while getting priority, personalized care.',
                },
              }),
              node('Button', {
                props: { label: 'Join the plan', style: 'glass', href: '/contact' },
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

      // TEAM — tall portrait cards on cream.
      node('Section', {
        box: { name: 'Team', surface: 'none', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'Your care team' } }),
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
                unsplash('photo-1559839734-2b71ea197ec2', 600, 800),
                'Brittany Brown, NP',
                'Founder · Nurse Practitioner'
              ),
              teamCard(
                unsplash('photo-1594824476967-48c8b964273f', 600, 800),
                'Megan Ringi, RN',
                'Registered Nurse'
              ),
              teamCard(
                unsplash('photo-1573496359142-b8d87734a5a2', 600, 800),
                'Daria Ray',
                'Patient Coordinator'
              ),
            ],
          }),
        ],
      }),

      // PROCESS — three big-numbered steps on a sand band.
      node('Section', {
        box: { name: 'Process', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'Getting started' } }),
          node('Heading', { props: { level: 'h2', text: 'Your wellness journey, step by step' } }),
          node('Grid', {
            box: { name: 'Steps grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              stepCard(
                '01',
                'Schedule your consultation',
                'Book an initial visit and tell us your story. Your service fee is included.'
              ),
              stepCard(
                '02',
                'Build your plan',
                'Together we design a tailored, science-backed treatment plan around your goals.'
              ),
              stepCard(
                '03',
                'Begin your journey',
                'Start treatment with concierge support and check-ins every step of the way.'
              ),
            ],
          }),
        ],
      }),

      // STORY — founder photo beside the origin story, on cream.
      node('Section', {
        box: { name: 'Story', surface: 'none', padding: 'xl', contentWidth: 'contained' },
        // GRID, not a row — see the Concerns note: an image-only column needs a
        // grid track to claim width (a flex row collapses it to 0).
        layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'center' },
        children: [
          node('Section', {
            box: {
              name: 'Founder photo',
              height: 'lg',
              backgroundWidth: 'full',
              contentWidth: 'full',
              padding: 'none',
              backgroundImage: unsplash('photo-1559839734-2b71ea197ec2', 800, 1000),
            },
          }),
          node('Stack', {
            box: { name: 'Story copy', padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Text', { props: { variant: 'eyebrow', text: 'Our story' } }),
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

      // SHOP — the nutraceutical shelf; iterates products from Commerce.
      node('Section', {
        box: { name: 'Shop', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'The shelf' } }),
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
        box: { name: 'Journal', surface: 'none', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'The journal' } }),
          node('Heading', { props: { level: 'h2', text: 'Notes on feeling your best' } }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Article card', surface: 'subtle', padding: 'sm' },
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

      // CONVERSION — closing forest band: book CTA + join the list (Signup).
      node('Section', {
        box: {
          name: 'Conversion',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'Ready when you are' } }),
          node('Heading', {
            props: { level: 'h2', text: 'Now is the time to transform your health' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Book a consultation in under a minute — or join the list for wellness tips, exclusive offers and science-backed insights.',
            },
          }),
          node('Button', {
            props: { label: 'Book an appointment', style: 'glass', href: '/contact' },
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
          height: 'md',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: unsplash('photo-1600334089648-b0d9d3028eb2', 2000, 900),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Text', { props: { variant: 'eyebrow', text: 'What we do' } }),
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
        box: { name: 'Service detail', surface: 'none', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          node('Grid', {
            box: { name: 'Services grid', padding: 'none' },
            layout: { direction: 'grid', columns: 2, gap: 'lg' },
            children: [
              serviceCard(
                'activity',
                'Bio-Identical Hormone Therapy',
                'Bio-identical hormones matched to your body restore energy, mood, sleep and libido. We dose from comprehensive labs and adjust as you feel better — pellets, injections or creams.'
              ),
              serviceCard(
                'scale',
                'Weight Loss Program',
                'A medically guided, 12-week program combining modern medications, nutrition coaching and accountability so the weight comes off and stays off.'
              ),
              serviceCard(
                'droplet',
                'IV Therapy',
                'Custom IV infusions deliver vitamins, minerals and antioxidants straight to your bloodstream for hydration, immune support, recovery and an energy reset.'
              ),
              serviceCard(
                'wind',
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
      node('Text', { props: { variant: 'eyebrow', text: 'The journal' } }),
      node('Heading', { props: { level: 'h1', text: 'Notes on feeling your best' } }),
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
        box: { name: 'Body', surface: 'none', padding: 'lg', contentWidth: 'contained' },
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
        box: { name: 'Body', surface: 'none', padding: 'lg', contentWidth: 'contained' },
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
      navbar(node, {
        start: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', collapse: false, gap: 'sm', alignItems: 'center' },
            children: [
              node('Wordmark', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Endura Wellness' } }),
            ],
          }),
        ],
        end: [
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
  version: '0.3.1',
  name: 'Wellness Clinic',
  summary:
    'A boutique wellness-clinic site with a tailored service menu (hormone therapy, weight loss, IV & ozone), a concierge membership band, a care team, a small nutraceutical shop, a journal, and book-now calls to action — warm, photography-led, and ready to review.',
  vertical: 'services',
  preview: '/blueprint-previews/endura-wellness.png',
  requiresModules: ['builder', 'cms', 'commerce', 'email'],

  brand: {
    businessName: 'Endura Wellness',
    tagline: 'Feel like you again.',
    colors: {
      primary: '#0F766E',
      primaryForeground: '#FBF8F1',
      accent: '#C2954A',
      secondary: '#1C3A33',
    },
    fonts: { heading: 'Fraunces', body: 'Jost' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drift` preset. The KEY to not-bland is the v2 presentation overlay — it
  // repaints the neutral palette warm (cream page, sand sections, deep-forest
  // text + inverse bands), so the teal/mustard brand reads boutique-organic.
  theme: {
    name: 'Endura',
    basePresetKey: 'drift',
    presentation: {
      v: 2,
      containerWidth: '1200px',
      light: {
        base100: '#FBF8F1', // warm cream — the page background
        base200: '#F2E9D8', // sand — `surface:'subtle'` sections
        base300: '#E7D9C0', // deeper sand — `surface:'muted'`
        baseContent: '#1C3A33', // deep forest — text + `surface:'inverse'` band fill
        border: '#E2D5BE',
      },
    },
    brand: {
      colorPrimary: '#0F766E',
      colorPrimaryForeground: '#FBF8F1',
      colorAccent: '#C2954A',
      colorSecondary: '#1C3A33',
      fontHeading: 'Fraunces',
      fontBody: 'Jost',
      tokens: { radiusBase: '16px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Endura+Wellness&background=0F766E&color=FBF8F1&bold=true&size=128&format=svg',
      alt: 'Endura Wellness',
    },
    // Nutraceutical product imagery (curated Unsplash, colour-hinted per SKU).
    {
      id: 'prod-multi',
      url: unsplash('photo-1607619056574-7b8d3ee536b2', 1000, 1000),
      alt: 'Daily Foundations Multivitamin',
    },
    {
      id: 'prod-d3k2',
      url: unsplash('photo-1577563908411-5077b6dc7624', 1000, 1000),
      alt: 'Vitamin D3 + K2',
    },
    {
      id: 'prod-mag',
      url: unsplash('photo-1471864190281-a93a3070b6de', 1000, 1000),
      alt: 'Magnesium Glycinate',
    },
    {
      id: 'prod-omega',
      url: unsplash('photo-1626716493137-b67fe9501e76', 1000, 1000),
      alt: 'Omega-3 Fish Oil',
    },
    {
      id: 'prod-bcomplex',
      url: unsplash('photo-1585435557343-3b092031a831', 1000, 1000),
      alt: 'Methylated B-Complex',
    },
    // Journal featured images.
    {
      id: 'journal-1-img',
      url: unsplash('photo-1499209974431-9dddcece7f88', 800, 600),
      alt: 'Hormone balance',
    },
    {
      id: 'journal-2-img',
      url: unsplash('photo-1612277795421-9bc7706a4a34', 800, 600),
      alt: 'IV therapy session',
    },
    {
      id: 'journal-3-img',
      url: unsplash('photo-1512621776951-a57141f2eefd', 800, 600),
      alt: 'Healthy meal prep',
    },
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
