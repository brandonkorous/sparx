// sparx-salon-modern — "Wildroot", a modern, warm, boho hair salon.
//
// The second hair-salon template, and deliberately NOT the editorial one. Where
// "Maison Élan" is a calm warm-ivory / brass / serif studio in the quiet-luxury lane,
// Wildroot is the relaxed, plant-filled, natural-light salon: an oat-cream ground, a
// terracotta primary, a sage-green accent, warm-brown ink, and a softer, rounder shape.
// It leads with a different promise (come as you are), weaves a plants-and-texture beat,
// and centres a curly-and-textured-hair specialism — same booking spine, a different
// business with a different feel.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-salon-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-salon-modern/**" \
//     "marketplace-catalog/_gen/**/*.ts"

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

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
    hero: 'salon-modern-hero',
    space: 'salon-modern-space',
    curly: 'salon-modern-curly',
    rowan: 'salon-modern-rowan',
    juniper: 'salon-modern-juniper',
    marisol: 'salon-modern-marisol',
    work1: 'salon-modern-work1',
    work2: 'salon-modern-work2',
    work3: 'salon-modern-work3',
} as const;

const PHOTO: Record<string, string> = {
    "wildroot-hero": "https://images.unsplash.com/photo-1637777277337-f114350fb088?w=1600&q=80",
    "wildroot-space": "https://images.unsplash.com/photo-1747832802200-7aaceb517e0c?w=1600&q=80",
    "wildroot-curly": "https://images.unsplash.com/photo-1747832802200-7aaceb517e0c?w=1600&q=80",
    "wildroot-rowan": "https://images.unsplash.com/photo-1560869713-7d0a29430803?w=1600&q=80",
    "wildroot-juniper": "https://images.unsplash.com/photo-1617690825153-8bb0a8e3c911?w=1600&q=80",
    "wildroot-marisol": "https://images.unsplash.com/photo-1605980766335-d3a41c7332a1?w=1600&q=80",
    "wildroot-work1": "https://images.unsplash.com/photo-1600948835780-9c4a8b55cf50?w=1600&q=80",
    "wildroot-work2": "https://images.unsplash.com/photo-1763741141049-352dfafcc64f?w=1600&q=80",
    "wildroot-work3": "https://images.unsplash.com/photo-1717160675643-53a7a2ebaa9f?w=1600&q=80",
};
const src = (seed: string): string =>
    PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}
const ASSETS: Asset[] = [
    { id: IMG.hero, url: src('wildroot-hero'), alt: 'A sunlit salon full of plants and warm wood' },
    { id: IMG.space, url: src('wildroot-space'), alt: 'A styling corner with trailing plants and natural light' },
    { id: IMG.curly, url: src('wildroot-curly'), alt: 'A stylist shaping defined, healthy curls' },
    { id: IMG.rowan, url: src('wildroot-rowan'), alt: 'Rowan Ellis, curl and cut specialist' },
    { id: IMG.juniper, url: src('wildroot-juniper'), alt: 'Juniper Vale, color specialist' },
    { id: IMG.marisol, url: src('wildroot-marisol'), alt: 'Marisol Reyes, stylist' },
    { id: IMG.work1, url: src('wildroot-work1'), alt: 'Sun-kissed, hand-painted highlights' },
    { id: IMG.work2, url: src('wildroot-work2'), alt: 'A bouncy, defined curly cut' },
    { id: IMG.work3, url: src('wildroot-work3'), alt: 'A soft, textured lived-in shag' },
];
const url = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-salon-modern: unknown asset "${id}"`);
    return a.url;
};

// ── Theme — "wildroot": oat-cream ground, terracotta primary, sage accent, warm-brown ink ─
const wildroot = defineTheme({
    name: 'wildroot',
    type: { body: face('Nunito', 'sans-serif'), head: face('Fraunces', 'serif') },
    shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(96% 0.016 74)', // warm oat cream
            'oklch(92% 0.022 70)', // oat
            'oklch(86% 0.026 66)', // clay hairline
            'oklch(30% 0.03 56)', // warm brown ink
        ],
        roles: {
            primary: 'oklch(57% 0.13 42)', // terracotta / clay
            secondary: 'oklch(41% 0.04 55)', // warm brown
            accent: 'oklch(60% 0.055 148)', // sage green
            neutral: 'oklch(32% 0.022 56)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(24% 0.02 55)', // warm brown-black
            'oklch(20% 0.018 55)',
            'oklch(16% 0.015 55)',
            'oklch(94% 0.016 78)', // warm cream ink
        ],
        roles: {
            primary: 'oklch(69% 0.13 45)', // brighter terracotta
            secondary: 'oklch(74% 0.03 70)',
            accent: 'oklch(72% 0.06 148)', // brighter sage
            neutral: 'oklch(82% 0.022 72)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Scheduling — the booking spine (policies, stylists + hours, the service menu) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
    days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
    policies: [
        {
            handle: 'salon-standard',
            name: 'Standard booking',
            depositType: 'none',
            cancellationWindowHours: 24,
            reminderOffsetsMin: [1440, 120],
            policyText:
                'Life happens — just give us 24 hours if you need to move or cancel. We’ll text you a reminder the day before and again two hours ahead.',
        },
        {
            handle: 'color-deposit',
            name: 'Color deposit',
            depositType: 'deposit',
            depositAmountCents: 3000,
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 120],
            policyText:
                'Color and balayage hold a $30 deposit that comes straight off your total. Move your appointment with 48 hours’ notice and it carries right over.',
        },
    ],
    resources: [
        {
            handle: 'rowan',
            name: 'Rowan Ellis',
            kind: 'staff',
            skillTags: ['cut', 'curly', 'styling', 'treatment', 'kids'],
            windows: hours([2, 3, 4, 5, 6], 540, 1140), // Tue–Sat 9–7
        },
        {
            handle: 'juniper',
            name: 'Juniper Vale',
            kind: 'staff',
            skillTags: ['cut', 'color', 'balayage', 'gloss', 'treatment'],
            windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
        },
        {
            handle: 'marisol',
            name: 'Marisol Reyes',
            kind: 'staff',
            skillTags: ['cut', 'curly', 'color', 'styling', 'kids'],
            windows: hours([2, 4, 5, 6], 540, 1080), // Tue, Thu–Sat 9–6
        },
    ],
    services: [
        {
            handle: 'cut-style',
            name: 'Cut & style',
            description: 'A proper consult, a cut shaped to how your hair actually grows, and a styled finish.',
            durationMinutes: 60,
            priceCents: 7000,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'stylist', kind: 'staff', skillTags: ['cut'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'curly-cut',
            name: 'Curly & textured cut',
            description: 'A dry, curl-by-curl cut for coils, curls and waves — shaped to your pattern, styled to last.',
            durationMinutes: 75,
            priceCents: 8500,
            bufferAfterMin: 10,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'curl specialist', kind: 'staff', skillTags: ['curly'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'color',
            name: 'Color',
            description: 'Single-process color, root to tip, finished with a gloss so it leaves shiny and even.',
            durationMinutes: 120,
            priceCents: 14000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'colorist', kind: 'staff', skillTags: ['color'], count: 1 }],
            policyHandle: 'color-deposit',
        },
        {
            handle: 'balayage',
            name: 'Balayage & highlights',
            description: 'Hand-painted, sun-kissed lightness with a soft grow-out — the low-maintenance kind.',
            durationMinutes: 180,
            priceCents: 21000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'colorist', kind: 'staff', skillTags: ['balayage'], count: 1 }],
            policyHandle: 'color-deposit',
        },
        {
            handle: 'gloss-toner',
            name: 'Gloss & toner',
            description: 'A quick shine-and-tone refresh to keep your color looking new between visits.',
            durationMinutes: 45,
            priceCents: 6000,
            bufferAfterMin: 10,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'colorist', kind: 'staff', skillTags: ['gloss'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'treatment',
            name: 'Deep-conditioning treatment',
            description: 'A rich, restorative mask and scalp massage that leaves hair softer, stronger and easier to style.',
            durationMinutes: 45,
            priceCents: 5500,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'stylist', kind: 'staff', skillTags: ['treatment'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'kids-cut',
            name: 'Kids’ cut',
            description: 'An easy, patient cut for little ones (12 and under) — no rush, no fuss.',
            durationMinutes: 30,
            priceCents: 3500,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'stylist', kind: 'staff', skillTags: ['kids'], count: 1 }],
            policyHandle: 'salon-standard',
        },
    ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
    photoHero({
        image: url(IMG.hero),
        alt: 'A sunlit salon full of plants and warm wood',
        title: 'Come as you are, leave feeling like you',
        sub: 'A warm, plant-filled little salon for real hair and real people — cuts, color and curls done at a human pace, never a rushed one.',
        primary: { label: 'Book online', href: '/book' },
        secondary: { label: 'See the menu', href: '/book' },
        overlay: 'dark',
    }),
    featureRow({
        items: [
            {
                title: 'Curls and texture are our thing',
                body: 'Coils, curls, waves and everything in between — cut dry, curl by curl, by people who actually specialise in it. No more leaving hoping it dries right.',
            },
            {
                title: 'No rushing, ever',
                body: 'One person, one chair, one appointment at a time. We keep the day unhurried so you get a real consult and a proper finish, not a conveyor belt.',
            },
            {
                title: 'A room that feels good to be in',
                body: 'Big windows, a lot of plants, good music and better coffee. It’s the kind of hour that feels less like an errand and more like a small reset.',
            },
        ],
    }),
    splitFeature({
        image: url(IMG.space),
        alt: 'A styling corner with trailing plants and natural light',
        heading: 'A little green, a lot of light',
        body: [
            'Wildroot is a small studio we built to feel like a warm living room — reclaimed wood, natural light, and honestly more plants than we can keep count of.',
            'It’s a deliberate kind of calm. Fewer chairs means more attention, a slower pace, and a space you actually want to sit in for an hour.',
        ],
        cta: { label: 'Come see it', href: '/book' },
    }),
    serviceMenu({
        heading: 'What we do',
        intro: 'A few of our most-booked services. Full prices and live availability are on the booking page.',
        surface: 'muted',
        columns: 2,
        items: [
            { name: 'Curly & textured cut', priceCents: 8500, durationMin: 75, desc: 'A dry, curl-by-curl cut shaped to your pattern.' },
            { name: 'Cut & style', priceCents: 7000, durationMin: 60, desc: 'A consult, a cut and a styled finish.' },
            { name: 'Balayage & highlights', priceCents: 21000, durationMin: 180, desc: 'Hand-painted, sun-kissed lightness.' },
            { name: 'Color', priceCents: 14000, durationMin: 120, desc: 'Root-to-tip color finished with a gloss.' },
        ],
        cta: { label: 'See everything & book', href: '/book' },
    }),
    splitFeature({
        image: url(IMG.curly),
        alt: 'A stylist shaping defined, healthy curls',
        heading: 'Curly & textured hair, done right',
        body: [
            'If you’ve ever left a salon with a great cut you could never quite recreate, this is for you. We cut curls dry and in their natural shape, so what you see in the chair is what you get at home.',
            'We’ll teach you the routine too — the products, the technique, the shortcuts — so your hair works on an ordinary Wednesday, not just the day you leave.',
        ],
        reverse: true,
        cta: { label: 'Book a curl consult', href: '/book' },
    }),
    teamRow({
        heading: 'The people behind the chairs',
        intro: 'Book by name — you’ll see the same person each time, someone who gets to know your hair.',
        members: [
            { name: 'Rowan Ellis', role: 'Curl & cut specialist', image: url(IMG.rowan), alt: 'Rowan Ellis, curl and cut specialist', bio: 'Lives for curls and texture. Cuts dry, teaches the routine, sends you home confident.' },
            { name: 'Juniper Vale', role: 'Color specialist', image: url(IMG.juniper), alt: 'Juniper Vale, color specialist', bio: 'Balayage, lived-in color and glosses that grow out soft and low-upkeep.' },
            { name: 'Marisol Reyes', role: 'Stylist', image: url(IMG.marisol), alt: 'Marisol Reyes, stylist', bio: 'Easy, wearable cuts and color — and endlessly patient with the little ones.' },
        ],
    }),
    galleryStrip({
        heading: 'A little of our recent work',
        surface: 'muted',
        columns: 3,
        images: [
            { src: url(IMG.work1), alt: 'Sun-kissed, hand-painted highlights' },
            { src: url(IMG.work2), alt: 'A bouncy, defined curly cut' },
            { src: url(IMG.work3), alt: 'A soft, textured lived-in shag' },
        ],
    }),
    testimonial({
        quote: 'First time in my life a stylist actually knew what to do with my curls. I walked out and cried a little in the good way.',
        attribution: 'Dani, client since 2024',
    }),
    bookingCta({
        title: 'Let’s find you a chair',
        sub: 'Pick a service, choose your stylist and see live times. It takes about a minute.',
        cta: { label: 'Book online', href: '/book' },
    }),
];

const BOOK_INTRO = [
    photoHero({
        image: url(IMG.space),
        alt: 'A styling corner with trailing plants and natural light',
        title: 'Book your appointment',
        sub: 'Choose a service to see prices and live availability, then pick your stylist and a time that works.',
        primary: { label: 'See services below', href: '/book' },
        overlay: 'darker',
        align: 'start',
    }),
];

const ABOUT = [
    splitFeature({
        image: url(IMG.hero),
        alt: 'A sunlit salon full of plants and warm wood',
        heading: 'About Wildroot',
        body: [
            'We started Wildroot because we wanted a salon that felt like a real place, not a production line — somewhere warm and unhurried, where curly and textured hair is the specialty rather than the afterthought.',
            'No upselling, no rushing, no leaving with a look you can’t recreate. Just honest cuts, soft color, a lot of plants, and an hour that’s genuinely yours.',
        ],
        cta: { label: 'Book a chair', href: '/book' },
    }),
    featureRow({
        surface: 'muted',
        heading: 'How we work',
        items: [
            { title: 'Consult first, always', body: 'Every appointment opens with a real conversation about your hair, your routine and what you actually want to walk out with.' },
            { title: 'Gentle, good products', body: 'Salon-grade, kinder-on-your-hair color and care — and honest advice on the short list of things worth taking home.' },
            { title: 'You leave knowing how', body: 'We show you how to get the look again yourself, so it holds up long after you’ve left the chair.' },
        ],
    }),
];

const CONTACT = [
    findUs({
        heading: 'Come find us',
        address: ['Wildroot', '42 Haywood Road', 'Studio B · Asheville, NC 28806'],
        mapLocation: '42 Haywood Road, Asheville, NC 28806',
        hours: [
            { day: 'Tuesday – Saturday', time: '9:00 – 7:00' },
            { day: 'Sunday', time: '10:00 – 5:00' },
            { day: 'Monday', time: 'Closed' },
        ],
    }),
    bookingCta({
        title: 'Rather book than call?',
        sub: 'See live availability and grab your time online — no phone tag, no waiting on hold.',
        surface: 'muted',
        cta: { label: 'Book online', href: '/book' },
    }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
    key: 'sparx-salon-modern',
    name: 'Salon (Modern)',
    summary:
        'A modern, warm, boho hair-salon site — an oat-cream palette, a terracotta primary and a sage-green accent, with natural-light photography and a relaxed, friendly voice. Installs a working booking flow: a real service menu (cuts, curly & textured cuts, color, balayage), three stylists you book by name with their own hours, and a color-deposit policy. Ships as "Wildroot", a plant-filled little studio that specialises in curls and texture.',
    tagline: 'A warm, modern-boho template for hair salons — book online from day one.',
    industry: 'Hair salon',
    sortWeight: 89,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: { businessName: 'Wildroot', tagline: 'Real hair, real people, no rushing.' },
    theme: wildroot,
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Wildroot — a modern hair salon for curls & texture',
            description:
                'Wildroot is a warm, plant-filled salon in Asheville specialising in curly and textured hair — cuts, color and balayage at a human pace. Book your stylist online.',
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
