// sparx-tattoo-dark — "Ironwood Tattoo", a DARK, gallery-first tattoo studio.
//
// The low-lit, hand-made, rebellious-but-refined studio of the design research
// (the blackwork / fine-line / traditional lane): a warm ink-black ground in BOTH
// modes, bone-cream ink at high contrast, one old-gold primary and an oxblood
// accent, a condensed gothic display over a workhorse sans — and real ink
// photography carrying the page. Deliberately the OPPOSITE of the bright editorial
// salon (warm-ivory, brass, serif): craft over comfort, the work on a dark wall.
// Same booking spine, a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the
// shared service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-tattoo-dark.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-tattoo-dark/**" \
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
    teamRow,
    testimonial,
    type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
    hero: 'tattoo-dark-hero',
    studio: 'tattoo-dark-studio',
    silas: 'tattoo-dark-silas',
    del: 'tattoo-dark-del',
    june: 'tattoo-dark-june',
    work1: 'tattoo-dark-work1',
    work2: 'tattoo-dark-work2',
    work3: 'tattoo-dark-work3',
    work4: 'tattoo-dark-work4',
} as const;

const PHOTO: Record<string, string> = {
    "ironwood-hero": "https://images.unsplash.com/photo-1608666599953-b951163495f4?w=1600&q=80",
    "ironwood-studio": "https://images.unsplash.com/photo-1605647533135-51b5906087d0?w=1600&q=80",
    "ironwood-silas": "https://images.unsplash.com/photo-1595747644932-abb68f85f419?w=1600&q=80",
    "ironwood-del": "https://images.unsplash.com/photo-1561432868-931a1373efa7?w=1600&q=80",
    "ironwood-june": "https://images.unsplash.com/photo-1542744383-8c330d91f4b1?w=1600&q=80",
    "ironwood-work1": "https://images.unsplash.com/photo-1758404255679-9afd847ede1c?w=1600&q=80",
    "ironwood-work2": "https://images.unsplash.com/photo-1583213261205-63258746ed4c?w=1600&q=80",
    "ironwood-work3": "https://images.unsplash.com/photo-1557130641-1b14718f096a?w=1600&q=80",
    "ironwood-work4": "https://images.unsplash.com/photo-1758404255679-9afd847ede1c?w=1600&q=80",
};
const src = (seed: string): string =>
    PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}
const ASSETS: Asset[] = [
    { id: IMG.hero, url: src('ironwood-hero'), alt: 'A dimly lit tattoo studio with a single artist at work' },
    { id: IMG.studio, url: src('ironwood-studio'), alt: 'A private tattoo station under a warm work lamp' },
    { id: IMG.silas, url: src('ironwood-silas'), alt: 'Silas Roan, blackwork and traditional artist' },
    { id: IMG.del, url: src('ironwood-del'), alt: 'Del Marrow, fine-line and color artist' },
    { id: IMG.june, url: src('ironwood-june'), alt: 'June Okonkwo, realism and blackwork artist' },
    { id: IMG.work1, url: src('ironwood-work1'), alt: 'A bold blackwork sleeve, freshly finished' },
    { id: IMG.work2, url: src('ironwood-work2'), alt: 'A fine-line botanical piece on a forearm' },
    { id: IMG.work3, url: src('ironwood-work3'), alt: 'A traditional bold-line design in heavy black' },
    { id: IMG.work4, url: src('ironwood-work4'), alt: 'A detailed black-and-grey realism portrait' },
];
const url = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-tattoo-dark: unknown asset "${id}"`);
    return a.url;
};

// ── Theme — "ironwood": warm ink-black ground in BOTH modes, bone ink, old-gold
// primary + oxblood accent, a condensed gothic display over a workhorse sans. A
// dark-ground theme, so it takes the BRIGHT status set in both modes (the deep set
// would vanish on a 14% surface). ─────────────────────────────────────────────────
const ironwood = defineTheme({
    name: 'ironwood',
    type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
    shape: { selector: '0.125rem', field: '0.125rem', box: '0.125rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(14% 0.006 60)', // warm ink-black — the page, NOT pure black
            'oklch(18% 0.008 60)', // a lifted muted band
            'oklch(26% 0.01 60)', // hairline / border, visible on the dark ground
            'oklch(92% 0.012 85)', // bone-cream ink
        ],
        roles: {
            primary: 'oklch(76% 0.12 88)', // old gold
            secondary: 'oklch(74% 0.025 70)', // warm bone-grey
            accent: 'oklch(46% 0.16 25)', // oxblood
            neutral: 'oklch(30% 0.01 60)',
            ...STATUS_ON_DARK,
        },
    },
    dark: {
        surfaces: [
            'oklch(12% 0.006 60)',
            'oklch(16% 0.008 60)',
            'oklch(24% 0.01 60)',
            'oklch(93% 0.01 85)',
        ],
        roles: {
            primary: 'oklch(78% 0.12 88)',
            secondary: 'oklch(76% 0.025 70)',
            accent: 'oklch(50% 0.16 25)',
            neutral: 'oklch(28% 0.01 60)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Scheduling — the booking spine (policies, artists + hours, the studio menu) ──────
// Studios open late: minutes from midnight, 12:00 = 720 through 20:00 = 1200.
const hours = (days: number[], startMinute: number, endMinute: number) =>
    days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
    policies: [
        {
            handle: 'session-deposit',
            name: 'Session deposit',
            depositType: 'deposit',
            depositAmountCents: 5000,
            cancellationWindowHours: 72,
            reminderOffsetsMin: [4320, 1440, 120],
            policyText:
                'Every session holds a $50 deposit that comes off your final total. Reschedule with at least 72 hours’ notice and it carries over; inside that window the deposit covers the reserved chair.',
        },
        {
            handle: 'consultation-free',
            name: 'Free consultation',
            depositType: 'none',
            cancellationWindowHours: 24,
            reminderOffsetsMin: [1440, 120],
            policyText:
                'Consultations are free and take about half an hour. Give us a day’s notice if you need to move it — no charge either way.',
        },
    ],
    resources: [
        {
            handle: 'silas',
            name: 'Silas Roan',
            kind: 'staff',
            skillTags: ['blackwork', 'traditional', 'realism'],
            windows: hours([3, 4, 5, 6, 0], 720, 1200), // Wed–Sun 12–8
        },
        {
            handle: 'del',
            name: 'Del Marrow',
            kind: 'staff',
            skillTags: ['fineline', 'color', 'traditional'],
            windows: hours([2, 3, 4, 5, 6], 780, 1260), // Tue–Sat 1–9
        },
        {
            handle: 'june',
            name: 'June Okonkwo',
            kind: 'staff',
            skillTags: ['realism', 'color', 'blackwork'],
            windows: hours([2, 4, 5, 6, 0], 720, 1200), // Tue, Thu–Sun 12–8
        },
    ],
    services: [
        {
            handle: 'consultation',
            name: 'Consultation',
            description:
                'Free and unhurried. Bring references and your idea; we’ll talk placement, size, style and price, and plan the piece together before anything is booked.',
            durationMinutes: 30,
            priceCents: 0,
            requiresApproval: true,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['blackwork'], count: 1 }],
            policyHandle: 'consultation-free',
        },
        {
            handle: 'small-tattoo',
            name: 'Small tattoo',
            description: 'A single, self-contained piece — up to palm-sized. Design, stencil and tattoo in one sitting.',
            durationMinutes: 120,
            priceCents: 18000,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['traditional'], count: 1 }],
            policyHandle: 'session-deposit',
        },
        {
            handle: 'half-day-session',
            name: 'Half-day session',
            description: 'A four-hour block for a larger piece or the first pass of a bigger project.',
            durationMinutes: 240,
            priceCents: 48000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['blackwork'], count: 1 }],
            policyHandle: 'session-deposit',
        },
        {
            handle: 'full-day-session',
            name: 'Full-day session',
            description: 'A seven-hour sitting for major work — sleeves, back pieces and full custom builds, with breaks.',
            durationMinutes: 420,
            priceCents: 84000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['realism'], count: 1 }],
            policyHandle: 'session-deposit',
        },
        {
            handle: 'fine-line-piece',
            name: 'Fine-line piece',
            description: 'Delicate single-needle work — script, botanicals and small, precise line designs.',
            durationMinutes: 180,
            priceCents: 32000,
            bufferAfterMin: 10,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['fineline'], count: 1 }],
            policyHandle: 'session-deposit',
        },
        {
            handle: 'cover-up-consultation',
            name: 'Cover-up consultation',
            description:
                'A longer sit-down for reworking or covering existing ink. We assess what’s there and map out a design that lives on top of it — booked with approval first.',
            durationMinutes: 45,
            priceCents: 0,
            requiresApproval: true,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [{ role: 'artist', kind: 'staff', skillTags: ['blackwork'], count: 1 }],
            policyHandle: 'consultation-free',
        },
    ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
    photoHero({
        image: url(IMG.hero),
        alt: 'A dimly lit tattoo studio with a single artist at work',
        title: 'Custom work, made to last',
        sub: 'A dark studio for considered, hand-drawn tattoos — blackwork, fine-line, traditional and realism. Every piece starts as a conversation, never a flash sheet.',
        primary: { label: 'Book a consult', href: '/book' },
        secondary: { label: 'See the work', href: '/book' },
        overlay: 'darker',
    }),
    featureRow({
        items: [
            {
                title: 'Custom, not off the wall',
                body: 'Nothing here is copy-and-paste. Your artist draws the piece for you, for your body, and refines it with you before a needle touches skin.',
            },
            {
                title: 'Consultation first, always',
                body: 'Big or small, every tattoo begins with a free sit-down. We plan placement, size and price up front, so the day of is calm and certain.',
            },
            {
                title: 'Sterile, licensed, exacting',
                body: 'Single-use needles, hospital-grade sterilisation and licensed artists. The craft is loud; the hygiene is quiet and non-negotiable.',
            },
        ],
    }),
    serviceMenu({
        heading: 'What we do',
        intro: 'Sessions are priced by the time your piece takes. Consultations are free — start there, and we’ll size the rest together. Live availability is on the booking page.',
        surface: 'muted',
        columns: 2,
        items: [
            { name: 'Small tattoo', priceCents: 18000, durationMin: 120, desc: 'A single, self-contained piece in one sitting.' },
            { name: 'Fine-line piece', priceCents: 32000, durationMin: 180, desc: 'Delicate single-needle script and botanicals.' },
            { name: 'Half-day session', priceCents: 48000, durationMin: 240, desc: 'A four-hour block for larger work.' },
            { name: 'Full-day session', priceCents: 84000, durationMin: 420, desc: 'A seven-hour sitting for major pieces.' },
        ],
        cta: { label: 'See everything & book', href: '/book' },
    }),
    splitFeature({
        image: url(IMG.studio),
        alt: 'A private tattoo station under a warm work lamp',
        heading: 'A room built for the work',
        body: [
            'Ironwood is a private, low-lit studio — three chairs, no walk-in churn, no music you have to shout over. Just focused artists and the time a good tattoo actually needs.',
            'We’d rather do fewer pieces properly than rush a room full. That is the whole idea: craft over comfort, and ink you’ll still be glad you got in twenty years.',
        ],
        cta: { label: 'Book your chair', href: '/book' },
    }),
    teamRow({
        heading: 'The artists',
        intro: 'Book by name — each artist owns their style, and you sit with the same one from consult to final pass.',
        members: [
            {
                name: 'Silas Roan',
                role: 'Blackwork & traditional',
                image: url(IMG.silas),
                alt: 'Silas Roan, blackwork and traditional artist',
                bio: 'Heavy black, bold lines and old-school traditional. Silas runs the studio.',
            },
            {
                name: 'Del Marrow',
                role: 'Fine-line & color',
                image: url(IMG.del),
                alt: 'Del Marrow, fine-line and color artist',
                bio: 'Single-needle script, botanicals and quiet, precise color.',
            },
            {
                name: 'June Okonkwo',
                role: 'Realism & blackwork',
                image: url(IMG.june),
                alt: 'June Okonkwo, realism and blackwork artist',
                bio: 'Black-and-grey realism and large-scale custom builds.',
            },
        ],
    }),
    galleryStrip({
        heading: 'Recent work',
        columns: 4,
        images: [
            { src: url(IMG.work1), alt: 'A bold blackwork sleeve, freshly finished' },
            { src: url(IMG.work2), alt: 'A fine-line botanical piece on a forearm' },
            { src: url(IMG.work3), alt: 'A traditional bold-line design in heavy black' },
            { src: url(IMG.work4), alt: 'A detailed black-and-grey realism portrait' },
        ],
    }),
    testimonial({
        quote: 'They talked me out of the rushed idea I walked in with and drew something far better. Cleanest studio I’ve been in, and the piece still looks sharp two years on.',
        attribution: 'Marco, client since 2024',
        surface: 'muted',
    }),
    bookingCta({
        title: 'Bring us your idea',
        sub: 'Start with a free consultation. Pick your artist, choose a time, and we’ll plan the piece together.',
        cta: { label: 'Book a consult', href: '/book' },
    }),
];

const BOOK_INTRO = [
    photoHero({
        image: url(IMG.studio),
        alt: 'A private tattoo station under a warm work lamp',
        title: 'Book your session',
        sub: 'Start with a free consultation, or book a session if you’ve already planned your piece with us. Choose a service to see live availability and your artist’s open times.',
        primary: { label: 'See services below', href: '/book' },
        overlay: 'darker',
        align: 'start',
    }),
];

const ABOUT = [
    splitFeature({
        image: url(IMG.hero),
        alt: 'A dimly lit tattoo studio with a single artist at work',
        heading: 'About Ironwood Tattoo',
        body: [
            'We opened Ironwood to tattoo the way we always wanted to be tattooed — slowly, custom, and by the same artist from the first sketch to the last line.',
            'No flash-sheet churn, no rush, no leaving with something you settled for. Just hand-drawn work, an honest plan, and a studio that takes hygiene as seriously as the art.',
        ],
        cta: { label: 'Book a consult', href: '/book' },
    }),
    featureRow({
        surface: 'muted',
        heading: 'How we work',
        items: [
            {
                title: 'Consultation first',
                body: 'Every piece starts with a free sit-down about your idea, your body and your budget — before we book anything.',
            },
            {
                title: 'A deposit that holds your chair',
                body: 'Sessions carry a $50 deposit that comes off your total and reserves the artist’s time. Reschedule with 72 hours’ notice and it carries over.',
            },
            {
                title: 'Yours for life',
                body: 'We tattoo to last and send you home knowing exactly how to heal it — so the piece looks as good on year ten as on day one.',
            },
        ],
    }),
];

const CONTACT = [
    findUs({
        heading: 'Find the studio',
        address: ['Ironwood Tattoo', '212 Foundry Row', 'Unit 4 · Portland, OR 97214'],
        mapLocation: '212 Foundry Row, Portland, OR 97214',
        hours: [
            { day: 'Tuesday – Saturday', time: '12:00 – 8:00' },
            { day: 'Sunday', time: '12:00 – 8:00' },
            { day: 'Monday', time: 'Closed' },
        ],
    }),
    bookingCta({
        title: 'Rather book than call?',
        sub: 'See live availability and reserve a consult or session online — no phone tag.',
        surface: 'muted',
        cta: { label: 'Book online', href: '/book' },
    }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
    key: 'sparx-tattoo-dark',
    name: 'Tattoo (Dark Studio)',
    summary:
        'A dark, gallery-first tattoo-studio site — a warm ink-black palette in both modes, an old-gold primary over an oxblood accent, a condensed gothic display, and real ink photography carrying the page. Installs a working booking flow: a free consultation, priced session tiers (small, fine-line, half-day, full-day), three artists you book by name with their own late hours, and a $50 session-deposit policy. Ships as "Ironwood Tattoo", a private three-chair studio.',
    tagline: 'A dark, gallery-first template for tattoo studios — book a consult from day one.',
    industry: 'Tattoo studio',
    sortWeight: 86,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: { businessName: 'Ironwood Tattoo', tagline: 'Custom work, made to last.' },
    theme: ironwood,
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Ironwood Tattoo — a custom tattoo studio',
            description:
                'Ironwood Tattoo is a private, dark studio for custom blackwork, fine-line, traditional and realism. Book a free consultation with your artist online.',
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
