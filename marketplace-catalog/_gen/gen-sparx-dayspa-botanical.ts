// sparx-dayspa-botanical — "Verdure", a warm, botanical DAY SPA & wellness studio.
//
// The calm natural sanctuary of the design research (Bamford / Yasuragi lane): warm
// earth and eucalyptus, soft daylight, an unhurried pace — deliberately the ANTI-clinical
// spa. It leads with a low-contrast, softly-overlaid photograph and moves through calm,
// grounded beats rather than a features wall. Distinct from the two salons (brass/mauve,
// cut-and-color) and the barbershops (dark heritage): a different business on the same
// booking spine — massage, facials, body work and quiet time in the sauna.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-dayspa-botanical.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-dayspa-botanical/**" \
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
    hero: 'dayspa-botanical-hero',
    space: 'dayspa-botanical-space',
    sauna: 'dayspa-botanical-sauna',
    elena: 'dayspa-botanical-elena',
    marisol: 'dayspa-botanical-marisol',
    rowan: 'dayspa-botanical-rowan',
    work1: 'dayspa-botanical-work1',
    work2: 'dayspa-botanical-work2',
    work3: 'dayspa-botanical-work3',
} as const;

// A swap point: fill an entry to hot-link a specific photograph; anything unlisted falls
// back to a deterministic seeded placeholder, so every asset always resolves to a 200.
const PHOTO: Record<string, string> = {
    "verdure-hero": "https://images.unsplash.com/photo-1761470575018-135c213340eb?w=1600&q=80",
    "verdure-space": "https://images.unsplash.com/photo-1639162906614-0603b0ae95fd?w=1600&q=80",
    "verdure-sauna": "https://images.unsplash.com/photo-1757528649062-787b727bd3fc?w=1600&q=80",
    "verdure-elena": "https://images.unsplash.com/photo-1706795034830-de41aee06afa?w=1600&q=80",
    "verdure-marisol": "https://images.unsplash.com/photo-1700522924565-9fad1c05469e?w=1600&q=80",
    "verdure-rowan": "https://images.unsplash.com/photo-1709755491926-f7aa83748967?w=1600&q=80",
    "verdure-work1": "https://images.unsplash.com/photo-1722483173894-74b0de110e54?w=1600&q=80",
    "verdure-work2": "https://images.unsplash.com/photo-1757528649062-787b727bd3fc?w=1600&q=80",
    "verdure-work3": "https://images.unsplash.com/photo-1722483173646-f059bb161f54?w=1600&q=80",
};
const src = (seed: string): string =>
    PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}
const ASSETS: Asset[] = [
    { id: IMG.hero, url: src('verdure-hero'), alt: 'A calm treatment room in warm oat and eucalyptus, softly lit by daylight' },
    { id: IMG.space, url: src('verdure-space'), alt: 'A quiet spa lounge with linen, timber and potted greenery' },
    { id: IMG.sauna, url: src('verdure-sauna'), alt: 'A warm cedar sauna with soft light through the slats' },
    { id: IMG.elena, url: src('verdure-elena'), alt: 'Elena Vasquez, massage therapist' },
    { id: IMG.marisol, url: src('verdure-marisol'), alt: 'Marisol Reyes, facial and massage therapist' },
    { id: IMG.rowan, url: src('verdure-rowan'), alt: 'Rowan Ellis, bodywork therapist' },
    { id: IMG.work1, url: src('verdure-work1'), alt: 'Warm stones and eucalyptus laid out for a treatment' },
    { id: IMG.work2, url: src('verdure-work2'), alt: 'Botanical oils and a folded linen towel' },
    { id: IMG.work3, url: src('verdure-work3'), alt: 'A hand-poured candle beside dried botanicals' },
];
const url = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-dayspa-botanical: unknown asset "${id}"`);
    return a.url;
};

// ── Theme — "verdure": warm oat ground, eucalyptus primary, terracotta accent, soft serif ─
const verdure = defineTheme({
    name: 'verdure',
    type: { body: face('Nunito', 'sans-serif'), head: face('Fraunces', 'serif') },
    shape: { selector: '0.75rem', field: '0.5rem', box: '0.75rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(96% 0.02 85)', // warm oat / cream
            'oklch(93% 0.026 82)', // oat
            'oklch(88% 0.034 80)', // warm hairline
            'oklch(27% 0.02 55)', // warm charcoal-brown ink
        ],
        roles: {
            primary: 'oklch(42% 0.05 155)', // deep eucalyptus green
            secondary: 'oklch(40% 0.02 55)', // warm charcoal-brown
            accent: 'oklch(62% 0.1 45)', // terracotta / clay
            neutral: 'oklch(30% 0.015 55)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(21% 0.014 60)',
            'oklch(18% 0.014 60)',
            'oklch(15% 0.014 60)',
            'oklch(93% 0.015 85)',
        ],
        roles: {
            primary: 'oklch(72% 0.09 155)', // eucalyptus, lifted for a dark ground
            secondary: 'oklch(78% 0.02 60)',
            accent: 'oklch(72% 0.1 45)',
            neutral: 'oklch(80% 0.015 70)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Scheduling — the booking spine (policies, therapists + rooms + hours, the menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
    days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// Treatment rooms + the sauna are open through the business week; a therapist's own
// windows are what actually constrain a bookable slot.
const OPEN_WEEK = [...hours([2, 3, 4, 5, 6], 540, 1140), ...hours([0], 600, 1020)]; // Tue–Sat 9–7, Sun 10–5

const SCHEDULING = {
    policies: [
        {
            handle: 'spa-standard',
            name: 'Standard booking',
            depositType: 'none',
            cancellationWindowHours: 24,
            reminderOffsetsMin: [1440, 120],
            policyText:
                'Please give us at least 24 hours’ notice to change or cancel — it lets us offer the time to someone else. We’ll send a gentle reminder the day before and two hours ahead.',
        },
        {
            handle: 'spa-cancellation',
            name: 'Reserved-time cancellation',
            depositType: 'deposit',
            depositAmountCents: 4000,
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 120],
            policyText:
                'Longer and couples treatments hold a $40 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over — inside 48 hours the deposit covers the room we set aside for you.',
        },
    ],
    resources: [
        {
            handle: 'elena',
            name: 'Elena Vasquez',
            kind: 'staff',
            skillTags: ['massage', 'body'],
            windows: hours([2, 3, 4, 5, 6], 540, 1020), // Tue–Sat 9–5
        },
        {
            handle: 'marisol',
            name: 'Marisol Reyes',
            kind: 'staff',
            skillTags: ['massage', 'facial'],
            windows: [...hours([3, 4, 5, 6], 600, 1140), ...hours([0], 600, 1020)], // Wed–Sat 10–7, Sun 10–5
        },
        {
            handle: 'rowan',
            name: 'Rowan Ellis',
            kind: 'staff',
            skillTags: ['massage', 'body', 'facial'],
            windows: [...hours([2, 4, 5, 6], 660, 1140), ...hours([0], 600, 1020)], // Tue, Thu–Sat 11–7, Sun 10–5
        },
        {
            handle: 'room-1',
            name: 'Fern Room',
            kind: 'space',
            skillTags: ['treatment'],
            windows: OPEN_WEEK,
        },
        {
            handle: 'room-2',
            name: 'Willow Room',
            kind: 'space',
            skillTags: ['treatment'],
            windows: OPEN_WEEK,
        },
        {
            handle: 'room-3',
            name: 'Cedar Room',
            kind: 'space',
            skillTags: ['treatment'],
            windows: OPEN_WEEK,
        },
        {
            handle: 'sauna-suite',
            name: 'Cedar Sauna',
            kind: 'space',
            skillTags: ['sauna'],
            windows: OPEN_WEEK,
        },
    ],
    services: [
        {
            handle: 'swedish-60',
            name: 'Swedish massage · 60 min',
            description:
                'A slow, flowing full-body massage that eases tension and settles the nervous system. The one to book when you simply need to exhale.',
            durationMinutes: 60,
            priceCents: 11000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-standard',
        },
        {
            handle: 'swedish-90',
            name: 'Swedish massage · 90 min',
            description:
                'The full ninety minutes — unhurried, whole-body, with time to work slowly and finish gently. Deeply restorative.',
            durationMinutes: 90,
            priceCents: 15500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-standard',
        },
        {
            handle: 'deep-tissue',
            name: 'Deep-tissue massage',
            description:
                'Focused, firmer work through the shoulders, back and legs to release the knots that everyday life leaves behind.',
            durationMinutes: 60,
            priceCents: 12500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-standard',
        },
        {
            handle: 'hot-stone',
            name: 'Hot-stone massage',
            description:
                'Warm basalt stones melt into tired muscles as the massage works around them — grounding, comforting, quietly indulgent.',
            durationMinutes: 75,
            priceCents: 14500,
            bufferAfterMin: 20,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-standard',
        },
        {
            handle: 'aromatherapy-facial',
            name: 'Aromatherapy facial',
            description:
                'A calming facial with botanical oils and a long, mindful massage — skin left soft and glowing, shoulders left lighter.',
            durationMinutes: 60,
            priceCents: 12000,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['facial'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-standard',
        },
        {
            handle: 'body-scrub',
            name: 'Botanical body scrub',
            description:
                'A gentle salt-and-oil exfoliation that leaves skin smooth and renewed, finished with a light botanical hydration.',
            durationMinutes: 45,
            priceCents: 9500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['body'], count: 1 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-standard',
        },
        {
            handle: 'couples-massage',
            name: 'Couples massage',
            description:
                'Two therapists, one calm room, side by side — an unhurried ninety minutes to slow down together.',
            durationMinutes: 90,
            priceCents: 30000,
            bufferAfterMin: 20,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'therapist', kind: 'staff', skillTags: ['massage'], count: 2 },
                { role: 'room', kind: 'space', skillTags: ['treatment'], count: 1 },
            ],
            policyHandle: 'spa-cancellation',
        },
        {
            handle: 'sauna-session',
            name: 'Sauna session',
            description:
                'Forty-five quiet minutes in the cedar sauna to warm through and reset — book it on its own, or before a treatment.',
            durationMinutes: 45,
            priceCents: 4000,
            bufferAfterMin: 10,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'suite', kind: 'space', skillTags: ['sauna'], count: 1 }],
            policyHandle: 'spa-standard',
        },
    ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
    photoHero({
        image: url(IMG.hero),
        alt: 'A calm treatment room in warm oat and eucalyptus, softly lit by daylight',
        title: 'Come back to yourself',
        sub: 'A warm, unhurried sanctuary for restorative massage, botanical facials and quiet time in the sauna — the everyday, softened.',
        primary: { label: 'Book online', href: '/book' },
        secondary: { label: 'See treatments', href: '/book' },
        overlay: 'soft',
    }),
    featureRow({
        items: [
            {
                title: 'Unhurried by design',
                body: 'We leave real time between every appointment, so nothing is rushed. You arrive, you slow down, and the hour is genuinely yours.',
            },
            {
                title: 'Natural, botanical care',
                body: 'Plant-based oils, warm stones and salt — simple, honest ingredients chosen to soothe skin and settle the mind, never overwhelm it.',
            },
            {
                title: 'The same hands each visit',
                body: 'Book your therapist by name and see the same person each time — someone who learns your body and works to how it feels that day.',
            },
        ],
    }),
    serviceMenu({
        heading: 'The treatment menu',
        intro: 'A few of the things we do most. Full prices and live availability are on the booking page.',
        surface: 'muted',
        columns: 2,
        items: [
            { name: 'Swedish massage · 60 min', priceCents: 11000, durationMin: 60, desc: 'A slow, flowing full-body massage to help you exhale.' },
            { name: 'Deep-tissue massage', priceCents: 12500, durationMin: 60, desc: 'Firmer, focused work to release everyday tension.' },
            { name: 'Hot-stone massage', priceCents: 14500, durationMin: 75, desc: 'Warm basalt stones, grounding and comforting.' },
            { name: 'Aromatherapy facial', priceCents: 12000, durationMin: 60, desc: 'Botanical oils and a long, mindful facial massage.' },
            { name: 'Botanical body scrub', priceCents: 9500, durationMin: 45, desc: 'A gentle exfoliation that leaves skin renewed.' },
            { name: 'Couples massage', priceCents: 30000, durationMin: 90, desc: 'Two therapists, one calm room, side by side.' },
        ],
        cta: { label: 'See everything & book', href: '/book' },
    }),
    splitFeature({
        image: url(IMG.space),
        alt: 'A quiet spa lounge with linen, timber and potted greenery',
        heading: 'A garden sanctuary in the city',
        body: [
            'Verdure is a small studio built to feel like a long exhale — warm timber, soft linen, greenery in every corner and daylight that moves through the day. No harsh lights, no clinical hush, no clock you can hear.',
            'Come a little early. Sit with a cup of herbal tea, breathe out, and let the treatment start before it starts.',
        ],
        cta: { label: 'Book a treatment', href: '/book' },
    }),
    teamRow({
        heading: 'Your therapists',
        intro: 'Book by name — you’ll see the same person each time.',
        members: [
            { name: 'Elena Vasquez', role: 'Massage therapist', image: url(IMG.elena), alt: 'Elena Vasquez, massage therapist', bio: 'Swedish, deep-tissue and hot-stone. Elena founded Verdure and leads the studio.' },
            { name: 'Marisol Reyes', role: 'Facial & massage therapist', image: url(IMG.marisol), alt: 'Marisol Reyes, facial and massage therapist', bio: 'Botanical facials and gentle, restorative massage.' },
            { name: 'Rowan Ellis', role: 'Bodywork therapist', image: url(IMG.rowan), alt: 'Rowan Ellis, bodywork therapist', bio: 'Deep-tissue, body scrubs and the firmer, targeted work.' },
        ],
    }),
    galleryStrip({
        heading: 'A moment inside',
        surface: 'muted',
        columns: 3,
        images: [
            { src: url(IMG.work1), alt: 'Warm stones and eucalyptus laid out for a treatment' },
            { src: url(IMG.work2), alt: 'Botanical oils and a folded linen towel' },
            { src: url(IMG.work3), alt: 'A hand-poured candle beside dried botanicals' },
        ],
    }),
    testimonial({
        quote: 'I left feeling like I’d been away for a week. The calmest hour of my month, every month — I don’t know how they do it.',
        attribution: 'Dana, guest since 2024',
    }),
    bookingCta({
        title: 'Give yourself the hour',
        sub: 'Choose a treatment, pick your therapist and see live times. It takes about a minute.',
        cta: { label: 'Book online', href: '/book' },
    }),
];

const BOOK_INTRO = [
    photoHero({
        image: url(IMG.sauna),
        alt: 'A warm cedar sauna with soft light through the slats',
        title: 'Book your treatment',
        sub: 'Choose a treatment to see prices and live availability, then pick your therapist and a time that suits.',
        primary: { label: 'See treatments below', href: '/book' },
        overlay: 'darker',
        align: 'start',
    }),
];

const ABOUT = [
    splitFeature({
        image: url(IMG.hero),
        alt: 'A calm treatment room in warm oat and eucalyptus, softly lit by daylight',
        heading: 'About Verdure',
        body: [
            'We opened Verdure to make a place that feels the way a good treatment should — warm, quiet and completely unhurried. Somewhere you can put the day down at the door and pick it back up softer.',
            'No upselling, no rushing, no packages you didn’t ask for. Just honest, botanical care from therapists who love the work, in a room that lets you breathe.',
        ],
        cta: { label: 'Book a treatment', href: '/book' },
    }),
    featureRow({
        surface: 'muted',
        heading: 'How we work',
        items: [
            { title: 'We start by listening', body: 'Every treatment begins with a quiet check-in about how you’re feeling and where you’re holding tension, so the hour fits the day you’re actually having.' },
            { title: 'Ingredients we trust', body: 'Plant-based oils, warm stones and mineral salts — gentle, natural care, and honest advice on the short list of things worth taking home.' },
            { title: 'Calm that carries', body: 'We finish slowly and send you off with a little space, not a sales pitch — so the calm lasts past the front door.' },
        ],
    }),
];

const CONTACT = [
    findUs({
        heading: 'Visit the studio',
        address: ['Verdure', '46 Alder Lane', 'Portland, OR 97214'],
        mapLocation: '46 Alder Lane, Portland, OR 97214',
        hours: [
            { day: 'Tuesday – Saturday', time: '9:00 – 7:00' },
            { day: 'Sunday', time: '10:00 – 5:00' },
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
    key: 'sparx-dayspa-botanical',
    name: 'Day Spa (Botanical)',
    summary:
        'A warm, botanical day-spa site — an oat-and-cream palette, a deep eucalyptus primary and a soft serif, with unhurried, restorative copy and natural light carrying the page. Installs a working booking flow: a real treatment menu (Swedish, deep-tissue and hot-stone massage, aromatherapy facial, body scrub, couples massage and a sauna session), three therapists booked by name with their own hours, three treatment rooms, and a cancellation policy. Ships as "Verdure", a calm garden sanctuary.',
    tagline: 'A warm, botanical template for day spas — book online from day one.',
    industry: 'Day spa',
    sortWeight: 80,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: { businessName: 'Verdure', tagline: 'Restorative treatments, quietly done.' },
    theme: verdure,
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Verdure — a botanical day spa & wellness sanctuary',
            description:
                'Verdure is a calm day spa for restorative massage, botanical facials and quiet time in the sauna. Book your therapist and treatment online.',
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
