// sparx-florist-boutique — "Wildstem Floral", an artful boutique WEDDING & EVENT florist.
//
// The romantic, editorial floral studio: a soft blush ground, a dusty-rose primary, a sage
// accent, an elegant serif display over a humanist sans, and gorgeous arrangement photography
// carrying the page. This is the wedding/event boutique sibling — bridal bouquets, ceremony &
// reception florals, full event design, seasonal & locally-grown — deliberately distinct from
// the neighborhood flower-shop template (a walk-in retail counter). Same booking spine, a
// different business: here the functional core is BOOKING A CONSULTATION, not a checkout.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-florist-boutique.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-florist-boutique/**" \
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
  hero: 'florist-boutique-hero',
  studio: 'florist-boutique-studio',
  rosa: 'florist-boutique-rosa',
  ines: 'florist-boutique-ines',
  thea: 'florist-boutique-thea',
  work1: 'florist-boutique-work1',
  work2: 'florist-boutique-work2',
  work3: 'florist-boutique-work3',
  work4: 'florist-boutique-work4',
} as const;

const PHOTO: Record<string, string> = {
  "wildstem-hero": "https://images.unsplash.com/photo-1531120364508-a6b656c3e78d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxvcmFsJTIwYXJyYW5nZW1lbnQlMjBib3VxdWV0fGVufDB8MHx8fDE3ODYzOTUwOTB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-studio": "https://images.unsplash.com/photo-1642751652611-bb9a7cad58a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxvcmlzdCUyMHdvcmtpbmclMjBmbG93ZXJzfGVufDB8MHx8fDE3ODYzOTUwOTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-rosa": "https://images.unsplash.com/photo-1747835334237-4ab81c9c921a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBmbG9yaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NTA5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-ines": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxvcmlzdCUyMHBvcnRyYWl0JTIwd29tYW58ZW58MHwwfHx8MTc4NjM5NTEwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-thea": "https://images.unsplash.com/photo-1566250315419-8f8fb0dc2567?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3aXRoJTIwZmxvd2VycyUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTUxMDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-work1": "https://images.unsplash.com/photo-1595467959554-9ffcbf37f10f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGJvdXF1ZXQlMjBmbG93ZXJzfGVufDB8MHx8fDE3ODYzOTUxMDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-work2": "https://images.unsplash.com/photo-1569387006778-d468606c407b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxvcmFsJTIwY2VudGVycGllY2V8ZW58MHwwfHx8MTc4NjM5NTEwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-work3": "https://images.unsplash.com/photo-1610841803453-1b30e19d2354?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmxvd2VyJTIwYXJyYW5nZW1lbnQlMjBlbGVnYW50fGVufDB8MHx8fDE3ODYzOTUxMTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "wildstem-work4": "https://images.unsplash.com/photo-1529636798458-92182e662485?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMGZsb3dlcnMlMjBjZXJlbW9ueXxlbnwwfDB8fHwxNzg2Mzk1MTE2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  {
    id: IMG.hero,
    url: src('wildstem-hero'),
    alt: 'A lush, romantic bridal bouquet of garden roses and trailing greenery',
  },
  {
    id: IMG.studio,
    url: src('wildstem-studio'),
    alt: 'A sunlit floral studio workbench scattered with stems and ribbon',
  },
  { id: IMG.rosa, url: src('wildstem-rosa'), alt: 'Rosa Vale, lead floral designer' },
  { id: IMG.ines, url: src('wildstem-ines'), alt: 'Inés Marlow, event floral designer' },
  { id: IMG.thea, url: src('wildstem-thea'), alt: 'Thea Quinn, floral designer' },
  {
    id: IMG.work1,
    url: src('wildstem-work1'),
    alt: 'A ceremony arch draped in seasonal blooms and eucalyptus',
  },
  {
    id: IMG.work2,
    url: src('wildstem-work2'),
    alt: 'A long reception table lined with low, candlelit centerpieces',
  },
  {
    id: IMG.work3,
    url: src('wildstem-work3'),
    alt: 'A hand-tied bridesmaid posy in dusty rose and blush',
  },
  {
    id: IMG.work4,
    url: src('wildstem-work4'),
    alt: 'An airy installation of hanging florals above a celebration',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-florist-boutique: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "wildstem": blush-ivory ground, dusty-rose primary, sage accent, serif display ─
const wildstem = defineTheme({
  name: 'wildstem',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.012 20)', // blush ivory
      'oklch(94% 0.016 18)', // rose oat
      'oklch(89% 0.02 16)', // petal hairline
      'oklch(28% 0.03 350)', // deep mauve ink
    ],
    roles: {
      primary: 'oklch(66% 0.07 12)', // dusty rose
      secondary: 'oklch(34% 0.03 350)', // deep mauve (dark on the light ground)
      accent: 'oklch(70% 0.045 145)', // soft sage
      neutral: 'oklch(30% 0.02 350)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 350)',
      'oklch(20% 0.018 350)',
      'oklch(16% 0.014 350)',
      'oklch(95% 0.01 20)',
    ],
    roles: {
      primary: 'oklch(76% 0.07 14)',
      secondary: 'oklch(80% 0.02 350)',
      accent: 'oklch(76% 0.05 145)',
      neutral: 'oklch(84% 0.015 350)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, floral designers + hours, the consult menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel a consultation. We’ll send a reminder the day before and again two hours ahead.',
    },
    {
      handle: 'event-deposit',
      name: 'Event booking deposit',
      depositType: 'deposit',
      depositAmountCents: 10000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Wedding and event consultations hold a $100 deposit that comes off your final floral proposal. Reschedule with 48 hours’ notice and it carries over to your new date.',
    },
  ],
  resources: [
    {
      handle: 'rosa',
      name: 'Rosa Vale',
      kind: 'staff',
      skillTags: ['wedding', 'design', 'events'],
      windows: hours([2, 3, 4, 5, 6], 540, 1020), // Tue–Sat 9–5
    },
    {
      handle: 'ines',
      name: 'Inés Marlow',
      kind: 'staff',
      skillTags: ['events', 'design', 'arrangements'],
      windows: hours([3, 4, 5, 6, 0], 600, 1080), // Wed–Sun 10–6
    },
    {
      handle: 'thea',
      name: 'Thea Quinn',
      kind: 'staff',
      skillTags: ['wedding', 'arrangements', 'design'],
      windows: hours([2, 4, 5, 6], 600, 1020), // Tue, Thu–Sat 10–5
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description:
        'A relaxed 30-minute call to talk through your date, your vision and your budget — no cost, no pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'wedding-floral-consult',
      name: 'Wedding floral consultation',
      description:
        'A full sit-down for your wedding — ceremony and reception, colour story, flowers by season, and a proposal to follow.',
      durationMinutes: 60,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'event-deposit',
    },
    {
      handle: 'event-design-consult',
      name: 'Event design consultation',
      description:
        'Full floral design for showers, galas, launches and dinners — installations, tablescapes, and setup planned end to end.',
      durationMinutes: 60,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'event-deposit',
    },
    {
      handle: 'bridal-bouquet-consult',
      name: 'Bridal bouquet consultation',
      description:
        'A focused session for the bouquets — yours and the party’s — with stems, shape and ribbon chosen to suit the day.',
      durationMinutes: 45,
      priceCents: 3500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'celebration-florals-consult',
      name: 'Celebration florals consultation',
      description:
        'Flowers for the milestones — birthdays, anniversaries, welcome-homes — planned to match the moment and the room.',
      durationMinutes: 45,
      priceCents: 3500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'seasonal-subscription-consult',
      name: 'Seasonal subscription consultation',
      description:
        'Set up a recurring arrangement for your home or studio — locally grown, always in season, delivered on a rhythm that suits you.',
      durationMinutes: 30,
      priceCents: 2500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'custom-arrangement-consult',
      name: 'Custom arrangement consultation',
      description:
        'A one-off, made-to-order arrangement — a gift, a gesture, a centrepiece — designed around what you have in mind.',
      durationMinutes: 45,
      priceCents: 3500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'designer', kind: 'staff', skillTags: ['design'], count: 1 }],
      policyHandle: 'consult-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A lush, romantic bridal bouquet of garden roses and trailing greenery',
    title: 'Flowers for the days you’ll never forget',
    sub: 'An artful boutique studio for weddings and events — seasonal, locally grown, and designed around your story from the very first bloom.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See our work', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Seasonal & locally grown',
        body: 'We design with what’s at its best right now, sourced from growers we know — so your flowers are fresher, richer, and truly of the season.',
      },
      {
        title: 'Full event design',
        body: 'Beyond the bouquet: arches, installations, tablescapes and every last detail, imagined as one considered whole and installed on the day.',
      },
      {
        title: 'Weddings & celebrations',
        body: 'From an intimate elopement to a two-hundred-seat reception, we design at any scale with the same care for the moment it marks.',
      },
      {
        title: 'Delivery & setup',
        body: 'We deliver, place and style everything ourselves, then quietly return to strike it down — so your day stays entirely yours.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to begin',
    intro: 'Every project starts with a conversation. Choose the consultation that fits — full details and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Discovery call',
        priceCents: 0,
        durationMin: 30,
        desc: 'A free first chat about your date, vision and budget.',
      },
      {
        name: 'Wedding floral consultation',
        priceCents: 5000,
        durationMin: 60,
        desc: 'Ceremony and reception, planned end to end.',
      },
      {
        name: 'Event design consultation',
        priceCents: 5000,
        durationMin: 60,
        desc: 'Installations and tablescapes for any celebration.',
      },
      {
        name: 'Bridal bouquet consultation',
        priceCents: 3500,
        durationMin: 45,
        desc: 'The bouquets, chosen stem by stem.',
      },
    ],
    cta: { label: 'See all consultations & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'A few of our favourites',
    surface: 'base',
    columns: 4,
    images: [
      { src: url(IMG.work1), alt: 'A ceremony arch draped in seasonal blooms and eucalyptus' },
      { src: url(IMG.work2), alt: 'A long reception table lined with low, candlelit centerpieces' },
      { src: url(IMG.work3), alt: 'A hand-tied bridesmaid posy in dusty rose and blush' },
      { src: url(IMG.work4), alt: 'An airy installation of hanging florals above a celebration' },
    ],
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A sunlit floral studio workbench scattered with stems and ribbon',
    heading: 'Wild, not fussy',
    body: [
      'We design the way flowers grow — loose, textured, a little untamed — never stiff or symmetrical for its own sake. The result feels gathered that morning, because much of it was.',
      'Working in season keeps every arrangement honest: garden roses in June, dahlias in September, ranunculus in spring. It’s the reason our work always looks like the moment it’s made for.',
    ],
    cta: { label: 'Start with a consultation', href: '/book' },
  }),
  testimonial({
    quote: 'We handed Wildstem a Pinterest board and a wedding date and got back something better than we could have described. Walking into that reception — the arch, the tables, the light through it all — we both just stopped. It was us, in flowers.',
    attribution: 'Elena & Marcus, married September 2025',
  }),
  bookingCta({
    title: 'Let’s talk flowers',
    sub: 'Tell us about your day and we’ll take it from there. Start with a free discovery call — it only takes a minute to book.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.studio),
    alt: 'A sunlit floral studio workbench scattered with stems and ribbon',
    title: 'Book a consultation',
    sub: 'Choose the conversation that fits your day, pick your designer and see live availability. First time? Start with a free discovery call.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A lush, romantic bridal bouquet of garden roses and trailing greenery',
    heading: 'About Wildstem Floral',
    body: [
      'Wildstem began at a single farm stand — a bucket of just-cut stems, sold to neighbours on a Saturday. What grew from it is a small studio devoted to the flowers that mark the biggest days of your life.',
      'We stayed deliberately boutique so every couple and host works directly with the designer making their flowers. Fewer weddings a season, more attention on each — and arrangements that could only have been made for you.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'We listen first',
        body: 'Every project opens with a real conversation — your date, your palette, the feeling you’re after — before a single stem is chosen.',
      },
      {
        title: 'We design in season',
        body: 'We build around what’s at its peak and grown nearby, so your flowers are their most beautiful and their most yours.',
      },
      {
        title: 'We handle the day',
        body: 'Delivery, placement, styling and strike-down are ours to manage — you simply arrive to a room already in bloom.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Wildstem Floral', '14 Warren Street', 'Studio B · Hudson, NY 12534'],
    mapLocation: '14 Warren Street, Hudson, NY 12534',
    hours: [
      { day: 'Tuesday – Friday', time: '9:00 – 5:00' },
      { day: 'Saturday', time: '10:00 – 5:00' },
      { day: 'Sunday', time: 'By appointment' },
      { day: 'Monday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather begin online?',
    sub: 'Book a free discovery call and we’ll find the right time to talk through your day — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-florist-boutique',
  name: 'Florist (Boutique)',
  summary:
    'A romantic, editorial site for a wedding & event florist — a soft blush palette over ivory with a sage accent and an elegant serif display, with arrangement photography carrying the page. Installs a working booking flow: consultation types from a free discovery call to full event design, floral designers you book by name with their own hours, and an event booking-deposit policy. Ships as "Wildstem Floral", an artful boutique studio for weddings and celebrations.',
  tagline: 'An artful, editorial template for wedding & event florists — book consultations online from day one.',
  industry: 'Florist',
  sortWeight: 18,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Wildstem Floral', tagline: 'Artful flowers for weddings & events.' },
  theme: wildstem,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Wildstem Floral — wedding & event florist',
      description:
        'Wildstem Floral is an artful boutique studio for wedding and event flowers — seasonal, locally grown, designed around your day. Book a consultation online.',
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
