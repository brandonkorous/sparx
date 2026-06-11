// A nonprofit organization blueprint ("Open Harbor") — a mission-led, content
// site for a community organization. The first CONTENT-vertical blueprint in
// this batch: no commerce at all, so requiresModules = builder + cms + email.
// It exercises brand + a NEW shipped theme over `apex`, CMS content (impact
// stories + program/about/contact pages), builder pages + the site layout, and
// marketing emails — and threads a prominent "Donate" call to action through the
// home page and the site header. Everything installs to DRAFT (docs/54 D4); the
// tenant reviews, customizes, and goes live.
//
// Authoring notes (mirror retail-store-blog.ts):
//   · Trees are real @sparx/builder-schemas nodes (same JSON the editor emits)
//     and bind via tokens, so they re-theme to whatever tenant installs them.
//   · Static imagery in trees hot-links a raw URL (box.backgroundImage); imagery
//     bound to records (posts) comes from the seeded assets.
//   · Placeholder images hot-link picsum.photos — swap for owned media when the
//     install path moves to copy-into-tenant-media (docs/54 §6 deferred).

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
const rid = (t: string): string => `npo-${t}-${(nid += 1)}`;

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

/** A static stat card: a big number + a short label. */
function statCard(figure: string, label: string): BuilderNode {
  return node('Card', {
    box: { name: label, surface: 'subtle', padding: 'lg' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h2', text: figure } }),
      node('Text', { props: { variant: 'body', text: label } }),
    ],
  });
}

/** A static program card: a heading + a line of supporting copy. */
function programCard(heading: string, body: string): BuilderNode {
  return node('Card', {
    box: { name: heading, surface: 'none', padding: 'md' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      node('Heading', { props: { level: 'h3', text: heading } }),
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
      // HERO — full-bleed community photo, dark scrim + light text, Donate CTA.
      node('Section', {
        box: {
          name: 'Hero',
          height: 'lg',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
          backgroundImage: pic('harbor-hero-community', 2000, 1100),
          overlay: 'dark',
          textTone: 'light',
        },
        layout: { direction: 'stack', gap: 'sm', justify: 'center', alignItems: 'center' },
        children: [
          node('Heading', {
            props: { level: 'h1', text: 'Everyone deserves a safe place to land.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Open Harbor provides housing support, hot meals, and a steady hand to neighbors facing hard times — for as long as it takes to get back on solid ground.',
            },
          }),
          node('Stack', {
            box: { name: 'Hero actions', padding: 'none' },
            layout: { direction: 'row', gap: 'sm', alignItems: 'center' },
            children: [
              node('Button', { props: { label: 'Donate', style: 'primary', href: '/donate' } }),
              node('Button', { props: { label: 'See our programs', style: 'soft', href: '/programs' } }),
            ],
          }),
        ],
      }),

      // IMPACT STATS — static figures.
      node('Section', {
        box: { name: 'Impact', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'What your support makes possible.' } }),
          node('Grid', {
            box: { name: 'Stat grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              statCard('1,200+', 'neighbors housed or rehoused last year'),
              statCard('85,000', 'hot meals served from our community kitchen'),
              statCard('92¢', 'of every dollar goes straight to programs'),
            ],
          }),
        ],
      }),

      // PROGRAMS — static program cards.
      node('Section', {
        box: { name: 'Programs', surface: 'subtle', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'How we help.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Three connected programs meet people where they are — and walk with them all the way back.',
            },
          }),
          node('Grid', {
            box: { name: 'Program grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            children: [
              programCard(
                'Housing Support',
                'Emergency shelter, rapid rehousing, and rental assistance to keep families off the street and in a home.'
              ),
              programCard(
                'Community Kitchen',
                'Three hot, dignified meals a day, no questions asked — plus a grocery pantry for households stretching a budget.'
              ),
              programCard(
                'Pathways to Work',
                'Job coaching, résumé help, and steady mentorship to turn a hard season into a fresh start.'
              ),
            ],
          }),
          node('Button', {
            box: { align: 'start' },
            props: { label: 'Explore the programs', style: 'soft', href: '/programs' },
          }),
        ],
      }),

      // STORIES — CMS as a section; iterates impact-story posts.
      node('Section', {
        box: { name: 'Stories', padding: 'lg', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [
          node('Heading', { props: { level: 'h2', text: 'Stories from the harbor.' } }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'Real people, real turning points — shared with permission, in their own words.',
            },
          }),
          node('Grid', {
            box: { name: 'Posts grid', padding: 'none' },
            layout: { direction: 'grid', columns: 3, gap: 'lg' },
            bind: 'cms.blog_post',
            children: [
              node('Card', {
                box: { name: 'Story card', surface: 'subtle', padding: 'md' },
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

      // DONATE BAND — prominent inverse band, Donate CTA + newsletter signup.
      node('Section', {
        box: {
          name: 'Donate',
          surface: 'inverse',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
          padding: 'xl',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        bind: 'crm.list',
        children: [
          node('Heading', {
            props: { level: 'h2', text: 'Give once, or stand with us every month.' },
          }),
          node('Text', {
            props: {
              variant: 'body',
              text: 'A gift of any size keeps the lights on and the kitchen open. Monthly donors are the steady tide that lets us plan ahead — and 92¢ of every dollar reaches a neighbor in need.',
            },
          }),
          node('Button', { props: { label: 'Donate', style: 'primary', href: '/donate' } }),
          node('Signup', { props: { cta: 'Get our newsletter' }, bind: 'crm.list' }),
        ],
      }),
    ],
  });
}

function storiesIndexTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Stories', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Stories from the harbor' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Real people, real turning points — shared with permission, in their own words.',
        },
      }),
      node('Grid', {
        box: { name: 'Posts grid', padding: 'none' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        bind: 'cms.blog_post',
        children: [
          node('Card', {
            box: { name: 'Story card', surface: 'subtle', padding: 'md' },
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
    box: { name: 'Story', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
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
          node('Button', { props: { label: 'Donate', style: 'primary', href: '/donate' } }),
        ],
      }),
    ],
  });
}

// A `cms.page` template (About, Programs, Contact, …) — binds the page entry's fields.
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
              node('Heading', { props: { level: 'h3', text: 'Open Harbor' } }),
            ],
          }),
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'row', collapse: false, gap: 'md', alignItems: 'center' },
            children: [
              node('NavMenu', {
                props: {
                  orientation: 'row',
                  links: [
                    { label: 'Programs', href: '/programs' },
                    { label: 'Stories', href: '/stories' },
                    { label: 'About', href: '/about' },
                    { label: 'Contact', href: '/contact' },
                  ],
                },
              }),
              // The Donate CTA lives in the header, visible on every page.
              node('Button', { props: { label: 'Donate', style: 'primary', href: '/donate' } }),
            ],
          }),
        ],
      }),
      node('Outlet', { box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' } }),
      node('Section', {
        box: {
          name: 'Footer',
          surface: 'muted',
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
                { label: 'Programs', href: '/programs' },
                { label: 'Stories', href: '/stories' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
          }),
          node('SocialLinks', { bind: 'site.social' }),
          node('Text', {
            props: { variant: 'meta', text: '© Open Harbor · A registered 501(c)(3) nonprofit' },
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
      node('Heading', { props: { level: 'h1', text: 'Welcome to Open Harbor' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thank you for joining our community. We’ll share stories from the people you’re helping, updates from our programs, and clear ways to get involved — never more than we’d want to receive ourselves.',
        },
      }),
      node('Button', { props: { label: 'Donate today', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: { variant: 'meta', text: 'Questions, or want to volunteer? Just reply to this email.' },
      }),
    ],
  });
}

function impactEmailTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('Heading', { props: { level: 'h1', text: 'Your impact this month' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Here’s what your support made possible this month — neighbors housed, meals served, and a story of someone whose life turned a corner because of people like you.',
        },
      }),
      node('Button', { props: { label: 'Read this month’s stories', href: '' }, box: { align: 'start' } }),
      node('Divider'),
      node('Text', {
        props: {
          variant: 'meta',
          text: 'You’re receiving this because you signed up to support Open Harbor.',
        },
      }),
    ],
  });
}

// ── The manifest ───────────────────────────────────────────────────────────────

const manifest = {
  key: 'nonprofit-org',
  version: '1.0.0',
  name: 'Nonprofit Organization',
  summary:
    'A mission-led site for a community nonprofit — impact stories, program pages, a prominent donate call to action, and a supporter newsletter. No commerce; content-only, themed and ready to review.',
  vertical: 'content',
  requiresModules: ['builder', 'cms', 'email'],

  brand: {
    businessName: 'Open Harbor',
    tagline: 'Everyone deserves a safe place to land.',
    colors: {
      primary: '#0e7490',
      primaryForeground: '#FFFFFF',
      accent: '#f4a259',
      secondary: '#0b3a47',
    },
    fonts: { heading: 'Poppins', body: 'Inter' },
    logoLightAssetId: 'logo',
  },

  // The NEW theme this blueprint ships (docs/54 D5): a named SiteTheme over the
  // `apex` preset — a trustworthy deep teal with a warm amber accent.
  theme: {
    name: 'Harbor',
    basePresetKey: 'apex',
    presentation: { v: 2, containerWidth: '1140px' },
    brand: {
      colorPrimary: '#0e7490',
      colorPrimaryForeground: '#FFFFFF',
      colorAccent: '#f4a259',
      fontHeading: 'Poppins',
      fontBody: 'Inter',
      tokens: { radiusBase: '8px' },
    },
    apply: true,
  },

  assets: [
    {
      id: 'logo',
      url: 'https://ui-avatars.com/api/?name=Open+Harbor&background=0e7490&color=FFFFFF&bold=true&size=128&format=svg',
      alt: 'Open Harbor',
    },
    // Impact-story featured images.
    {
      id: 'story-maria-img',
      url: pic('harbor-story-maria', 1200, 750),
      alt: 'A family at the doorway of their new apartment',
    },
    {
      id: 'story-kitchen-img',
      url: pic('harbor-story-kitchen', 1200, 750),
      alt: 'Volunteers serving meals in the community kitchen',
    },
    {
      id: 'story-james-img',
      url: pic('harbor-story-james', 1200, 750),
      alt: 'A man at his first day on a new job',
    },
  ],

  // Lean on built-in content types (page, blog_post) — no custom types.
  contentTypes: [],

  content: [
    {
      typeKey: 'blog_post',
      slug: 'marias-front-door',
      body: {
        title: 'Maria’s front door',
        excerpt:
          'After eight months in a car with two kids, a set of keys changed everything. This is what stable housing really does.',
        body: doc(
          'When Maria first came to Open Harbor, she and her two children had been sleeping in their car for eight months. She wasn’t looking for a handout — she was working two jobs — but a sudden eviction and first-and-last-month’s rent had put a door of her own out of reach.',
          'Our rapid rehousing program covered her deposit and bridged three months of rent while she stabilized. A housing advocate sat with her through every application and landlord call. Six weeks later, Maria turned a key in a lock that was hers.',
          '“The first night, the kids just kept opening and closing the front door,” she told us. “They couldn’t believe it stayed.” Maria is now current on rent on her own, and her oldest made the honor roll for the first time. A door, it turns out, is never just a door.'
        ),
        featuredImage: assetRef('story-maria-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'a-table-with-room',
      body: {
        title: 'A table with room for everyone',
        excerpt:
          'Our community kitchen serves 85,000 meals a year — but the number that matters is one: the person across the table.',
        body: doc(
          'Every weekday our community kitchen serves three hot meals, no questions asked. Last year that added up to 85,000 plates — but the volunteers will tell you the count was never the point.',
          'A warm meal is the easiest door to walk through when everything else has gotten hard. Over a tray of food, a guest mentions they’ve lost their ID, or haven’t seen a doctor in a year, or just got laid off — and that conversation is how someone finds their way to housing support or job coaching down the hall.',
          'We keep a few extra chairs at every table on purpose. There is always room for one more, and the welcome is the part we refuse to ration.'
        ),
        featuredImage: assetRef('story-kitchen-img'),
      },
    },
    {
      typeKey: 'blog_post',
      slug: 'james-goes-back-to-work',
      body: {
        title: 'James goes back to work',
        excerpt:
          'A layoff doesn’t have to become a freefall. With a mentor and a plan, James found his footing in eleven weeks.',
        body: doc(
          'James spent twenty years as a warehouse supervisor before an injury and a layoff arrived in the same month. By the time he reached our Pathways to Work program, he’d sent out ninety applications and heard back from none.',
          'His coach started smaller: a current résumé, a LinkedIn profile, two practice interviews a week, and an honest plan for the gap on his timeline. A volunteer mentor — a retired operations manager — met him for coffee every Friday just to keep his confidence from slipping.',
          'Eleven weeks later, James started a new role coordinating logistics for a regional distributor. “I didn’t need someone to feel sorry for me,” he said. “I needed someone to believe the next chapter was still mine to write.” Now he mentors in the same program that helped him.'
        ),
        featuredImage: assetRef('story-james-img'),
      },
    },
    {
      typeKey: 'page',
      slug: 'about',
      body: {
        title: 'About Open Harbor',
        excerpt: 'A community organization walking with neighbors through their hardest seasons.',
        body: doc(
          'Open Harbor began in 1998 as a single church basement serving soup on cold nights. Today we’re a registered 501(c)(3) nonprofit running housing support, a community kitchen, and job-readiness programs across the region — but the mission hasn’t changed: meet people in crisis with dignity, and walk with them all the way back to solid ground.',
          'We’re funded by individual donors, local partners, and grants, and we’re proud that 92 cents of every dollar goes directly to programs. Our staff is small and our volunteer corps is large, and we measure success one neighbor at a time.',
          'We believe that a safe place to land isn’t charity — it’s the floor everyone deserves to stand on.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'programs',
      body: {
        title: 'Our programs',
        excerpt: 'Three connected programs that meet people where they are.',
        body: doc(
          'Housing Support is our front line: emergency shelter for tonight, rapid rehousing and deposit assistance for next month, and the advocacy to keep a family in a home for good. No one should have to sleep in a car in this community.',
          'The Community Kitchen serves three hot, dignified meals a day with no questions asked, alongside a grocery pantry for households stretching a tight budget. It’s also the door through which many neighbors first find the rest of our help.',
          'Pathways to Work turns a hard season into a fresh start with job coaching, résumé and interview support, and one-on-one mentorship. We focus on steady, real employment — the kind that lasts.',
          'The programs are deliberately connected: a meal can lead to housing, housing can lead to a job, and a job can lead to a neighbor who comes back to volunteer. Want to refer someone, or get involved? Reach out anytime.'
        ),
      },
    },
    {
      typeKey: 'page',
      slug: 'contact',
      body: {
        title: 'Contact & get involved',
        excerpt: 'Volunteer, partner, refer a neighbor, or just say hello.',
        body: doc(
          'Open Harbor is at 200 Shoreline Avenue, and our doors are open Monday through Saturday. For program intake, volunteering, or partnership, call (555) 555-0190 or email hello@openharbor.example and a real person will get back to you within a business day.',
          'If you or someone you know needs help right now, please reach out — there’s no wrong way to ask, and no question is too small.',
          'Want to give? Every gift goes straight to work in the programs above, and monthly support is the steadiest help of all.'
        ),
      },
    },
  ],

  components: [],

  layout: { name: 'Harbor layout', tree: siteLayoutTree(), makeActive: true },

  pages: [
    { name: 'Home', kind: 'singleton', tree: homeTree(), seoTitle: 'Open Harbor — Community Nonprofit' },
    { name: 'Stories', kind: 'singleton', slug: 'stories', tree: storiesIndexTree() },
    {
      name: 'Story',
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
      subject: 'Welcome to Open Harbor',
      preheader: 'Thank you for standing with your neighbors.',
      tree: welcomeEmailTree(),
    },
    {
      name: 'Monthly impact',
      subject: 'Your impact this month',
      preheader: 'Neighbors housed, meals served, and a story of a life turned around.',
      tree: impactEmailTree(),
    },
  ],
};

/** The community-nonprofit blueprint, parsed + integrity-checked at module load
 *  so an invalid edit fails fast (and `defaults` are applied). */
export const nonprofitOrg: Blueprint = parseBlueprint(manifest);
