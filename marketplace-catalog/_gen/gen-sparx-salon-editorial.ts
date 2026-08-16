// sparx-salon-editorial — "Maison Élan", an upscale EDITORIAL hair salon.
//
// The refined, warm-minimal salon of the design research (Jo Hansford / George Northwood
// / David Mallett lane): a warm-ivory ground, a brass primary, a high-contrast serif
// display over a humanist sans, and soft-lit photography carrying the page. Deliberately
// the OPPOSITE of the barbershop templates (dark, heritage, blade-and-brass) and distinct
// from the second salon template (modern-boho, warmer and more textured) — same booking
// spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-salon-editorial.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-salon-editorial/**" \
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
    hero: 'salon-editorial-hero',
    interior: 'salon-editorial-interior',
    ava: 'salon-editorial-ava',
    maya: 'salon-editorial-maya',
    noor: 'salon-editorial-noor',
    work1: 'salon-editorial-work1',
    work2: 'salon-editorial-work2',
    work3: 'salon-editorial-work3',
} as const;

const PHOTO: Record<string, string> = {
    "maison-hero": "https://images.unsplash.com/photo-1706629503650-cade709d15e3?w=1600&q=80",
    "maison-interior": "https://images.unsplash.com/photo-1712213396688-c6f2d536671f?w=1600&q=80",
    "maison-ava": "https://images.unsplash.com/photo-1734111719430-fe4a3973f8af?w=1600&q=80",
    "maison-maya": "https://images.unsplash.com/photo-1777125259057-67d1dae9caad?w=1600&q=80",
    "maison-noor": "https://images.unsplash.com/photo-1546877625-cb8c71916608?w=1600&q=80",
    "maison-work1": "https://images.unsplash.com/photo-1785456390070-9960e3997066?w=1600&q=80",
    "maison-work2": "https://images.unsplash.com/photo-1672788709547-6d7f239972c3?w=1600&q=80",
    "maison-work3": "https://images.unsplash.com/photo-1613754773306-532ec48b0de5?w=1600&q=80",
};
const src = (seed: string): string =>
    PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}
const ASSETS: Asset[] = [
    { id: IMG.hero, url: src('maison-hero'), alt: 'A bright, calm salon interior in warm neutrals' },
    { id: IMG.interior, url: src('maison-interior'), alt: 'A styling station with soft natural light' },
    { id: IMG.ava, url: src('maison-ava'), alt: 'Ava Bennett, senior stylist' },
    { id: IMG.maya, url: src('maison-maya'), alt: 'Maya Cole, stylist' },
    { id: IMG.noor, url: src('maison-noor'), alt: 'Noor Rahim, color specialist' },
    { id: IMG.work1, url: src('maison-work1'), alt: 'A soft, lived-in balayage' },
    { id: IMG.work2, url: src('maison-work2'), alt: 'A precise, glossy blunt cut' },
    { id: IMG.work3, url: src('maison-work3'), alt: 'An effortless textured finish' },
];
const url = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-salon-editorial: unknown asset "${id}"`);
    return a.url;
};

// ── Theme — "maison": warm-ivory ground, brass primary, dusty-rose accent, serif display ─
const maison = defineTheme({
    name: 'maison',
    type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
    shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(97% 0.008 85)', // warm ivory
            'oklch(93% 0.012 82)', // oat
            'oklch(88% 0.015 80)', // hairline
            'oklch(26% 0.012 60)', // warm charcoal ink
        ],
        roles: {
            primary: 'oklch(66% 0.075 76)', // brass gold
            secondary: 'oklch(42% 0.012 55)', // warm charcoal
            accent: 'oklch(72% 0.055 25)', // dusty rose
            neutral: 'oklch(28% 0.01 60)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(23% 0.01 60)',
            'oklch(19% 0.008 60)',
            'oklch(15% 0.006 60)',
            'oklch(94% 0.008 85)',
        ],
        roles: {
            primary: 'oklch(76% 0.08 78)',
            secondary: 'oklch(74% 0.012 70)',
            accent: 'oklch(78% 0.06 25)',
            neutral: 'oklch(82% 0.01 70)',
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
                'Please give us at least 24 hours’ notice to change or cancel. We send a reminder the day before and two hours ahead.',
        },
        {
            handle: 'color-deposit',
            name: 'Color deposit',
            depositType: 'deposit',
            depositAmountCents: 2500,
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 120],
            policyText:
                'Color appointments hold a $25 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over.',
        },
    ],
    resources: [
        {
            handle: 'ava',
            name: 'Ava Bennett',
            kind: 'staff',
            skillTags: ['cut', 'color', 'styling', 'treatment', 'balayage'],
            windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
        },
        {
            handle: 'maya',
            name: 'Maya Cole',
            kind: 'staff',
            skillTags: ['cut', 'styling', 'treatment'],
            windows: hours([3, 4, 5, 6, 0], 600, 1140), // Wed–Sun 10–7
        },
        {
            handle: 'noor',
            name: 'Noor Rahim',
            kind: 'staff',
            skillTags: ['color', 'balayage', 'treatment'],
            windows: hours([2, 4, 5, 6], 600, 1080), // Tue, Thu–Sat 10–6
        },
    ],
    services: [
        {
            handle: 'cut-finish',
            name: 'Cut & finish',
            description: 'A consultation, a precise cut and a polished blow-dry to finish.',
            durationMinutes: 60,
            priceCents: 8500,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'stylist', kind: 'staff', skillTags: ['cut'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'blow-dry',
            name: 'Blow-dry & style',
            description: 'A wash and a styled finish — smooth, soft or full-bodied, however you like it.',
            durationMinutes: 45,
            priceCents: 5000,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'gloss-toner',
            name: 'Gloss & toner',
            description: 'A shine-boosting gloss to refresh tone between color appointments.',
            durationMinutes: 60,
            priceCents: 7500,
            bufferAfterMin: 10,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'colorist', kind: 'staff', skillTags: ['color'], count: 1 }],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'full-color',
            name: 'Full color',
            description: 'Single-process color, root to tip, with a gloss and a finish.',
            durationMinutes: 120,
            priceCents: 16000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'colorist', kind: 'staff', skillTags: ['color'], count: 1 }],
            policyHandle: 'color-deposit',
        },
        {
            handle: 'balayage',
            name: 'Balayage',
            description: 'Hand-painted, lived-in lightness — soft grow-out, low upkeep.',
            durationMinutes: 180,
            priceCents: 24000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'colorist', kind: 'staff', skillTags: ['balayage'], count: 1 }],
            policyHandle: 'color-deposit',
        },
        {
            handle: 'bond-treatment',
            name: 'Bond-repair treatment',
            description: 'A strengthening treatment that leaves hair softer, shinier and easier to manage.',
            durationMinutes: 45,
            priceCents: 6500,
            assignmentStrategy: 'any_available',
            resourceRequirements: [
                { role: 'stylist', kind: 'staff', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'salon-standard',
        },
        {
            handle: 'bridal-styling',
            name: 'Bridal styling',
            description: 'A trial and day-of styling for the wedding — booked with a consultation first.',
            durationMinutes: 90,
            priceCents: 15000,
            requiresApproval: true,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'stylist', kind: 'staff', skillTags: ['styling'], count: 1 }],
            policyHandle: 'color-deposit',
        },
    ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
    photoHero({
        image: url(IMG.hero),
        alt: 'A bright, calm salon interior in warm neutrals',
        title: 'Hair that feels like you, only better',
        sub: 'A calm studio for considered cuts, soft lived-in color and the kind of finish that lasts past the front door.',
        primary: { label: 'Book online', href: '/book' },
        secondary: { label: 'See services', href: '/book' },
        overlay: 'dark',
    }),
    featureRow({
        items: [
            {
                title: 'Stylists, not a conveyor belt',
                body: 'You’ll see the same person each visit — someone who learns your hair and plans it with you, never rushes it.',
            },
            {
                title: 'Color that grows out kindly',
                body: 'Soft, hand-placed color designed for low upkeep — so you leave less often and love it longer.',
            },
            {
                title: 'A calm hour that’s yours',
                body: 'No overbooking, no noise. Just a quiet chair, good coffee and an hour that feels like a small reset.',
            },
        ],
    }),
    serviceMenu({
        heading: 'The menu',
        intro: 'A few of the things we do most. Full prices and live availability are on the booking page.',
        surface: 'muted',
        columns: 2,
        items: [
            { name: 'Cut & finish', priceCents: 8500, durationMin: 60, desc: 'Consult, cut and a polished blow-dry.' },
            { name: 'Balayage', priceCents: 24000, durationMin: 180, desc: 'Hand-painted, lived-in lightness.' },
            { name: 'Full color', priceCents: 16000, durationMin: 120, desc: 'Root-to-tip color with a gloss.' },
            { name: 'Blow-dry & style', priceCents: 5000, durationMin: 45, desc: 'A wash and a styled finish.' },
        ],
        cta: { label: 'See everything & book', href: '/book' },
    }),
    splitFeature({
        image: url(IMG.interior),
        alt: 'A styling station with soft natural light',
        heading: 'A small studio, on purpose',
        body: [
            'Maison Élan is a three-chair studio, not a factory floor. We keep the day unhurried so every appointment gets a real consultation and a proper finish.',
            'That’s the whole idea: fewer people, more attention, and hair you don’t have to fuss with once you’re home.',
        ],
        cta: { label: 'Book your chair', href: '/book' },
    }),
    teamRow({
        heading: 'Who you’ll sit with',
        intro: 'Book by name — you’ll see the same stylist each time.',
        members: [
            { name: 'Ava Bennett', role: 'Senior stylist', image: url(IMG.ava), alt: 'Ava Bennett, senior stylist', bio: 'Precision cuts and quiet-luxury color. Ava leads the studio.' },
            { name: 'Maya Cole', role: 'Stylist', image: url(IMG.maya), alt: 'Maya Cole, stylist', bio: 'Texture, curtain bangs and the easy, undone finish.' },
            { name: 'Noor Rahim', role: 'Color specialist', image: url(IMG.noor), alt: 'Noor Rahim, color specialist', bio: 'Balayage and lived-in color that grows out beautifully.' },
        ],
    }),
    galleryStrip({
        heading: 'Recent work',
        surface: 'muted',
        columns: 3,
        images: [
            { src: url(IMG.work1), alt: 'A soft, lived-in balayage' },
            { src: url(IMG.work2), alt: 'A precise, glossy blunt cut' },
            { src: url(IMG.work3), alt: 'An effortless textured finish' },
        ],
    }),
    testimonial({
        quote: 'First salon in years where I actually look like the photo I brought in. I leave calmer than I arrived.',
        attribution: 'Priya, client since 2023',
    }),
    bookingCta({
        title: 'Ready when you are',
        sub: 'Pick a service, choose your stylist and see live times. It takes about a minute.',
        cta: { label: 'Book online', href: '/book' },
    }),
];

const BOOK_INTRO = [
    photoHero({
        image: url(IMG.interior),
        alt: 'A styling station with soft natural light',
        title: 'Book your appointment',
        sub: 'Choose a service to see prices and live availability, then pick your stylist and time.',
        primary: { label: 'See services below', href: '/book' },
        overlay: 'darker',
        align: 'start',
    }),
];

const ABOUT = [
    splitFeature({
        image: url(IMG.hero),
        alt: 'A bright, calm salon interior in warm neutrals',
        heading: 'About Maison Élan',
        body: [
            'We opened Maison Élan to do hair the way we always wished it were done — slowly, thoughtfully, and with the same person who knows your hair.',
            'No upselling, no rushing, no leaving with a look you can’t recreate. Just considered cuts, soft color and a calm hour that’s genuinely yours.',
        ],
        cta: { label: 'Book a chair', href: '/book' },
    }),
    featureRow({
        surface: 'muted',
        heading: 'How we work',
        items: [
            { title: 'Consultation first', body: 'Every appointment starts with a real conversation about your hair, your routine and what you actually want.' },
            { title: 'Products we believe in', body: 'Gentle, salon-grade color and care — and honest advice on the short list of things worth taking home.' },
            { title: 'Yours to keep', body: 'We finish by showing you how to get the look again at home, so it works on a Tuesday, not just in the chair.' },
        ],
    }),
];

const CONTACT = [
    findUs({
        heading: 'Visit the studio',
        address: ['Maison Élan', '128 Linden Street', 'Suite 2 · Portland, OR 97205'],
        mapLocation: '128 Linden Street, Portland, OR 97205',
        hours: [
            { day: 'Tuesday – Friday', time: '9:00 – 7:00' },
            { day: 'Saturday', time: '9:00 – 6:00' },
            { day: 'Sunday', time: '10:00 – 4:00' },
            { day: 'Monday', time: 'Closed' },
        ],
    }),
    bookingCta({
        title: 'Rather book than call?',
        sub: 'See live availability and reserve your time online — no phone tag.',
        surface: 'muted',
        cta: { label: 'Book online', href: '/book' },
    }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
    key: 'sparx-salon-editorial',
    name: 'Salon (Editorial)',
    summary:
        'An upscale, editorial hair-salon site — a warm-ivory palette, a brass primary and a high-contrast serif display, with soft-lit photography carrying the page. Installs a working booking flow: a real service menu (cuts, color, balayage), three stylists you book by name with their own hours, and a color-deposit policy. Ships as "Maison Élan", a calm three-chair studio.',
    tagline: 'A warm, editorial template for hair salons — book online from day one.',
    industry: 'Hair salon',
    sortWeight: 90,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: { businessName: 'Maison Élan', tagline: 'Considered hair, calmly done.' },
    theme: maison,
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Maison Élan — an upscale hair salon',
            description:
                'Maison Élan is a calm three-chair salon for considered cuts, soft lived-in color and balayage. Book your stylist online.',
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
