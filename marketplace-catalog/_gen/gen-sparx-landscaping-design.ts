// sparx-landscaping-design — "Verdant Grounds", a premium landscape DESIGN & BUILD firm.
//
// The lush, refined, portfolio-led design/build studio (custom design, hardscapes, planting,
// irrigation, outdoor living): a soft cream/greige ground, a deep-emerald primary, a warm
// terracotta/stone accent, a refined serif display over a humanist sans, and finished-project
// photography carrying the page. Deliberately the PREMIUM sibling of the lawn-care maintenance
// template (bright, friendly) — same booking spine, a different business: this one leads with
// imagery and books a DESIGN CONSULTATION / FREE ESTIMATE rather than a recurring mow.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-landscaping-design.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-landscaping-design/**" \
//     "marketplace-catalog/_gen/**/*.ts"

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import {
  bookingCta,
  defineTheme,
  emitServiceBundle,
  face,
  featureRow,
  findUs,
  galleryStrip,
  photoHero,
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'landscaping-design-hero',
  process: 'landscaping-design-process',
  about: 'landscaping-design-about',
  patio: 'landscaping-design-patio',
  planting: 'landscaping-design-planting',
  poolside: 'landscaping-design-poolside',
  path: 'landscaping-design-path',
  pergola: 'landscaping-design-pergola',
  water: 'landscaping-design-water',
} as const;

const PHOTO: Record<string, string> = {
  "verdant-hero": "https://images.unsplash.com/photo-1778683326192-898fc982e6a6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGFuZHNjYXBlZCUyMGdhcmRlbiUyMGJhY2t5YXJkfGVufDB8MHx8fDE3ODYzOTE0NDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-process": "https://images.unsplash.com/photo-1597201278257-3687be27d954?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGFuZHNjYXBlJTIwZGVzaWduJTIwcGxhbnxlbnwwfDB8fHwxNzg2MzkxNDQ1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-about": "https://images.unsplash.com/photo-1597201278257-3687be27d954?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2FyZGVuJTIwbGFuZHNjYXBpbmclMjB3b3JrfGVufDB8MHx8fDE3ODYzOTE0NDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-patio": "https://images.unsplash.com/photo-1780838446281-9394772d07a8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGF0aW8lMjBzdG9uZSUyMGhhcmRzY2FwZXxlbnwwfDB8fHwxNzg2MzkxNDUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-planting": "https://images.unsplash.com/photo-1438109382753-8368e7e1e7cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2FyZGVuJTIwZmxvd2VyJTIwcGxhbnRpbmd8ZW58MHwwfHx8MTc4NjM5MTQ1NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-poolside": "https://images.unsplash.com/photo-1657383543368-7d929944be6a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFja3lhcmQlMjBwb29sJTIwbGFuZHNjYXBpbmd8ZW58MHwwfHx8MTc4NjM5MTQ1OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-path": "https://images.unsplash.com/photo-1663185776834-0c86f6ced17b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2FyZGVuJTIwc3RvbmUlMjBwYXRofGVufDB8MHx8fDE3ODYzOTE0NjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-pergola": "https://images.unsplash.com/photo-1527359443443-84a48aec73d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyZ29sYSUyMG91dGRvb3IlMjBsaXZpbmd8ZW58MHwwfHx8MTc4NjM5MTQ2NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "verdant-water": "https://images.unsplash.com/photo-1624396593447-ae75dcd225a5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2FyZGVuJTIwd2F0ZXIlMjBmZWF0dXJlfGVufDB8MHx8fDE3ODYzOTE0Njd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('verdant-hero'), alt: 'A lush, layered garden with a stone terrace at golden hour' },
  { id: IMG.process, url: src('verdant-process'), alt: 'A landscape designer marking up a planting plan on site' },
  { id: IMG.about, url: src('verdant-about'), alt: 'A finished backyard with mature plantings and a seating area' },
  { id: IMG.patio, url: src('verdant-patio'), alt: 'A natural-stone patio with built-in seating and soft lighting' },
  { id: IMG.planting, url: src('verdant-planting'), alt: 'A layered perennial border in full bloom' },
  { id: IMG.poolside, url: src('verdant-poolside'), alt: 'A poolside garden framed by ornamental grasses' },
  { id: IMG.path, url: src('verdant-path'), alt: 'A flagstone path winding through a shade garden' },
  { id: IMG.pergola, url: src('verdant-pergola'), alt: 'A cedar pergola over an outdoor dining area' },
  { id: IMG.water, url: src('verdant-water'), alt: 'A quiet water feature set among boulders and ferns' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-landscaping-design: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "verdant": cream/greige ground, deep-emerald primary, terracotta accent, serif ─
const verdant = defineTheme({
  name: 'verdant',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 95)', // soft cream
      'oklch(93% 0.014 92)', // warm greige
      'oklch(88% 0.016 90)', // hairline
      'oklch(24% 0.02 150)', // deep forest ink
    ],
    roles: {
      primary: 'oklch(45% 0.09 155)', // deep emerald
      secondary: 'oklch(38% 0.02 150)', // dark forest (readable micro-labels)
      accent: 'oklch(64% 0.1 48)', // warm terracotta / stone
      neutral: 'oklch(28% 0.015 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 150)',
      'oklch(18% 0.015 150)',
      'oklch(14% 0.012 150)',
      'oklch(95% 0.012 95)',
    ],
    roles: {
      primary: 'oklch(70% 0.1 158)',
      secondary: 'oklch(78% 0.02 150)',
      accent: 'oklch(72% 0.09 50)',
      neutral: 'oklch(82% 0.015 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, designers + hours, the consult menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'landscaping-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel your consultation. We send a reminder two days before and again two hours ahead.',
    },
    {
      handle: 'design-deposit',
      name: 'Design deposit',
      depositType: 'deposit',
      depositAmountCents: 15000,
      cancellationWindowHours: 72,
      reminderOffsetsMin: [4320, 2880, 120],
      policyText:
        'Full design engagements hold a $150 design deposit that is credited in full toward your finished plan. Reschedule with 72 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Marsh',
      kind: 'staff',
      skillTags: ['design', 'planting', 'estimate'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'theo',
      name: 'Theo Brandt',
      kind: 'staff',
      skillTags: ['hardscape', 'irrigation', 'estimate'],
      windows: hours([1, 2, 3, 4, 6], 480, 1020), // Mon–Thu, Sat 8–5
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['design', 'outdoor-living', 'estimate'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
  ],
  services: [
    {
      handle: 'design-consultation',
      name: 'Design consultation',
      description:
        'A relaxed on-site walk-through of your property — your goals, your budget, and what’s possible. No charge, no pressure.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'landscaping-standard',
    },
    {
      handle: 'full-property-estimate',
      name: 'Full-property free estimate',
      description:
        'A complete measure-up and written estimate for a whole-yard transformation, covering design, build and planting.',
      durationMinutes: 90,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'landscaping-standard',
    },
    {
      handle: 'landscape-design-consult',
      name: 'Landscape design engagement',
      description:
        'The start of a custom design: a detailed site survey and design brief that leads to scaled 2D and 3D plans for your build.',
      durationMinutes: 90,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'design-deposit',
    },
    {
      handle: 'hardscape-patio-consult',
      name: 'Hardscape & patio consultation',
      description:
        'Patios, walls, walkways and fire features — we walk the space, talk materials and lay out a plan and estimate.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'landscaping-standard',
    },
    {
      handle: 'planting-plan-consult',
      name: 'Planting plan consultation',
      description:
        'A garden built for your light, soil and climate — four-season interest, sensible upkeep, and plants that thrive.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'landscaping-standard',
    },
    {
      handle: 'irrigation-consult',
      name: 'Irrigation & drainage consultation',
      description:
        'Smart, water-wise irrigation and drainage that keeps plantings healthy and the yard dry where it should be.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'landscaping-standard',
    },
    {
      handle: 'outdoor-living-consult',
      name: 'Outdoor living design engagement',
      description:
        'Kitchens, pergolas, lighting and living spaces — a design engagement for the yard you actually want to spend evenings in.',
      durationMinutes: 75,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['estimate'], count: 1 }],
      policyHandle: 'design-deposit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A lush, layered garden with a stone terrace at golden hour',
    title: 'The yard you keep meaning to build',
    sub: 'Verdant Grounds designs and builds landscapes worth coming home to — considered design, real craftsmanship, and plantings that only get better with time.',
    primary: { label: 'Book a design consultation', href: '/book' },
    secondary: { label: 'See our work', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Design that fits your yard',
        body: 'Every project starts with a custom design drawn for your space, your light and how you actually want to live outside — never a copy-paste plan.',
      },
      {
        title: 'Licensed, insured crews',
        body: 'Our own in-house teams build what we draw. Fully licensed and insured, so the patio, the planting and the irrigation are all on one accountable crew.',
      },
      {
        title: 'See it before we build it',
        body: 'Scaled 2D plans and 3D renderings let you walk the finished yard on screen and change your mind on paper, where it’s free.',
      },
      {
        title: 'A warranty on what grows',
        body: 'We stand behind our plantings and our build. If something doesn’t take in its first season, we make it right.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Where a project begins',
    intro: 'Every engagement opens with a conversation on your property. Consultations and estimates are free — full design engagements hold a deposit that’s credited toward your plan.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Design consultation', priceCents: 0, durationMin: 60, desc: 'An on-site walk-through of your goals and what’s possible.' },
      { name: 'Full-property free estimate', priceCents: 0, durationMin: 90, desc: 'A complete measure-up and written estimate for a whole-yard transformation.' },
      { name: 'Landscape design engagement', priceCents: 0, durationMin: 90, desc: 'A site survey and brief that leads to scaled 2D & 3D plans.' },
      { name: 'Hardscape & patio consultation', priceCents: 0, durationMin: 60, desc: 'Patios, walls, walkways and fire features, planned on site.' },
      { name: 'Planting plan consultation', priceCents: 0, durationMin: 45, desc: 'A four-season garden built for your light and soil.' },
      { name: 'Outdoor living design engagement', priceCents: 0, durationMin: 75, desc: 'Kitchens, pergolas and lighting for evenings outside.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Recent projects',
    columns: 3,
    images: [
      { src: url(IMG.patio), alt: 'A natural-stone patio with built-in seating and soft lighting' },
      { src: url(IMG.planting), alt: 'A layered perennial border in full bloom' },
      { src: url(IMG.poolside), alt: 'A poolside garden framed by ornamental grasses' },
      { src: url(IMG.path), alt: 'A flagstone path winding through a shade garden' },
      { src: url(IMG.pergola), alt: 'A cedar pergola over an outdoor dining area' },
      { src: url(IMG.water), alt: 'A quiet water feature set among boulders and ferns' },
    ],
  }),
  splitFeature({
    image: url(IMG.process),
    alt: 'A landscape designer marking up a planting plan on site',
    heading: 'From first walk-through to finished yard',
    body: [
      'We start on your property, not in a showroom — walking the space, learning how you live outside, and understanding the light, grade and soil we’re working with.',
      'From there we draw a scaled design and 3D renderings so you can see the whole yard before a single stone is set. Once it’s right, our own licensed crews build it — hardscape, planting and irrigation, start to finish.',
    ],
    cta: { label: 'Start your design', href: '/book' },
  }),
  testimonial({
    quote: 'They handed us a 3D plan of our own backyard before they touched a shovel. What they built looks exactly like the rendering — only better in person.',
    attribution: 'The Okafor family, clients since 2024',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Let’s design your yard',
    sub: 'Book a free consultation and we’ll walk your property, talk through what’s possible, and show you where to begin. It takes about a minute.',
    cta: { label: 'Book a design consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.process),
    alt: 'A landscape designer marking up a planting plan on site',
    title: 'Book your design consultation',
    sub: 'Choose the kind of project you have in mind to see what’s involved and how long each visit takes, then pick your designer and time.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A finished backyard with mature plantings and a seating area',
    heading: 'About Verdant Grounds',
    body: [
      'Verdant Grounds is a design-and-build landscape studio. We’re the rare firm that draws the plan and builds it too — so the vision on paper is the yard you actually get, with no handoffs and no finger-pointing.',
      'We founded the studio on a simple idea: a landscape should be designed for the people who live with it, built to last, and beautiful in every season — not just the week it’s planted.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Design first, always', body: 'Nothing gets built until there’s a plan you love. We design for your light, grade and how you want to use the space.' },
      { title: 'One accountable crew', body: 'Our own licensed, insured teams handle hardscape, planting and irrigation — one point of responsibility from first cut to final walk-through.' },
      { title: 'Built to endure', body: 'Proper base prep, healthy plant stock and a warranty behind it. We build the yard to still look right in ten years, not ten weeks.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Verdant Grounds', '640 Cedar Mill Road', 'Studio B · Asheville, NC 28801'],
    mapLocation: '640 Cedar Mill Road, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 5:00' },
      { day: 'Saturday', time: '9:00 – 2:00 (by appointment)' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a consultation online — no phone tag, and you’ll pick the designer who fits your project.',
    surface: 'muted',
    cta: { label: 'Book a design consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-landscaping-design',
  name: 'Landscaping (Design & Build)',
  summary:
    'A premium landscape design-and-build site — a lush cream-and-emerald palette with a warm terracotta accent and a refined serif display, led by finished-project photography. Installs a working booking flow for free consultations and estimates: a real consult menu (design, hardscape, planting, irrigation, outdoor living), three designers you book by name with their own hours, and a design-deposit policy for full engagements. Ships as "Verdant Grounds".',
  tagline: 'A lush, portfolio-led template for landscape design & build firms — book consultations online from day one.',
  industry: 'Landscaping',
  sortWeight: 54,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Verdant Grounds', tagline: 'Designed, built, and planted to last.' },
  theme: verdant,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Verdant Grounds — landscape design & build',
      description:
        'Verdant Grounds designs and builds custom landscapes — patios, planting, irrigation and outdoor living. Book a free design consultation online.',
    },
  },
  home: HOME,
  bookIntro: BOOK_INTRO,
  about: ABOUT,
  contact: CONTACT,
  scheduling: SCHEDULING,
  assets: ASSETS,
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const { dir } = await emitServiceBundle(SPEC);
  console.log(`· wrote bundle → ${dir}`);

  const mod = (await import(pathToFileURL(join(dir, 'blueprint.ts')).href)) as { default: unknown };
  const result = safeParseBlueprint(mod.default);
  if (result.success) {
    console.log('· safeParseBlueprint → VALID');
  } else {
    console.error('· safeParseBlueprint → INVALID');
    for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
