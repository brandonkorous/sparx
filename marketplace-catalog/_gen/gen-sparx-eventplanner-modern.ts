// sparx-eventplanner-modern — "Assembly Events", a modern corporate & social event studio.
//
// The confident, production-minded event company of the design research (the sharp
// creative-agency lane): a crisp near-white ground, a deep navy primary, a punchy coral
// accent, and a clean modern sans-serif type pairing. Deliberately the OPPOSITE of the
// luxury wedding-planner template (blush, serif, soft romance) — this sibling is bold,
// structured and results-driven: conferences, product launches, galas, brand activations
// and private parties. Same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-eventplanner-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-eventplanner-modern/**" \
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
  teamRow,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'eventplanner-modern-hero',
  approach: 'eventplanner-modern-approach',
  jordan: 'eventplanner-modern-jordan',
  sana: 'eventplanner-modern-sana',
  marcus: 'eventplanner-modern-marcus',
  work1: 'eventplanner-modern-work1',
  work2: 'eventplanner-modern-work2',
  work3: 'eventplanner-modern-work3',
} as const;

// EMPTY on purpose — the picsum `src()` fallback supplies deterministic placeholders keyed
// by unique `assembly-` seeds, so the bundle ships with real, swap-ready imagery and zero
// hard-coded photo URLs to go stale.
const PHOTO: Record<string, string> = {
  "assembly-hero": "https://images.unsplash.com/photo-1783979384797-7a5d2ad23fc8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29ycG9yYXRlJTIwZXZlbnQlMjBzdGFnZXxlbnwwfDB8fHwxNzg2MzkyNjY2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-approach": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXZlbnQlMjBwbGFubmluZyUyMG1lZXRpbmd8ZW58MHwwfHx8MTc4NjM5MjY3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-jordan": "https://images.unsplash.com/photo-1566753323558-f4e0952af115?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXZlbnQlMjBwcm9kdWNlciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTI2NzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-sana": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBldmVudCUyMHBsYW5uZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNjc3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-marcus": "https://images.unsplash.com/photo-1562788869-4ed32648eb72?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVzaW5lc3MlMjBtYW4lMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNjc5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-work1": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29uZmVyZW5jZSUyMGV2ZW50fGVufDB8MHx8fDE3ODYzOTI2ODJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-work2": "https://images.unsplash.com/photo-1653821355736-0c2598d0a63e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2FsYSUyMGV2ZW50JTIwbGlnaHRpbmd8ZW58MHwwfHx8MTc4NjM5MjY4NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "assembly-work3": "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZHVjdCUyMGxhdW5jaCUyMGV2ZW50fGVufDB8MHx8fDE3ODYzOTI2ODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('assembly-hero'), alt: 'A packed conference stage under bold event lighting' },
  { id: IMG.approach, url: src('assembly-approach'), alt: 'A production team reviewing a floor plan on set' },
  { id: IMG.jordan, url: src('assembly-jordan'), alt: 'Jordan Reyes, executive producer' },
  { id: IMG.sana, url: src('assembly-sana'), alt: 'Sana Okafor, experience producer' },
  { id: IMG.marcus, url: src('assembly-marcus'), alt: 'Marcus Vale, brand activation producer' },
  { id: IMG.work1, url: src('assembly-work1'), alt: 'A product launch reveal moment on a bright stage' },
  { id: IMG.work2, url: src('assembly-work2'), alt: 'A black-tie gala dinner in a grand ballroom' },
  { id: IMG.work3, url: src('assembly-work3'), alt: 'A branded pop-up activation buzzing with guests' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-eventplanner-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "assembly": crisp near-white ground, deep-navy primary, coral accent, modern sans ─
const assembly = defineTheme({
  name: 'assembly',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)', // crisp near-white
      'oklch(95% 0.006 250)', // pale mist
      'oklch(90% 0.01 250)', // hairline
      'oklch(22% 0.02 262)', // deep ink navy
    ],
    roles: {
      primary: 'oklch(45% 0.13 258)', // confident navy
      secondary: 'oklch(38% 0.02 262)', // dark charcoal — readable micro-labels
      accent: 'oklch(70% 0.17 32)', // punchy coral
      neutral: 'oklch(25% 0.015 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.02 262)',
      'oklch(16% 0.015 262)',
      'oklch(13% 0.012 262)',
      'oklch(96% 0.004 250)',
    ],
    roles: {
      primary: 'oklch(70% 0.13 258)',
      secondary: 'oklch(80% 0.02 262)',
      accent: 'oklch(76% 0.16 32)',
      neutral: 'oklch(86% 0.015 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, producers + hours, the consult menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'consult-standard',
      name: 'Standard consultation',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 120],
      policyText:
        'Please give us at least 48 hours’ notice to move or cancel a consultation. We send a reminder two days ahead and again two hours before.',
    },
    {
      handle: 'planning-deposit',
      name: 'Planning-session deposit',
      depositType: 'deposit',
      depositAmountCents: 10000,
      cancellationWindowHours: 72,
      reminderOffsetsMin: [4320, 2880, 120],
      policyText:
        'Deep-dive planning sessions hold a $100 deposit that comes straight off your production quote. Reschedule with 72 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'jordan',
      name: 'Jordan Reyes',
      kind: 'staff',
      skillTags: ['corporate', 'production', 'logistics'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
    {
      handle: 'sana',
      name: 'Sana Okafor',
      kind: 'staff',
      skillTags: ['social', 'design', 'production'],
      windows: hours([2, 3, 4, 5, 6], 600, 1140), // Tue–Sat 10–7
    },
    {
      handle: 'marcus',
      name: 'Marcus Vale',
      kind: 'staff',
      skillTags: ['brand', 'activation', 'production'],
      windows: hours([1, 3, 4, 5], 600, 1080), // Mon, Wed–Fri 10–6
    },
  ],
  services: [
    {
      handle: 'discovery-call',
      name: 'Discovery call',
      description: 'A free 30-minute call to talk through your event, your goals and your timeline — no obligation.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'corporate-event-consult',
      name: 'Corporate event consultation',
      description: 'A working session on your company event — offsites, summits, award nights and client experiences.',
      durationMinutes: 45,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'conference-production-consult',
      name: 'Conference production consultation',
      description: 'Scope the stage, run-of-show, AV and logistics for a multi-session conference or summit.',
      durationMinutes: 60,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'product-launch-consult',
      name: 'Product launch consultation',
      description: 'Plan the reveal — venue, staging, press moment and the guest journey that makes it land.',
      durationMinutes: 60,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'gala-consult',
      name: 'Gala & fundraiser consultation',
      description: 'Shape a black-tie gala or benefit — program, catering, entertainment and the room that wows.',
      durationMinutes: 60,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'planning-deposit',
    },
    {
      handle: 'brand-activation-consult',
      name: 'Brand activation consultation',
      description: 'Design an experiential pop-up, launch stunt or festival footprint that gets people talking.',
      durationMinutes: 45,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'consult-standard',
    },
    {
      handle: 'private-party-consult',
      name: 'Private party consultation',
      description: 'A milestone birthday, anniversary or celebration, produced end to end so you can be a guest.',
      durationMinutes: 45,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'producer', kind: 'staff', skillTags: ['production'], count: 1 }],
      policyHandle: 'consult-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A packed conference stage under bold event lighting',
    title: 'Events that mean business',
    sub: 'We plan and produce corporate and social events end to end — conferences, launches, galas and activations that hit every mark, on time and on budget.',
    primary: { label: 'Book a consultation', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Full production & logistics',
        body: 'Venue, staging, AV, catering, run-of-show and the hundred details in between — one team owning all of it, so nothing falls through the gaps.',
      },
      {
        title: 'On-brand experiences',
        body: 'Every touchpoint, from the invite to the after-film, designed to look and feel unmistakably like you — not a template with your logo dropped on top.',
      },
      {
        title: 'A trusted vendor network',
        body: 'Years of vetted partners — AV crews, caterers, entertainers, fabricators — booked at the right price and held to our standard, not just theirs.',
      },
      {
        title: 'On time, on budget',
        body: 'A clear plan, a live budget you can see, and a producer who sweats the timeline so the day runs to the minute and the numbers hold.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we work with you',
    intro: 'Every engagement starts with a consultation. Pick the one that fits, see live availability and book a time — the discovery call is free.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Discovery call', priceCents: 0, durationMin: 30, desc: 'A free intro call to talk through your event.' },
      { name: 'Corporate event consultation', priceCents: 7500, durationMin: 45, desc: 'Offsites, summits and client nights.' },
      { name: 'Conference production consultation', priceCents: 12500, durationMin: 60, desc: 'Stage, run-of-show, AV and logistics.' },
      { name: 'Product launch consultation', priceCents: 12500, durationMin: 60, desc: 'The reveal, the room and the press moment.' },
      { name: 'Gala & fundraiser consultation', priceCents: 12500, durationMin: 60, desc: 'Black-tie programs that raise the room.' },
      { name: 'Brand activation consultation', priceCents: 9500, durationMin: 45, desc: 'Pop-ups and experiential that get talked about.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Recent events',
    surface: 'base',
    columns: 3,
    images: [
      { src: url(IMG.work1), alt: 'A product launch reveal moment on a bright stage' },
      { src: url(IMG.work2), alt: 'A black-tie gala dinner in a grand ballroom' },
      { src: url(IMG.work3), alt: 'A branded pop-up activation buzzing with guests' },
    ],
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A production team reviewing a floor plan on set',
    heading: 'One team, from brief to load-out',
    body: [
      'Assembly Events runs on a single principle: the people who plan your event are the people who run it. No handoffs, no lost context, no “that’s not our department.”',
      'We build the concept, lock the budget, manage every vendor and stand at the back of the room on show day making the timeline happen. You get one producer, one plan, and one number to call.',
    ],
    cta: { label: 'Start with a consultation', href: '/book' },
  }),
  teamRow({
    heading: 'The producers you’ll work with',
    intro: 'Book by name — the producer you meet in the consultation is the one who runs your event.',
    surface: 'muted',
    members: [
      { name: 'Jordan Reyes', role: 'Executive producer', image: url(IMG.jordan), alt: 'Jordan Reyes, executive producer', bio: 'Fifteen years of conferences and corporate summits. Jordan owns the run-of-show and the budget.' },
      { name: 'Sana Okafor', role: 'Experience producer', image: url(IMG.sana), alt: 'Sana Okafor, experience producer', bio: 'Design-led social events and galas — the room, the flow and the moments people remember.' },
      { name: 'Marcus Vale', role: 'Brand activation producer', image: url(IMG.marcus), alt: 'Marcus Vale, brand activation producer', bio: 'Launches, pop-ups and experiential builds that turn a brand brief into a crowd.' },
    ],
  }),
  testimonial({
    quote: 'Our annual summit went from a logistical scramble to the smoothest event we’ve run. 600 attendees, three stages, zero surprises — and it came in under budget.',
    attribution: 'Dana Whitfield, VP Marketing, Northwind Software',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Let’s build your next event',
    sub: 'Book a free discovery call or a deeper planning session. Pick a producer, see live times, and we’ll take it from there.',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.approach),
    alt: 'A production team reviewing a floor plan on set',
    title: 'Book a consultation',
    sub: 'Choose a consultation to see what it covers and how long it runs, then pick your producer and a time that works.',
    primary: { label: 'See consultations below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A packed conference stage under bold event lighting',
    heading: 'About Assembly Events',
    body: [
      'We started Assembly Events because too many events are planned by one company and produced by another — and the seams always show. We do both, so they don’t.',
      'From a 20-person leadership offsite to a 2,000-guest product launch, we bring the same thing: a sharp creative concept, ruthless logistics, and a producer who treats your budget and your reputation like their own.',
    ],
    cta: { label: 'Book a consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we run an event',
    items: [
      { title: 'Discovery & concept', body: 'We start with your goals — not a package — then shape a concept, a budget and a timeline you can actually stand behind.' },
      { title: 'Production & vendors', body: 'We book and manage every partner, build the run-of-show, and keep a live budget so there are no surprises the week of.' },
      { title: 'Show day & wrap', body: 'A producer runs the room to the minute, handles the load-out, and delivers a wrap report — what worked, what it cost, what’s next.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Assembly Events', '410 Market Street', 'Studio 5 · Austin, TX 78701'],
    mapLocation: '410 Market Street, Austin, TX 78701',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve a consultation online — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Book a consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-eventplanner-modern',
  name: 'sparx — Event Planner (Modern)',
  summary:
    'A bold, modern site for corporate & social event planners — a crisp near-white palette, a confident navy primary and a punchy coral accent, with a clean modern sans. Installs online booking for consultations: a real consult menu (discovery call through gala and brand-activation), three producers you book by name with their own hours, and a planning-deposit policy. Ships as "Assembly Events", a full-service event production studio.',
  tagline: 'A bold, modern template for event planners — book consultations online from day one.',
  industry: 'Event planning',
  sortWeight: 39,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Assembly Events', tagline: 'Events that mean business.' },
  theme: assembly,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Assembly Events — corporate & social event production',
      description:
        'Assembly Events plans and produces conferences, product launches, galas and brand activations end to end. Book a consultation with a producer online.',
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
