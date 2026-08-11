// sparx-roofing-storm — "Ironclad Roofing & Exteriors", a bold STORM-DAMAGE specialist.
//
// The confident, fast-response storm-and-insurance roofer: hail, wind and storm damage,
// insurance-claim assistance, full-roof replacement, siding and windows. "We handle the
// claim, you get a new roof." Type-led and deliberately LOUD — a deep-graphite primary on a
// crisp near-white ground, a sharp signal-red accent, and a bold condensed display face.
// The functional core is BOOKING AN INSPECTION: a live `scheduling.services` menu makes
// /book FUNCTION on day one.
//
// This is the storm/insurance/bold sibling of the roofing family. The OTHER roofing template
// is the trusted, everyday, photo-led residential shop (slate, warm, imagery-carried); this
// one must read visibly different — a bold dark-graphite palette, a sharp red accent,
// condensed type, a bold `typeHero` instead of a photo hero, and an insurance-claim structure
// ("we handle the claim") rather than a portfolio. Same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-roofing-storm.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-roofing-storm/**" \
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
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  claim: 'roofing-storm-claim',
  crew: 'roofing-storm-crew',
  cole: 'roofing-storm-cole',
  marisol: 'roofing-storm-marisol',
  deshawn: 'roofing-storm-deshawn',
} as const;

const PHOTO: Record<string, string> = {
  "ironclad-claim": "https://images.unsplash.com/photo-1633759593085-1eaeb724fc88?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9vZiUyMHN0b3JtJTIwZGFtYWdlfGVufDB8MHx8fDE3ODYzOTM3Mzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ironclad-crew": "https://images.unsplash.com/photo-1635424824849-1b09bdcc55b1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9vZmluZyUyMGNyZXclMjB3b3JraW5nfGVufDB8MHx8fDE3ODYzOTM3NDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ironclad-cole": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29uc3RydWN0aW9uJTIwd29ya2VyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5Mzc0M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ironclad-marisol": "https://images.unsplash.com/photo-1581092570490-cc40829efaae?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBjb250cmFjdG9yJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5Mzc0Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ironclad-deshawn": "https://images.unsplash.com/photo-1507126117511-e87526de90e2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9vZmVyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5Mzc0OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.claim,
    url: src('ironclad-claim'),
    alt: 'A roofer on a ladder photographing hail damage on a shingle roof for an insurance claim',
  },
  {
    id: IMG.crew,
    url: src('ironclad-crew'),
    alt: 'An Ironclad crew and branded truck at a storm-damaged house, ready to tarp and inspect',
  },
  {
    id: IMG.cole,
    url: src('ironclad-cole'),
    alt: 'Cole Brennan, storm and roofing lead',
  },
  {
    id: IMG.marisol,
    url: src('ironclad-marisol'),
    alt: 'Marisol Vega, siding and windows specialist',
  },
  {
    id: IMG.deshawn,
    url: src('ironclad-deshawn'),
    alt: 'Deshawn Pierce, insurance and claims lead',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-roofing-storm: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "ironclad": crisp near-white ground, deep-graphite primary, signal-red accent ─
const ironclad = defineTheme({
  name: 'ironclad',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.003 255)', // crisp cool near-white
      'oklch(95% 0.005 258)', // steel paper
      'oklch(89% 0.008 258)', // hairline
      'oklch(20% 0.02 262)', // near-black graphite ink
    ],
    roles: {
      primary: 'oklch(28% 0.028 262)', // deep graphite — bold near-black bands + buttons
      secondary: 'oklch(38% 0.022 260)', // dark steel — micro-labels stay legible on light
      accent: 'oklch(58% 0.205 27)', // sharp signal red
      neutral: 'oklch(25% 0.02 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.018 262)', // graphite ground
      'oklch(17% 0.016 262)',
      'oklch(13% 0.014 262)',
      'oklch(97% 0.004 255)', // near-white ink
    ],
    roles: {
      primary: 'oklch(80% 0.02 258)', // bright steel — reads on the graphite ground
      secondary: 'oklch(82% 0.02 258)', // readable light steel ink
      accent: 'oklch(66% 0.2 27)', // signal red, lifted for dark
      neutral: 'oklch(84% 0.018 258)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, estimators + hours, the inspection menu) ─────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'standard-visit',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Booked an inspection or estimate? We’ll confirm a two-hour arrival window and text you the morning of, then a heads-up when your estimator is on the way. Reschedule free with 24 hours’ notice.',
    },
    {
      handle: 'emergency-priority',
      name: 'Emergency priority',
      depositType: 'none',
      cancellationWindowHours: 4,
      reminderOffsetsMin: [240, 60],
      policyText:
        'Active leak or storm damage? Emergency visits go to the next available crew — we text a tight window and call before we roll to tarp and protect. Please give us 4 hours’ notice to release the slot.',
    },
  ],
  resources: [
    {
      handle: 'cole',
      name: 'Cole Brennan',
      kind: 'staff',
      skillTags: ['storm', 'roofing', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1140), // Mon–Sat 7–7
    },
    {
      handle: 'marisol',
      name: 'Marisol Vega',
      kind: 'staff',
      skillTags: ['siding', 'windows', 'general'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
    {
      handle: 'deshawn',
      name: 'Deshawn Pierce',
      kind: 'staff',
      skillTags: ['insurance', 'roofing', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1200), // Mon–Sat 8–8
    },
  ],
  services: [
    {
      handle: 'free-storm-inspection',
      name: 'Free storm inspection',
      description:
        'We climb up, document every hit — hail, wind, lifted shingles — and tell you straight whether you have a claim. No charge, no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'emergency-priority',
    },
    {
      handle: 'insurance-claim-consult',
      name: 'Insurance claim consult',
      description:
        'Sit down with us to open or make sense of your claim. We explain your coverage, your deductible, and exactly what we handle for you from here.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'roof-replacement-estimate',
      name: 'Roof replacement estimate',
      description:
        'A full measure-up and a written scope for a new roof — materials, timeline and the number your insurer sees, all in one visit.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'emergency-tarp-visit',
      name: 'Emergency tarp visit',
      description:
        'Water coming in right now? We roll fast, tarp the roof and stop the damage from spreading while your claim gets moving.',
      durationMinutes: 60,
      priceCents: 19900,
      requiresApproval: true,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'emergency-priority',
    },
    {
      handle: 'siding-estimate',
      name: 'Siding estimate',
      description:
        'Storm-dented, cracked or faded siding, measured and priced — matched to your home and your claim if there is one.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'window-estimate',
      name: 'Window estimate',
      description:
        'Broken seals, cracked panes or wind-damaged frames — we assess and quote replacement windows that hold up next time.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'standard-visit',
    },
    {
      handle: 'full-exterior-consult',
      name: 'Full exterior consult',
      description:
        'Roof, siding, gutters and windows walked as one — a single plan when the whole exterior took a beating and you want it handled together.',
      durationMinutes: 90,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'roofer', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'standard-visit',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Storm hit your roof? We handle the damage — and the claim.',
    sub: 'Ironclad is the storm-damage specialist that documents the hit, works directly with your insurance, and gets you a new roof — while you get on with your life. Start with a free inspection.',
    primary: { label: 'Book a free storm inspection', href: '/book' },
    secondary: { label: 'See what we cover', href: '/book' },
    surface: 'primary',
  }),
  featureRow({
    heading: 'Why homeowners call Ironclad',
    items: [
      {
        title: 'Free storm inspections',
        body: 'We climb up, document every hit, and tell you straight whether you have a claim — no charge and no pressure to sign anything.',
      },
      {
        title: 'We work with your insurance',
        body: 'From the first photo to the final invoice, we speak the adjuster’s language and handle the paperwork so you don’t have to fight it alone.',
      },
      {
        title: 'Fast emergency response',
        body: 'Water coming in? We roll the same day to tarp and protect, stopping the damage from spreading before the claim is even settled.',
      },
      {
        title: 'Siding & windows too',
        body: 'A storm rarely hits just the roof. We handle siding, windows and the whole exterior, so it’s one crew and one plan, not three.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Inspections, estimates & visits',
    intro: 'Inspections and estimates are always free. Book any of these online and see live availability — emergencies go to the next available crew.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free storm inspection',
        priceCents: 0,
        durationMin: 45,
        desc: 'Every hit documented, and a straight answer on whether you have a claim.',
      },
      {
        name: 'Insurance claim consult',
        priceCents: 0,
        durationMin: 60,
        desc: 'Your coverage, your deductible, and exactly what we handle for you.',
      },
      {
        name: 'Roof replacement estimate',
        priceCents: 0,
        durationMin: 60,
        desc: 'A full measure-up and a written scope for a new roof.',
      },
      {
        name: 'Emergency tarp visit',
        priceCents: 19900,
        durationMin: 60,
        desc: 'Same-day tarp to stop water and protect the house.',
      },
      {
        name: 'Siding estimate',
        priceCents: 0,
        durationMin: 45,
        desc: 'Dented or cracked siding, measured, matched and priced.',
      },
      {
        name: 'Full exterior consult',
        priceCents: 0,
        durationMin: 90,
        desc: 'Roof, siding, gutters and windows walked as one plan.',
      },
    ],
    cta: { label: 'See every service & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.claim),
    alt: 'A roofer on a ladder photographing hail damage on a shingle roof for an insurance claim',
    heading: 'We handle the claim. You get a new roof.',
    body: [
      'Filing a storm claim on your own is a part-time job — photos, measurements, the right language, and an adjuster who moves on their own schedule. We do all of it. We document the damage, submit the evidence, and meet the adjuster on your roof so nothing gets missed or lowballed.',
      'You stay in the loop and in control; we carry the weight. When it’s approved, our crews do the work — roof, siding or the whole exterior — and you pay your deductible, not a surprise.',
    ],
    cta: { label: 'Start your free inspection', href: '/book' },
  }),
  teamRow({
    heading: 'The crew we’ll send',
    intro: 'Licensed, insured and storm-tested. You’ll know who’s coming and what they specialize in.',
    members: [
      {
        name: 'Cole Brennan',
        role: 'Storm & roofing lead',
        image: url(IMG.cole),
        alt: 'Cole Brennan, storm and roofing lead',
        bio: 'Twelve years on storm roofs. Cole spots the damage adjusters miss and leads every replacement.',
      },
      {
        name: 'Marisol Vega',
        role: 'Siding & windows specialist',
        image: url(IMG.marisol),
        alt: 'Marisol Vega, siding and windows specialist',
        bio: 'Matches siding you can’t tell from the original and sets windows that hold up next time.',
      },
      {
        name: 'Deshawn Pierce',
        role: 'Insurance & claims lead',
        image: url(IMG.deshawn),
        alt: 'Deshawn Pierce, insurance and claims lead',
        bio: 'A former adjuster who now works your side. Deshawn makes the paperwork and the payout go your way.',
      },
    ],
  }),
  testimonial({
    quote: 'A hailstorm wrecked our roof and I had no idea where to start. Ironclad inspected it the next morning, dealt with the adjuster on my behalf, and three weeks later we had a brand-new roof. I paid my deductible and nothing else.',
    attribution: 'Karen M., homeowner in Cedar Ridge',
  }),
  bookingCta({
    title: 'Roof took a beating in the last storm?',
    sub: 'Book a free inspection online and see live times. Active leaks get the next available crew, same day.',
    cta: { label: 'Book a free storm inspection', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book your inspection',
    sub: 'Pick what you need — a free storm inspection, an estimate, or an emergency tarp — to see live availability and a two-hour arrival window. We’ll confirm your crew and text you before we roll.',
    primary: { label: 'Choose a service below', href: '/book' },
    surface: 'base',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.crew),
    alt: 'An Ironclad crew and branded truck at a storm-damaged house, ready to tarp and inspect',
    heading: 'Built for the day after the storm',
    body: [
      'Ironclad Roofing & Exteriors started after one too many neighbors got steamrolled by their own insurance company — underpaid, under-documented, and left with a patch job instead of the roof they were owed. We decided to be the contractor that stands on the homeowner’s side of the table.',
      'We’re a storm-damage and exteriors specialist: roofing, siding, windows and full exteriors, backed by people who know how claims actually work. We document it right, fight for the full scope, and do the work like it’s our own house.',
    ],
    cta: { label: 'Book a free inspection', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What you can count on',
    items: [
      {
        title: 'Documented, not guessed',
        body: 'Every hit photographed and measured, so your claim is built on evidence an adjuster can’t wave off.',
      },
      {
        title: 'One crew, whole exterior',
        body: 'Roof, siding, gutters and windows handled together — no juggling three contractors after one storm.',
      },
      {
        title: 'Licensed, insured, guaranteed',
        body: 'Fully licensed and insured crews, manufacturer-backed materials, and a workmanship warranty in writing.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the office',
    address: ['Ironclad Roofing & Exteriors', '2075 Ironworks Boulevard', 'Unit C · Cedar Ridge, TX 76048'],
    mapLocation: '2075 Ironworks Boulevard, Cedar Ridge, TX 76048',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 8:00' },
      { day: 'Saturday', time: '7:00 – 7:00' },
      { day: 'Sunday', time: 'Emergencies only' },
      { day: 'Storm emergencies', time: 'Dispatched around the clock' },
    ],
  }),
  bookingCta({
    title: 'Skip the phone tag',
    sub: 'Booking online is faster than calling — see live times and lock in your free inspection in about a minute.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-roofing-storm',
  name: 'sparx — Roofing (Storm)',
  summary:
    'A bold storm-damage and exteriors template — a deep-graphite palette with a sharp signal-red accent and condensed type. Installs a working booking spine for storm inspections and insurance claims: free inspections, claim consults, roof/siding/window estimates and an emergency tarp visit, with three roofers dispatched by skill on their own weekly hours and a priority policy. Ships as "Ironclad Roofing & Exteriors".',
  tagline: 'A bold, storm-ready template for roofers — book inspections online from day one.',
  industry: 'Roofing',
  sortWeight: 29,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Ironclad Roofing & Exteriors',
    tagline: 'We handle the storm and the claim.',
  },
  theme: ironclad,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Ironclad Roofing & Exteriors — storm damage & insurance claims',
      description:
        'Storm-damage roofing specialists. Book a free inspection online, we work directly with your insurance, and handle roofing, siding, windows and emergency tarping.',
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
