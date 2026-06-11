// A fitness studio blueprint (docs/54 §12, sibling of retail-store-blog.ts):
// a high-energy strength & conditioning gym — "Forge Athletic Club" — with a
// class schedule, a static membership pricing table, coach-written class notes in
// the journal, about/contact pages, and join-now calls to action. No commerce —
// memberships and drop-ins are handled off-platform, so pricing is STATIC content
// in the home tree. It exercises builder + cms + email. Everything installs to
// DRAFT (docs/54 D4); the tenant reviews, customizes, and goes live.
//
// Authoring notes:
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · The membership pricing table is STATIC (no online checkout) — built from
//     Stack/Heading/Text in the home tree.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (posts) comes from the seeded assets.

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
const rid = (t: string): string => `fit-${t}-${(nid += 1)}`;

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

// ── Page trees ─────────────────────────────────────────────────────────────────

/** One static membership plan — a card with name, price meta, and perk lines. */
function planCard(name: string, price: string, perks: string[]): BuilderNode {
  return node('Card', {
    box: { name: `${name} plan`, surface: 'subtle', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'meta', text: price } }),
      ...perks.map((p) => node('Text', { props: { variant: 'body', text: p } })),
    ],
  });
}

/** One static schedule line — a class name with a "day · time · coach" meta. */
function scheduleLine(name: string, meta: string): BuilderNode {
  return node('Stack', {
    box: { name, padding: 'sm' },
    layout: { direction: 'stack', gap: 'none', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: name } }),
      node('Text', { props: { variant: 'meta', text: meta } }),
    ],
  });
}

function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // HERO — full-bleed gym floor photo with a dark scrim + light text.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('forge-hero-floor', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', { props: { level: 'h1', text: 'Train hard. Move well. Stay forged.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A coach-led strength and conditioning club built for real people getting genuinely stronger — your first class is on us.',
            },
          }),
          node('Button', {
            props: { label: 'Book a free class', style: 'primary', href: '/contact' },
          }),
        ],
      }),

      // PROGRAMS — three static program cards.
      node('Section', {
        box: { name: 'Programs', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Ways to train' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Whether you are chasing a first pull-up or a heavier deadlift, there is a coached track for you.',
            },
          }),
          node('Grid', {
            box: { name: 'Programs grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              node('Card', {
                box: { name: 'Strength', surface: 'subtle', padding: 'lg' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Strength' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Barbell-focused sessions to build real, measurable strength under a coach who knows your numbers.',
                    },
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Conditioning', surface: 'subtle', padding: 'lg' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Conditioning' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'High-energy interval classes that build a bigger engine without grinding your joints to dust.',
                    },
                  }),
                ],
              }),
              node('Card', {
                box: { name: 'Mobility', surface: 'subtle', padding: 'lg' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Mobility' } }),
                  node('Text', {
                    props: {
                      variant: 'body',
                      text: 'Restorative sessions to move better, recover faster, and keep training for the long haul.',
                    },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // SCHEDULE — a static weekly schedule, scannable columns.
      node('Section', {
        box: { name: 'Schedule', surface: 'inverse', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'This week on the floor' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Drop into any class on the schedule — no reservation needed for members, and first-timers always train free.',
            },
          }),
          node('Grid', {
            box: { name: 'Schedule grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              node('Stack', {
                box: { name: 'Morning column', padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Mornings' } }),
                  scheduleLine('Barbell Strength', 'Mon · Wed · Fri · 6:00am · Coach Reyes'),
                  scheduleLine('Engine Builder', 'Tue · Thu · 6:30am · Coach Okafor'),
                ],
              }),
              node('Stack', {
                box: { name: 'Midday column', padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Middays' } }),
                  scheduleLine('Lunch Lift', 'Mon–Fri · 12:00pm · Rotating coach'),
                  scheduleLine('Mobility Reset', 'Wed · 1:00pm · Coach Hale'),
                ],
              }),
              node('Stack', {
                box: { name: 'Evening column', padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  node('Heading', { props: { level: 'h3', text: 'Evenings' } }),
                  scheduleLine('Conditioning', 'Mon · Wed · 6:00pm · Coach Okafor'),
                  scheduleLine('Open Strength', 'Tue · Thu · 6:00pm · Coach Reyes'),
                ],
              }),
            ],
          }),
        ],
      }),

      // PRICING — a STATIC membership table (no online checkout).
      node('Section', {
        box: { name: 'Pricing', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Membership' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'No contracts, no sign-up fees, cancel anytime. Every plan includes coaching, programming, and the whole class schedule.',
            },
          }),
          node('Grid', {
            box: { name: 'Plans grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              planCard('Drop-in', '$25 / class', [
                'Any class on the schedule',
                'No commitment',
                'Great for visitors',
              ]),
              planCard('Unlimited', '$159 / month', [
                'Unlimited classes',
                'Personalized programming',
                'Free InBody scan each month',
              ]),
              planCard('Founders', '$199 / month', [
                'Everything in Unlimited',
                'Two private coaching sessions monthly',
                'Open-gym access all hours',
              ]),
            ],
          }),
        ],
      }),

      // COACH NOTES — CMS as another section; iterates posts.
      node('Section', {
        box: { name: 'Coach notes', surface: 'subtle', padding: 'xl', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'From the coaches' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Class write-ups, lifting cues, and the thinking behind how we program.',
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

      // CONVERSION — centered band: join CTA + join the list (Signup).
      node('Section', {
        box: {
          name: 'Conversion',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', { props: { level: 'h2', text: 'Your first class is free' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Come try the floor with no pressure — or join the list for class updates, open spots, and the occasional training tip.',
            },
          }),
          node('Button', {
            props: { label: 'Book a free class', style: 'primary', href: '/contact' },
          }),
          node('Signup', { props: { cta: 'Join the list' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function blogIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Coach notes', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Coach notes' } }),
      node('Text', {
        props: { variant: 'body', text: 'Class write-ups, lifting cues, and how we think about training.' },
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
        layout: { direction: 'row', collapse: false, justify: 'between', alignItems: 'center' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', collapse: false, gap: 'sm', alignItems: 'center' },
            children: [
              node('Wordmark', { bind: 'site.identity' }),
              node('Heading', { props: { level: 'h3', text: 'Forge Athletic Club' } }),
            ],
          }),
          node('NavMenu', {
            props: {
              orientation: 'row',
              links: [
                { label: 'Coach notes', href: '/notes' },
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
          surface: 'inverse',
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
                { label: 'Coach notes', href: '/notes' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', { props: { variant: 'meta', text: '© Forge Athletic Club' } }),
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to the Forge' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: "You're on the list. Here's how to book your first free class and what to expect when you walk through the door.",
        },
      }),
      node('Button', { props: { label: 'Book a free class', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', { props: { variant: 'meta', text: 'Questions before you come in? Just reply to this email.' } }),
    ],
  });
}

function newsletterEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'New classes & open spots this month' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'A few schedule changes, a new conditioning slot, and a training tip from the coaches to carry into the week.',
        },
      }),
      node('Button', { props: { label: 'See the schedule', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: "You're receiving this because you joined the list at Forge Athletic Club.",
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'fitness-studio',
  version: '1.0.0',
  name: 'Fitness Studio',
  summary:
    'A high-energy strength & conditioning club site with a class schedule, a static membership pricing table, coach-written class notes, about/contact pages, and book-a-class calls to action — themed and ready to review.',
  vertical: 'services',
  requiresModules: ['builder', 'cms', 'email'],

  brand: {
    businessName: 'Forge Athletic Club',
    tagline: 'Strength & conditioning, coached.',
    colors: {
      primary: '#e8590c',
      primaryForeground: '#FFFFFF',
      accent: '#c2255c',
      secondary: '#16110D',
    },
    fonts: { heading: 'Sora', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `drop` preset — bold and high-contrast to match the club identity above.
  theme: {
    name: 'Forge',
    basePresetKey: 'drop',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#e8590c',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#c2255c',
      fontHeading: 'Sora',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Forge+Athletic&background=e8590c&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Forge Athletic Club',
    },
    // Journal featured images.
    { id: 'note-deadlift-img', url: pic('forge-note-deadlift', 800, 600), alt: 'Athlete setting up a deadlift' },
    { id: 'note-engine-img', url: pic('forge-note-engine', 800, 600), alt: 'Rowing intervals on the floor' },
    { id: 'note-recover-img', url: pic('forge-note-recover', 800, 600), alt: 'Mobility and stretching session' },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types in v1.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'own-your-deadlift-setup',
      body: {
        title: 'Own your deadlift setup',
        excerpt: 'The five seconds before the bar leaves the floor decide the whole lift.',
        body: doc(
          'A great deadlift is won before it moves. Walk to the bar, set your feet hip-width with the bar over your mid-foot, and take the same approach every single rep.',
          'Hinge to the bar without dropping your hips too early, grip just outside your knees, then pull the slack out of the bar until you feel it click against the plates.',
          'Brace like someone is about to push you, drive the floor away, and keep the bar close all the way up. Same setup, every time — that consistency is what lets you add weight safely.'
        ),
        featuredImage: assetRef('note-deadlift-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'building-a-bigger-engine',
      body: {
        title: 'Building a bigger engine',
        excerpt: 'Why our conditioning is steadier than it looks — and how to pace it.',
        body: doc(
          'Conditioning is not about destroying yourself; it is about repeatable output. The athletes who improve fastest hold a pace they can sustain, not the one that looks impressive for ninety seconds.',
          'In our Engine Builder classes we coach effort by feel: a hard but controllable seven out of ten that you could hold a short sentence through. That is the zone where the engine actually grows.',
          'Negative splits are the goal — finish each interval a touch faster than you started. Leave a rep in the tank early and you will pass the people who blew up in the first round.'
        ),
        featuredImage: assetRef('note-engine-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'recovery-is-training-too',
      body: {
        title: 'Recovery is training too',
        excerpt: 'The unglamorous habits that let you keep showing up week after week.',
        body: doc(
          'You do not get stronger in the session; you get stronger recovering from it. The work on the floor is only the stimulus — sleep, food, and easy movement are where the adaptation happens.',
          'Aim for seven to nine hours of sleep, enough protein to actually rebuild tissue, and a daily walk to keep blood moving. None of it is exciting, and all of it works.',
          'Our Mobility Reset class exists for exactly this: ten minutes of breathing and slow range-of-motion that pays off as fewer tweaks and more consistent training over a year.'
        ),
        featuredImage: assetRef('note-recover-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Forge Athletic Club',
        excerpt: 'A coach-led club for people getting genuinely stronger.',
        body: doc(
          'Forge opened with a simple belief: most people do not need a fancier gym, they need real coaching and a room that expects them to show up.',
          'We keep classes small enough that a coach knows your name, your numbers, and the thing your left shoulder does not like. Everyone trains the same programming, scaled to where they actually are today.',
          'No mirrors-and-selfies culture, no judgement, no contracts. Just barbells, a clock, and a crew that gets a little stronger together every week.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Visit & book a class',
        excerpt: 'Find the club, book your free first class, or ask us anything.',
        body: doc(
          'We are at 220 Iron Works Road, with parking out back and a roll-up door we keep open when the weather is good. Staffed hours are Monday to Friday 5am to 8pm and Saturday 7am to noon.',
          'To book your free first class, call (555) 010-3344 or email hello@forgeathletic.example and tell us when you want to come in. Bring trainers, water, and zero experience required.',
          'For corporate sessions, personal training, or facility rentals, reach out the same way and we will get back within a business day.'
        ),
      },
    },
  ],

  components: [],

  layout: { name: 'Forge layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Forge Athletic Club' },
    { name: 'Coach notes', kind: 'singleton', slug: 'notes', tree: blogIndexTree() },
    {
      name: 'Blog post',
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
      subject: 'Welcome to the Forge',
      preheader: "You're on the list — here's how to book your first class.",
      tree: welcomeEmailTree(),
    },
    {
      name: 'Class newsletter',
      subject: 'New classes & open spots this month',
      preheader: 'Schedule changes, a new conditioning slot, and a training tip.',
      tree: newsletterEmailTree(),
    },
  ],
};

export const fitnessStudio: Blueprint = parseBlueprint(manifest);
