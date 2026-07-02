// Careers content is data-as-code (docs convention): a small set of founding
// roles for WizeWorks LLC, edited here rather than in a DB (no editor yet).
// The apply flow reads `slug` + `title` from these objects.

export interface Role {
  /** URL slug — used in /careers/[slug] and stored on the application. */
  slug: string;
  /** Full role title, e.g. 'Founding Growth & Marketing Lead'. */
  title: string;
  /** Short team/area label, e.g. 'Growth'. */
  team: string;
  /** Location line, e.g. 'Remote (US) · Visalia HQ optional'. */
  location: string;
  /** One-line commitment tag, e.g. 'Founding role · equity + revenue share'. */
  commitment: string;
  /** Honest compensation line (equity + revenue share; no cash yet). */
  compensation: string;
  /** 1–2 sentence teaser shown on the index card. */
  summary: string;
  /** The "about this role" narrative — 2–3 short paragraphs. */
  aboutRole: string[];
  /** Bulleted "what you'll own". */
  whatYoullOwn: string[];
  /** Bulleted "what we're looking for". */
  whatWereLookingFor: string[];
  /** Optional bulleted "nice to have". */
  niceToHave?: string[];
  /** Whether the apply form should require a résumé PDF. */
  resumeRequired: boolean;
  /** For the open application only: the prompt shown for the free-text interest field. */
  interestPrompt?: string;
}

// Shared across every founding role — one honest deal, stated the same way each
// time so no listing reads softer than another.
const COMMITMENT = 'Founding role · equity + revenue share';
const COMPENSATION =
  'Founding equity + revenue share. No cash comp until we raise or revenue supports it — we mean that, and we say it up front.';
const LOCATION = 'Remote (US) · Visalia, CA HQ optional';

/** The real, listed founding roles (in display order). */
export const ROLES: Role[] = [
  {
    slug: 'founding-growth-marketing',
    title: 'Founding Growth & Marketing Lead',
    team: 'Growth',
    location: LOCATION,
    commitment: COMMITMENT,
    compensation: COMPENSATION,
    summary:
      'You own how sparx gets known — positioning, launch, content, and demand, from first impression to signed-up tenant.',
    aboutRole: [
      'We have a real product and almost no one knows it exists yet. Changing that is the job. You own the story — what sparx is, who it is for, and why it beats a stack of four tools and a Zapier bill — and you turn that story into a launch that lands.',
      'This is the first marketing hire, so there is no playbook to inherit and no brand police to clear things past. You set the positioning, pick the channels, write the words, and read the numbers. What works, you do more of. What does not, you kill the same week.',
      'You work directly with the founder on the decisions that matter, on a short feedback loop, with your name on the results. If you have been waiting for a place where marketing is owned instead of assigned, this is it.',
    ],
    whatYoullOwn: [
      'Positioning and messaging across sparx.works and the per-module marketing sites',
      'The public launch — sequencing, waitlist conversion, and the first thousand signups',
      'Content that ranks and converts: landing pages, comparison pages, SEO, and the copy people actually read',
      'Demand through channels that fit a pre-seed budget — organic, community, partnerships, paid only when the math works',
      'The numbers that decide everything: signups, activation, cost per tenant, and what each channel really returns',
    ],
    whatWereLookingFor: [
      'You have taken a product to market before, ideally technical or SaaS, and can point to numbers you moved',
      'You write your own copy and it is good — you do not hand a brief to an agency and wait',
      'You are comfortable owning positioning from a blank page, not just executing someone else’s brand',
      'You read data honestly and change your mind when it tells you to',
      'You want equity and ownership over a salary and a title — read the comp line, because we mean it',
    ],
    niceToHave: [
      'You have marketed to small businesses, creators, or developers',
      'Real SEO and technical-content chops',
      'You have been early at a startup and know what pre-seed actually feels like',
    ],
    resumeRequired: true,
  },
  {
    slug: 'founding-community-social',
    title: 'Founding Community & Social',
    team: 'Community',
    location: LOCATION,
    commitment: COMMITMENT,
    compensation: COMPENSATION,
    summary:
      'You are the voice of sparx in public — social, community, and the relationships with the makers and merchants who build on us.',
    aboutRole: [
      'sparx grows by word of mouth from people who trust us. You build that trust in public, every day, in the places our future tenants already spend their time.',
      'You run our social presence with an actual point of view, start and steward a community people want to be in, and turn quiet product updates into stories worth sharing. You are also the ear to the ground — what people love, what breaks, what they wish existed — and you carry it straight back to the team.',
      'This is founding work, so you build the accounts and the community from close to zero. That is the appeal: you define how sparx sounds and behaves in public before anyone else does.',
    ],
    whatYoullOwn: [
      'The sparx social presence across the platforms our audience uses — voice, cadence, and everything that ships',
      'A community our tenants and builders genuinely want to be part of, and the culture inside it',
      'Developer and merchant relations: onboarding early users, gathering feedback, and turning fans into advocates',
      'Storytelling — customer wins, build-in-public updates, and the behind-the-scenes of a small team shipping fast',
      'The loop from community back to product, so the roadmap reflects what people actually ask for',
    ],
    whatWereLookingFor: [
      'You have grown a real audience or community before — yours or a company’s — and can show it',
      'You write and post in a voice people remember, without leaning on hype or engagement bait',
      'You genuinely like talking to people all day and helping them, not just broadcasting at them',
      'You are organized enough to keep a content cadence and a community running solo',
      'You want ownership and equity over a salaried social-manager role — read the comp line',
    ],
    niceToHave: [
      'You have done developer relations or creator and merchant relations before',
      'Comfort on camera or with short-form video',
      'You already spend time where small businesses and builders hang out',
    ],
    resumeRequired: true,
  },
  {
    slug: 'founding-engineer',
    title: 'Founding Engineer',
    team: 'Engineering',
    location: LOCATION,
    commitment: COMMITMENT,
    compensation: COMPENSATION,
    summary:
      'You ship across the whole platform — full-stack and product-minded, owning features from schema to pixel.',
    aboutRole: [
      'sparx is a modular content and commerce OS — builder, commerce, CRM, CMS, email, B2B, and AI, on one data layer, one API, one bill. That is a lot of surface for a small team, which means you touch most of it.',
      'You own features end to end: the Postgres schema, the Fastify API, the Next.js dashboard, and the tenant-facing site. We care that it ships, that it is correct, and that the next person can maintain it. Multi-tenancy runs on Postgres row-level security, auth is self-hosted, and most side effects are event-driven — the codebase has opinions, and you will add your own.',
      'You work directly with the founder, pick up whole modules, and make calls that stick. If you want a narrow ticket queue, this is not the role. If you want range and ownership, it is exactly the role.',
    ],
    whatYoullOwn: [
      'Features end to end — data model, API, dashboard UI, and the tenant-facing result',
      'Whole modules over time, not slices of someone else’s design',
      'The conventions that keep a fast-moving codebase readable six months later',
      'Performance and correctness under real multi-tenant load, backed by row-level security',
      'The judgment calls: what to build now, what to defer, and what to cut',
    ],
    whatWereLookingFor: [
      'Strong full-stack TypeScript — at home in both React and a Node backend',
      'Experience with our stack or close neighbors: Next.js, React, Fastify or similar, Prisma, Postgres',
      'You ship — you would rather have something real in front of users than a perfect plan',
      'You write code other people can read and change without you in the room',
      'You want founding equity and range over a salaried IC seat at a bigger company — read the comp line',
    ],
    niceToHave: [
      'You have worked on multi-tenant SaaS, a platform, or infrastructure before',
      'Comfort with GKE and Kubernetes, Pub/Sub, or other event-driven systems',
      'Interest in MCP and building for AI as a first-class client, not a bolt-on',
    ],
    resumeRequired: true,
  },
];

/** The catch-all "introduce yourself" application. Not in ROLES; linked separately. */
export const OPEN_APPLICATION: Role = {
  slug: 'open-application',
  title: 'Open application',
  team: 'Open',
  location: LOCATION,
  commitment: COMMITMENT,
  compensation: COMPENSATION,
  summary:
    'You do not see your exact role, but you want to help build sparx. Tell us what you would own.',
  aboutRole: [
    'The roles above are where we feel the pain most, but they are not the whole company. If you are excellent at something sparx needs and you want in early, we want to hear from you.',
    'Design, support, operations, finance, or a skill we have not named yet — the door is open. The bar is the same as every founding role: you own an area, you are honest about what you can do, and you are here for a stake rather than a paycheck we cannot write yet.',
    'Tell us what you would take off the founder’s plate and why you are the person to do it. The more specific you are, the better this works for both of us.',
  ],
  whatYoullOwn: [
    'An area you define, and the results that come with it',
    'Whatever needs owning that a small founding team cannot cover yet',
    'The chance to shape a role before it has a job description',
  ],
  whatWereLookingFor: [
    'You are genuinely good at something sparx needs, and you can prove it',
    'You are specific about what you would own instead of asking us to find you a spot',
    'You are clear-eyed about the pre-seed, equity-first deal and still want in',
    'You do more than you are asked and do not wait to be told',
  ],
  resumeRequired: false,
  interestPrompt:
    'In a few sentences: what would you want to own at sparx, and why are you the person to own it? Point us to something you have built if you can.',
};

/** Resolve a role (real or open) by slug. */
export function getRole(slug: string): Role | undefined {
  if (slug === OPEN_APPLICATION.slug) return OPEN_APPLICATION;
  return ROLES.find((r) => r.slug === slug);
}

/** Page-level copy for the /careers index (the designer renders these). */
export const CAREERS_COPY = {
  /** Big page headline. */
  title: 'Build sparx with us',
  /** One-sentence subhead under the title. */
  subtitle:
    'Founding roles at WizeWorks LLC — equity and revenue share, remote-first, and honest about exactly where we are.',
  /** The honest pitch: 2–3 short paragraphs on who we are, that this is pre-seed/equity, why it's worth it. */
  pitch: [
    'sparx is a modular content and commerce OS, built by WizeWorks LLC. The product is real and shipping. The company is pre-seed and pre-revenue, which is to say early — early enough that these are founding roles, not jobs.',
    'Here is the honest part. We cannot pay a salary yet, and we will not pretend otherwise. Every role here is equity plus revenue share, with no cash comp until we raise or revenue supports it. If that is a dealbreaker, we understand, and you can stop reading. If it sounds like the bet you have been waiting to make, keep going.',
    'What you get instead of a paycheck: real ownership, a say in what we build, your fingerprints on the platform from the start, and a founder who tells you the truth. Small team, short feedback loops, work that is actually yours.',
  ],
  /** "How we hire" — 3–4 short, honest bullets (a real human reads every application; equity conversation is in writing; small team, slow-but-fair). */
  howWeHire: [
    'A real person — usually the founder — reads every application. No resume black hole, no bot screen.',
    'We move deliberately. Founding hires matter too much to rush, so expect a conversation, not a one-way interview.',
    'The equity and revenue-share conversation happens early and in writing — no vague promises, no handshake deals.',
    'We are straight about money, risk, and what we do not know yet, and we expect the same from you.',
  ],
  /** One-line honest note about WizeWorks LLC / equity being formalized in writing. */
  entityNote:
    'sparx is built by WizeWorks LLC. The founding equity and revenue-share structure is still being formalized — we work out the exact split together and put it in writing before you commit to anything.',
} as const;
