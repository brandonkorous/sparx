// sparx-florist-shop — "Petal & Post", a cheerful neighborhood FLOWER SHOP.
//
// The bright, joyful everyday florist — daily fresh arrangements, same-day local delivery,
// flower subscriptions, hands-on workshops, and flowers for sympathy and celebrations.
// Deliberately the SIBLING-OPPOSITE of the artful wedding/event florist template (blush,
// serif, editorial): this one is a warm off-white ground, a coral primary, a fresh-green
// accent and a friendly rounded sans — a shop you walk into, not a boutique you commission.
// Same booking spine, a different business: here you book a consult, set up a subscription,
// or sign up for a workshop.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-florist-shop.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-florist-shop/**" \
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
    hero: 'florist-shop-hero',
    shopfront: 'florist-shop-shopfront',
    rosa: 'florist-shop-rosa',
    iris: 'florist-shop-iris',
    dahlia: 'florist-shop-dahlia',
    work1: 'florist-shop-work1',
    work2: 'florist-shop-work2',
    work3: 'florist-shop-work3',
    subscription: 'florist-shop-subscription',
} as const;

// EMPTY on purpose — every image resolves through the picsum `src()` fallback below, keyed
// by a unique `petalpost-` seed so no two placeholders collide. Swap in real URLs here later.
const PHOTO: Record<string, string> = {
    "petalpost-hero": "https://images.unsplash.com/photo-1763379556955-d0debc5fca86?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmxvd2VyJTIwc2hvcCUyMGJyaWdodHxlbnwwfDB8fHwxNzg2Mzk1MTE4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-shopfront": "https://images.unsplash.com/photo-1652180126225-403b102484b0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxvcmlzdCUyMHNob3AlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2Mzk1MTIyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-rosa": "https://images.unsplash.com/photo-1747835334237-4ab81c9c921a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBmbG9yaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5NTA5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-iris": "https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxvcmlzdCUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwwfDB8fHwxNzg2Mzk1MTI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-dahlia": "https://images.unsplash.com/photo-1596725649320-7f257a9da04b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3aXRoJTIwZmxvd2Vyc3xlbnwwfDB8fHwxNzg2Mzk1MTI5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-work1": "https://images.unsplash.com/photo-1646909988926-5a4b50db7cb4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3JmdWwlMjBib3VxdWV0fGVufDB8MHx8fDE3ODYzOTUxMzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-work2": "https://images.unsplash.com/photo-1610841803453-1b30e19d2354?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJlc2glMjBmbG93ZXJzJTIwYXJyYW5nZW1lbnR8ZW58MHwwfHx8MTc4NjM5NTEzNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-work3": "https://images.unsplash.com/photo-1758524053977-fbc132928e0a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmxvd2VyJTIwZGVsaXZlcnklMjBib3h8ZW58MHwwfHx8MTc4NjM5NTEzOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "petalpost-subscription": "https://images.unsplash.com/photo-1498480086004-2400bd8c3663?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmxvd2VycyUyMHZhc2UlMjBob21lfGVufDB8MHx8fDE3ODYzOTUxNDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
        url: src('petalpost-hero'),
        alt: 'A bright flower shop full of fresh seasonal bouquets in bloom',
    },
    {
        id: IMG.shopfront,
        url: src('petalpost-shopfront'),
        alt: 'The cheerful Petal & Post storefront with buckets of flowers out front',
    },
    { id: IMG.rosa, url: src('petalpost-rosa'), alt: 'Rosa Mendez, shop owner and lead florist' },
    { id: IMG.iris, url: src('petalpost-iris'), alt: 'Iris Lundqvist, florist and workshop host' },
    { id: IMG.dahlia, url: src('petalpost-dahlia'), alt: 'Dahlia Okafor, florist and delivery lead' },
    { id: IMG.work1, url: src('petalpost-work1'), alt: 'A bright hand-tied garden bouquet' },
    { id: IMG.work2, url: src('petalpost-work2'), alt: 'A cheerful mixed arrangement in a jar' },
    { id: IMG.work3, url: src('petalpost-work3'), alt: 'A sunny seasonal centerpiece' },
    {
        id: IMG.subscription,
        url: src('petalpost-subscription'),
        alt: 'A wrapped weekly flower subscription ready for local delivery',
    },
];
const url = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-florist-shop: unknown asset "${id}"`);
    return a.url;
};

// ── Theme — "petalpost": warm off-white ground, coral primary, fresh-green accent, rounded sans ─
const petalpost = defineTheme({
    name: 'petalpost',
    type: { body: face('Inter', 'sans-serif'), head: face('Quicksand', 'sans-serif') },
    shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(98% 0.01 95)', // warm off-white
            'oklch(95% 0.016 92)', // soft cream
            'oklch(90% 0.02 90)', // hairline
            'oklch(28% 0.03 35)', // warm dark ink
        ],
        roles: {
            primary: 'oklch(64% 0.18 25)', // cheerful coral / poppy
            secondary: 'oklch(37% 0.035 35)', // warm dark (readable micro-labels on light)
            accent: 'oklch(70% 0.15 145)', // fresh leaf green
            neutral: 'oklch(30% 0.025 35)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(24% 0.02 35)',
            'oklch(20% 0.016 35)',
            'oklch(16% 0.012 35)',
            'oklch(96% 0.012 95)',
        ],
        roles: {
            primary: 'oklch(72% 0.17 27)',
            secondary: 'oklch(82% 0.02 85)',
            accent: 'oklch(76% 0.14 145)',
            neutral: 'oklch(85% 0.015 85)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Scheduling — the booking spine (policies, florists + hours, the consult/subscription/workshop menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
    days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
    policies: [
        {
            handle: 'petalpost-standard',
            name: 'Standard booking',
            depositType: 'none',
            cancellationWindowHours: 24,
            reminderOffsetsMin: [1440, 120],
            policyText:
                'Please give us at least 24 hours’ notice to change or cancel. We send a reminder the day before and two hours ahead.',
        },
        {
            handle: 'workshop-hold',
            name: 'Workshop seat hold',
            depositType: 'deposit',
            depositAmountCents: 2000,
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 120],
            policyText:
                'Workshop seats hold a $20 deposit that comes off your total. Give us 48 hours’ notice to reschedule and it carries over to the next class.',
        },
    ],
    resources: [
        {
            handle: 'rosa',
            name: 'Rosa Mendez',
            kind: 'staff',
            skillTags: ['arrangements', 'subscription', 'general'],
            windows: hours([2, 3, 4, 5, 6], 540, 1050), // Tue–Sat 9–5:30
        },
        {
            handle: 'iris',
            name: 'Iris Lundqvist',
            kind: 'staff',
            skillTags: ['workshop', 'arrangements', 'general'],
            windows: hours([3, 4, 5, 6, 0], 600, 1080), // Wed–Sun 10–6
        },
        {
            handle: 'dahlia',
            name: 'Dahlia Okafor',
            kind: 'staff',
            skillTags: ['delivery', 'arrangements', 'general'],
            windows: hours([2, 3, 4, 5, 6], 540, 1020), // Tue–Sat 9–5
        },
        {
            handle: 'workshop-room',
            name: 'The Potting Table',
            kind: 'space',
            skillTags: ['workshop-room'],
            windows: hours([4, 5, 6], 600, 1140), // Thu–Sat 10–7
        },
    ],
    services: [
        {
            handle: 'consult-call',
            name: 'Free flower consult',
            description:
                'A quick, no-pressure chat about what you need — an occasion, a budget, a favourite color — and we’ll point you the right way.',
            durationMinutes: 20,
            priceCents: 0,
            assignmentStrategy: 'any_available',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['general'], count: 1 },
            ],
            policyHandle: 'petalpost-standard',
        },
        {
            handle: 'custom-arrangement-consult',
            name: 'Custom arrangement consult',
            description:
                'Sit down with a florist to design a one-off bouquet or arrangement — flowers, palette, vessel and size, all your call.',
            durationMinutes: 45,
            priceCents: 2500,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['general'], count: 1 },
            ],
            policyHandle: 'petalpost-standard',
        },
        {
            handle: 'subscription-setup',
            name: 'Flower subscription setup',
            description:
                'Set up a weekly, fortnightly or monthly bunch — pick your palette and delivery day and we’ll keep the fresh flowers coming.',
            durationMinutes: 30,
            priceCents: 1500,
            assignmentStrategy: 'any_available',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['general'], count: 1 },
            ],
            policyHandle: 'petalpost-standard',
        },
        {
            handle: 'sympathy-consult',
            name: 'Sympathy flowers consult',
            description:
                'A gentle, unhurried conversation to arrange sympathy or funeral flowers — we’ll handle the details with care.',
            durationMinutes: 30,
            priceCents: 2000,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['general'], count: 1 },
            ],
            policyHandle: 'petalpost-standard',
        },
        {
            handle: 'celebration-consult',
            name: 'Celebration flowers consult',
            description:
                'Birthdays, anniversaries, new babies, big wins — plan flowers for the happy days, delivered or picked up.',
            durationMinutes: 45,
            priceCents: 3000,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['general'], count: 1 },
            ],
            policyHandle: 'petalpost-standard',
        },
        {
            handle: 'flower-workshop',
            name: 'Hands-on flower workshop',
            description:
                'A cheerful ninety minutes at the potting table — you’ll build a seasonal arrangement to take home, flowers and coffee included.',
            durationMinutes: 90,
            priceCents: 6500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['workshop'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['workshop-room'], count: 1 },
            ],
            policyHandle: 'workshop-hold',
        },
        {
            handle: 'corporate-flowers-consult',
            name: 'Office & corporate flowers consult',
            description:
                'Set up a standing order for your lobby, front desk or event — fresh flowers on a schedule that suits the space.',
            durationMinutes: 45,
            priceCents: 3500,
            assignmentStrategy: 'any_available',
            resourceRequirements: [
                { role: 'florist', kind: 'staff', skillTags: ['general'], count: 1 },
            ],
            policyHandle: 'petalpost-standard',
        },
    ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
    photoHero({
        image: url(IMG.hero),
        alt: 'A bright flower shop full of fresh seasonal bouquets in bloom',
        title: 'Fresh flowers, picked for your day',
        sub: 'A cheerful neighbourhood flower shop — daily fresh bunches, same-day local delivery, subscriptions and hands-on workshops.',
        primary: { label: 'Book a consult', href: '/book' },
        secondary: { label: 'See what we do', href: '/book' },
        overlay: 'dark',
    }),
    featureRow({
        items: [
            {
                title: 'Fresh in every day',
                body: 'We buy small and often, so the buckets are full of what’s actually in season — never tired stems dressed up to look new.',
            },
            {
                title: 'Same-day local delivery',
                body: 'Order by early afternoon and we’ll hand-deliver around the neighbourhood the same day, with a note in your own words.',
            },
            {
                title: 'Flower subscriptions',
                body: 'A fresh bunch on your table every week, fortnight or month — pick a palette and a day, and we do the rest.',
            },
            {
                title: 'Hands-on workshops',
                body: 'Grab a friend and build your own arrangement at the potting table. Flowers, coffee and a good hour, all included.',
            },
        ],
    }),
    serviceMenu({
        heading: 'How to book with us',
        intro: 'Start with a quick consult, set up a subscription, or grab a seat at a workshop. Live times and full details are on the booking page.',
        surface: 'muted',
        columns: 2,
        items: [
            {
                name: 'Free flower consult',
                priceCents: 0,
                durationMin: 20,
                desc: 'A quick chat about your occasion, budget and colors.',
            },
            {
                name: 'Custom arrangement consult',
                priceCents: 2500,
                durationMin: 45,
                desc: 'Design a one-off bouquet with a florist, start to finish.',
            },
            {
                name: 'Flower subscription setup',
                priceCents: 1500,
                durationMin: 30,
                desc: 'Weekly, fortnightly or monthly fresh flowers, your palette.',
            },
            {
                name: 'Hands-on flower workshop',
                priceCents: 6500,
                durationMin: 90,
                desc: 'Build a seasonal arrangement to take home — flowers included.',
            },
        ],
        cta: { label: 'See everything & book', href: '/book' },
    }),
    galleryStrip({
        heading: 'Fresh from the bench',
        surface: 'base',
        columns: 3,
        images: [
            { src: url(IMG.work1), alt: 'A bright hand-tied garden bouquet' },
            { src: url(IMG.work2), alt: 'A cheerful mixed arrangement in a jar' },
            { src: url(IMG.work3), alt: 'A sunny seasonal centerpiece' },
        ],
    }),
    splitFeature({
        image: url(IMG.subscription),
        alt: 'A wrapped weekly flower subscription ready for local delivery',
        heading: 'Fresh flowers, handled for you',
        body: [
            'A subscription is the easy way to always have flowers on the table. Pick your palette and your day, and we’ll wrap a fresh, seasonal bunch and bring it round — every week, fortnight or month.',
            'Same-day local delivery means a last-minute gift is never a problem either. Order in the morning, and it’s on their doorstep by evening, with a card in your own words.',
        ],
        cta: { label: 'Set up a subscription', href: '/book' },
    }),
    teamRow({
        heading: 'Meet the florists',
        intro: 'Book by name — you’ll get the same friendly face who knows what you like.',
        members: [
            {
                name: 'Rosa Mendez',
                role: 'Owner & lead florist',
                image: url(IMG.rosa),
                alt: 'Rosa Mendez, shop owner and lead florist',
                bio: 'Opened Petal & Post to keep the neighbourhood in fresh flowers. Loves a big, generous garden bunch.',
            },
            {
                name: 'Iris Lundqvist',
                role: 'Florist & workshop host',
                image: url(IMG.iris),
                alt: 'Iris Lundqvist, florist and workshop host',
                bio: 'Runs the potting-table workshops and never met a color combination she wouldn’t try.',
            },
            {
                name: 'Dahlia Okafor',
                role: 'Florist & delivery lead',
                image: url(IMG.dahlia),
                alt: 'Dahlia Okafor, florist and delivery lead',
                bio: 'Keeps same-day deliveries running on time and always slips in an extra stem or two.',
            },
        ],
    }),
    testimonial({
        quote: 'My weekly bunch is the little thing I look forward to most. Always fresh, always cheerful, and delivered with a smile.',
        attribution: 'Meera, subscriber since 2024',
        surface: 'muted',
    }),
    bookingCta({
        title: 'Let’s make something bloom',
        sub: 'Book a quick consult, start a subscription or grab a workshop seat. It only takes a minute.',
        cta: { label: 'Book a consult', href: '/book' },
    }),
];

const BOOK_INTRO = [
    photoHero({
        image: url(IMG.shopfront),
        alt: 'The cheerful Petal & Post storefront with buckets of flowers out front',
        title: 'Book with Petal & Post',
        sub: 'Choose a consult, a subscription setup or a workshop to see live availability, then pick your florist and time.',
        primary: { label: 'See options below', href: '/book' },
        overlay: 'darker',
        align: 'start',
    }),
];

const ABOUT = [
    splitFeature({
        image: url(IMG.hero),
        alt: 'A bright flower shop full of fresh seasonal bouquets in bloom',
        heading: 'About Petal & Post',
        body: [
            'Petal & Post is a small, cheerful flower shop on the corner — the kind of place you can pop into for a last-minute bunch or plan something special weeks ahead.',
            'We buy fresh and local wherever we can, arrange everything by hand, and genuinely love helping you pick flowers for the good days and the hard ones alike.',
        ],
        cta: { label: 'Book a consult', href: '/book' },
    }),
    featureRow({
        surface: 'muted',
        heading: 'What we’re about',
        items: [
            {
                title: 'Seasonal & fresh',
                body: 'We follow what’s actually growing, so your flowers are at their best and last longer on the table.',
            },
            {
                title: 'Flowers for every day',
                body: 'Birthdays and big celebrations, quiet sympathy flowers, or just a Tuesday pick-me-up — all equally welcome.',
            },
            {
                title: 'Part of the neighbourhood',
                body: 'Same-day local delivery, standing orders for nearby offices, and workshops that bring people in the door.',
            },
        ],
    }),
];

const CONTACT = [
    findUs({
        heading: 'Come say hello',
        address: ['Petal & Post', '14 Marigold Lane', 'Portland, OR 97214'],
        mapLocation: '14 Marigold Lane, Portland, OR 97214',
        hours: [
            { day: 'Tuesday – Friday', time: '9:00 – 6:00' },
            { day: 'Saturday', time: '9:00 – 5:00' },
            { day: 'Sunday', time: '10:00 – 3:00' },
            { day: 'Monday', time: 'Closed' },
        ],
    }),
    bookingCta({
        title: 'Rather book online?',
        sub: 'See live availability and reserve a consult, subscription setup or workshop seat — no phone tag.',
        surface: 'muted',
        cta: { label: 'Book a consult', href: '/book' },
    }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
    key: 'sparx-florist-shop',
    name: 'Florist (Shop)',
    summary:
        'A bright, joyful neighbourhood flower-shop site — a warm off-white ground, a cheerful coral primary, a fresh-green accent and a friendly rounded display. Installs a working booking flow: online booking for consults, flower subscriptions and hands-on workshops, with the shop’s florists as bookable resources on their own hours. Same-day local delivery, daily fresh arrangements, sympathy and celebration flowers. Ships as "Petal & Post".',
    tagline: 'A cheerful template for neighbourhood flower shops — book online from day one.',
    industry: 'Florist',
    sortWeight: 17,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: { businessName: 'Petal & Post', tagline: 'Fresh flowers, picked for your day.' },
    theme: petalpost,
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Petal & Post — a neighbourhood flower shop',
            description:
                'Petal & Post is a cheerful flower shop for daily fresh bunches, same-day local delivery, subscriptions and workshops. Book a consult online.',
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
