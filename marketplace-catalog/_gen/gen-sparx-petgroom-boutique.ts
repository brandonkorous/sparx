// sparx-petgroom-boutique — "The Groom Room", an UPSCALE, BOUTIQUE pet spa & grooming salon.
//
// The refined, low-key-luxury groomer of the design research: a warm ivory/greige ground,
// a deep-plum primary, a soft blush accent, an elegant serif display over a humanist sans,
// and calm, soft-lit photography. A quiet, gentle spa day for one pet at a time — never
// crated, hand-styled by master groomers in a private suite. Deliberately the OPPOSITE of
// the second groomer template (bright, playful, family "puppy party" energy): same booking
// spine, a different business, a visibly different palette AND structure.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-petgroom-boutique.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-petgroom-boutique/**" \
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
    hero: 'petgroom-boutique-hero',
    suite: 'petgroom-boutique-suite',
    eloise: 'petgroom-boutique-eloise',
    marcus: 'petgroom-boutique-marcus',
    priya: 'petgroom-boutique-priya',
} as const;

const PHOTO: Record<string, string> = {
    "groomroom-hero": "https://images.unsplash.com/photo-1611173622933-91942d394b04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwc3BhJTIwZ3Jvb21pbmd8ZW58MHwwfHx8MTc4NjM4NzUwNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "groomroom-suite": "https://images.unsplash.com/photo-1765100018948-24a80a072c21?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGV0JTIwZ3Jvb21pbmclMjBzYWxvbiUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzODc1MDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "groomroom-eloise": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMGVsZWdhbnR8ZW58MHwwfHx8MTc4NjM4NzUxMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "groomroom-marcus": "https://images.unsplash.com/photo-1676989880361-091e12efc056?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MHwwfHx8MTc4NjM4NzUxNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "groomroom-priya": "https://images.unsplash.com/photo-1758599543125-0a927f1d7a3b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwwfDB8fHwxNzg2Mzg3NTE3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
        url: src('groomroom-hero'),
        alt: 'A small dog resting calmly on a soft towel in a quiet, sunlit grooming suite',
    },
    {
        id: IMG.suite,
        url: src('groomroom-suite'),
        alt: 'A serene private grooming suite with a single table and soft daylight',
    },
    {
        id: IMG.eloise,
        url: src('groomroom-eloise'),
        alt: 'Eloise Fairbanks, master groomer and founder',
    },
    {
        id: IMG.marcus,
        url: src('groomroom-marcus'),
        alt: 'Marcus Devlin, master groomer and cat specialist',
    },
    {
        id: IMG.priya,
        url: src('groomroom-priya'),
        alt: 'Priya Anand, master groomer and spa specialist',
    },
];
const url = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-petgroom-boutique: unknown asset "${id}"`);
    return a.url;
};

// ── Theme — "groomroom": ivory/greige ground, deep-plum primary, blush accent, gold second, serif display ─
const groomroom = defineTheme({
    name: 'groomroom',
    type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
    shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(97% 0.006 90)', // warm ivory
            'oklch(93% 0.009 85)', // greige
            'oklch(88% 0.012 82)', // hairline
            'oklch(24% 0.03 330)', // deep-plum ink
        ],
        roles: {
            primary: 'oklch(38% 0.09 330)', // deep plum
            secondary: 'oklch(42% 0.05 80)', // dark antique bronze — readable ink for micro-labels
            accent: 'oklch(78% 0.05 20)', // soft blush
            neutral: 'oklch(28% 0.02 330)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(20% 0.025 330)',
            'oklch(16% 0.02 330)',
            'oklch(13% 0.016 330)',
            'oklch(95% 0.006 90)',
        ],
        roles: {
            primary: 'oklch(66% 0.11 330)', // lifted plum
            secondary: 'oklch(80% 0.08 82)', // warm gold
            accent: 'oklch(82% 0.06 20)', // blush
            neutral: 'oklch(84% 0.02 330)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Scheduling — the booking spine (policies, groomers + suites + hours, the spa menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
    days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
    policies: [
        {
            handle: 'boutique-standard',
            name: 'Standard booking',
            depositType: 'none',
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 120],
            policyText:
                'We groom one pet at a time, so we ask for at least 48 hours’ notice to change or cancel. We send a reminder two days ahead, the day before, and two hours before your visit.',
        },
        {
            handle: 'signature-deposit',
            name: 'Signature deposit',
            depositType: 'deposit',
            depositAmountCents: 2500,
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 120],
            policyText:
                'Our longer signature and styling visits hold a $25 deposit that comes off your total. Reschedule with 48 hours’ notice and it carries over to your next appointment.',
        },
    ],
    resources: [
        {
            handle: 'eloise',
            name: 'Eloise Fairbanks',
            kind: 'staff',
            skillTags: ['signature', 'breed-styling', 'hand-strip', 'spa-addons'],
            windows: hours([2, 3, 4, 5], 540, 1020), // Tue–Fri 9–5
        },
        {
            handle: 'marcus',
            name: 'Marcus Devlin',
            kind: 'staff',
            skillTags: ['signature', 'cat', 'de-shed', 'spa-addons'],
            windows: hours([3, 4, 5, 6], 570, 1050), // Wed–Sat 9:30–5:30
        },
        {
            handle: 'priya',
            name: 'Priya Anand',
            kind: 'staff',
            skillTags: ['signature', 'spa-addons', 'breed-styling', 'de-shed'],
            windows: hours([2, 4, 5, 6], 600, 1080), // Tue, Thu–Sat 10–6
        },
        {
            handle: 'suite-willow',
            name: 'Willow Suite',
            kind: 'space',
            skillTags: ['suite'],
            windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
        },
        {
            handle: 'suite-quiet',
            name: 'Quiet Room (Cat Suite)',
            kind: 'space',
            skillTags: ['cat-suite', 'suite'],
            windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
        },
    ],
    services: [
        {
            handle: 'meet-consult',
            name: 'Meet & greet consultation',
            description:
                'A calm first visit — we meet your pet, talk through coat, temperament and the look you love, and plan the perfect groom. Booked before your first signature visit.',
            durationMinutes: 30,
            priceCents: 0,
            requiresApproval: true,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['signature'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
            ],
            policyHandle: 'boutique-standard',
        },
        {
            handle: 'signature-spa-groom',
            name: 'Signature spa groom',
            description:
                'Our full experience: a gentle warm bath, hand-fluff dry, breed-appropriate finish, nails, ears and a spritz of light cologne — never crated, never rushed.',
            durationMinutes: 120,
            priceCents: 11500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['signature'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
            ],
            policyHandle: 'signature-deposit',
        },
        {
            handle: 'breed-hand-style',
            name: 'Breed-specific hand styling',
            description:
                'Scissored and hand-finished to your breed’s standard — poodle, doodle, terrier, spaniel and more. A master groomer shapes every line by hand.',
            durationMinutes: 150,
            priceCents: 15500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['breed-styling'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
            ],
            policyHandle: 'signature-deposit',
        },
        {
            handle: 'hand-strip',
            name: 'Hand-stripping (wire coats)',
            description:
                'Traditional hand-stripping for wire-coated breeds — pulling, not clipping, to keep color and texture true. Patient, careful, and kind to the coat.',
            durationMinutes: 150,
            priceCents: 16500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['hand-strip'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
            ],
            policyHandle: 'signature-deposit',
        },
        {
            handle: 'spa-refresh',
            name: 'Spa refresh & tidy',
            description:
                'A between-grooms freshen-up — bath, blow-out, sanitary trim, paws and a face tidy. In and out feeling soft and clean.',
            durationMinutes: 75,
            priceCents: 7500,
            assignmentStrategy: 'any_available',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['signature'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
            ],
            policyHandle: 'boutique-standard',
        },
        {
            handle: 'spa-addons',
            name: 'Spa add-on ritual',
            description:
                'Add the extras: a blueberry facial, a soothing pawdicure, and a deep coat-conditioning mask. The little luxuries that leave them glossy and calm.',
            durationMinutes: 60,
            priceCents: 5500,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['spa-addons'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['suite'], count: 1 },
            ],
            policyHandle: 'boutique-standard',
        },
        {
            handle: 'cat-spa-groom',
            name: 'Cat spa groom',
            description:
                'A gentle, unhurried groom for cats in our quiet room away from the dogs — bath, de-shed or lion trim, nails and ears, handled with a soft touch.',
            durationMinutes: 90,
            priceCents: 9500,
            bufferAfterMin: 15,
            assignmentStrategy: 'customer_choice',
            resourceRequirements: [
                { role: 'groomer', kind: 'staff', skillTags: ['cat'], count: 1 },
                { role: 'suite', kind: 'space', skillTags: ['cat-suite'], count: 1 },
            ],
            policyHandle: 'signature-deposit',
        },
    ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
    photoHero({
        image: url(IMG.hero),
        alt: 'A small dog resting calmly on a soft towel in a quiet, sunlit grooming suite',
        title: 'A quiet, gentle spa day for your best friend',
        sub: 'A boutique grooming salon where your pet is the only one in the room — hand-styled by master groomers, never crated, never hurried.',
        primary: { label: 'Book online', href: '/book' },
        secondary: { label: 'See the spa menu', href: '/book' },
        overlay: 'soft',
    }),
    splitFeature({
        image: url(IMG.suite),
        alt: 'A serene private grooming suite with a single table and soft daylight',
        heading: 'One pet at a time, start to finish',
        body: [
            'The Groom Room isn’t a busy shop with a wall of cages. Each pet has a private suite and a single master groomer for the whole visit — bath, style and finish, all by the same gentle pair of hands.',
            'No kennels between steps, no waiting in a crate to dry. Just a calm, unhurried hour that most pets — and their people — genuinely look forward to.',
        ],
        cta: { label: 'Book a suite', href: '/book' },
    }),
    serviceMenu({
        heading: 'The spa menu',
        intro: 'A few of our most-loved visits. Full prices and live availability are on the booking page.',
        surface: 'muted',
        columns: 2,
        items: [
            {
                name: 'Signature spa groom',
                priceCents: 11500,
                durationMin: 120,
                desc: 'Warm bath, hand-fluff dry, breed finish, nails and ears.',
            },
            {
                name: 'Breed-specific hand styling',
                priceCents: 15500,
                durationMin: 150,
                desc: 'Scissored and hand-finished to your breed’s standard.',
            },
            {
                name: 'Spa add-on ritual',
                priceCents: 5500,
                durationMin: 60,
                desc: 'Blueberry facial, pawdicure and a conditioning mask.',
            },
            {
                name: 'Cat spa groom',
                priceCents: 9500,
                durationMin: 90,
                desc: 'A gentle groom in our quiet room, away from the dogs.',
            },
        ],
        cta: { label: 'See everything & book', href: '/book' },
    }),
    featureRow({
        heading: 'Why they leave calmer than they arrived',
        items: [
            {
                title: 'One pet at a time',
                body: 'Your pet is the only one being groomed in their suite — no chaos, no barking crowd, no crate between the bath and the blow-dry.',
            },
            {
                title: 'Master groomers only',
                body: 'Every groom is done by a certified master groomer who reads your pet’s comfort and shapes every line by hand.',
            },
            {
                title: 'Premium, gentle products',
                body: 'Sulphate-free, skin-kind shampoos and conditioners chosen for sensitive coats — nothing harsh, nothing rushed.',
            },
            {
                title: 'A calm, private suite',
                body: 'Soft light, quiet music and low-stress handling. We move at your pet’s pace, not a conveyor belt’s.',
            },
        ],
    }),
    teamRow({
        heading: 'Meet your master groomers',
        intro: 'Book by name — you’ll see the same trusted groomer each visit.',
        members: [
            {
                name: 'Eloise Fairbanks',
                role: 'Master groomer · Founder',
                image: url(IMG.eloise),
                alt: 'Eloise Fairbanks, master groomer and founder',
                bio: 'Twenty years of breed styling and hand-stripping. Eloise opened The Groom Room to slow grooming down.',
            },
            {
                name: 'Marcus Devlin',
                role: 'Master groomer · Cat specialist',
                image: url(IMG.marcus),
                alt: 'Marcus Devlin, master groomer and cat specialist',
                bio: 'Our quiet-room cat expert and de-shed specialist — endlessly patient with the nervous ones.',
            },
            {
                name: 'Priya Anand',
                role: 'Master groomer · Spa specialist',
                image: url(IMG.priya),
                alt: 'Priya Anand, master groomer and spa specialist',
                bio: 'Spa rituals, facials and finishing. Priya’s grooms leave every coat glossy and soft.',
            },
        ],
    }),
    testimonial({
        quote:
            'My anxious rescue used to shake at the groomer. Here he naps on the table. Same person every time, one dog in the room — it changed everything for him.',
        attribution: 'Hannah & Biscuit, clients since 2024',
        surface: 'muted',
    }),
    bookingCta({
        title: 'Reserve a quiet hour for your pet',
        sub: 'Choose a service, pick your master groomer, and see live availability. It takes about a minute.',
        cta: { label: 'Book online', href: '/book' },
    }),
];

const BOOK_INTRO = [
    photoHero({
        image: url(IMG.suite),
        alt: 'A serene private grooming suite with a single table and soft daylight',
        title: 'Book your pet’s spa visit',
        sub: 'Choose a service to see prices and live availability, then pick your master groomer and a time that suits.',
        primary: { label: 'See services below', href: '/book' },
        overlay: 'darker',
        align: 'start',
    }),
];

const ABOUT = [
    splitFeature({
        image: url(IMG.hero),
        alt: 'A small dog resting calmly on a soft towel in a quiet, sunlit grooming suite',
        heading: 'About The Groom Room',
        body: [
            'We opened The Groom Room because grooming had become a production line — cages, clippers and a queue. We wanted the opposite: a calm, private, one-pet-at-a-time salon where a groom feels like a spa day, not an ordeal.',
            'Every visit is handled start to finish by one master groomer in a private suite, with gentle products and all the time your pet needs. No crates, no rush, no stress — just a beautiful, comfortable groom.',
        ],
        cta: { label: 'Book a visit', href: '/book' },
    }),
    featureRow({
        surface: 'muted',
        heading: 'How we care for your pet',
        items: [
            {
                title: 'A consultation first',
                body: 'Before any signature groom we meet your pet, learn their coat and temperament, and agree the look together — no surprises.',
            },
            {
                title: 'Low-stress handling',
                body: 'We work at your pet’s pace with calm, force-free handling, and we stop for breaks whenever they need one.',
            },
            {
                title: 'Honest, gentle aftercare',
                body: 'You leave with simple advice on coat care between visits, and a groomer who remembers your pet next time.',
            },
        ],
    }),
];

const CONTACT = [
    findUs({
        heading: 'Visit the salon',
        address: ['The Groom Room', '46 Marigold Lane', 'Suite 1 · Asheville, NC 28801'],
        mapLocation: '46 Marigold Lane, Asheville, NC 28801',
        hours: [
            { day: 'Tuesday – Friday', time: '9:00 – 6:00' },
            { day: 'Saturday', time: '9:00 – 5:00' },
            { day: 'Sunday – Monday', time: 'Closed' },
        ],
    }),
    bookingCta({
        title: 'Rather book than call?',
        sub: 'See live availability and reserve your pet’s suite online — no phone tag.',
        surface: 'muted',
        cta: { label: 'Book online', href: '/book' },
    }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
    key: 'sparx-petgroom-boutique',
    name: 'Pet Grooming (Boutique)',
    summary:
        'An upscale, boutique pet-spa site — a warm ivory ground, a deep-plum primary and a blush accent, with an elegant serif display and calm photography. Installs a working booking flow: a real spa menu (signature groom, breed hand styling, spa add-ons, cat grooming), three master groomers you book by name, two private suites as bookable rooms, and a deposit policy. Ships as "The Groom Room".',
    tagline: 'A refined, boutique template for pet groomers — book online from day one.',
    industry: 'Pet grooming',
    sortWeight: 79,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: { businessName: 'The Groom Room', tagline: 'A quiet, gentle spa day for your best friend.' },
    theme: groomroom,
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'The Groom Room — a boutique pet spa & grooming salon',
            description:
                'The Groom Room is a calm, one-pet-at-a-time grooming salon: signature spa grooms, breed hand styling, spa add-ons and gentle cat grooming by master groomers. Book online.',
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
