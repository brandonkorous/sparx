import type { ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { Display, Dot, getModuleColor, Section, SectionHeader, Spark } from './primitives';
import { Faq, type FaqItem } from './faq';
import { signupHref } from './cta';

/**
 * The /social marketing page — Social is the platform's **reach**: one post,
 * composed once from the products and media a tenant already has, fanned out to
 * Facebook, Instagram, and Pinterest in the exact shape each network wants, on
 * the schedule the tenant sets, and held for approval before it touches a live
 * account. The thesis traces one post through the system: compose → auto-crop
 * per platform → approve → schedule → publish everywhere.
 *
 * Bespoke + full-length, modeled on email-page / commerce-page. Social blue is a
 * *signal* (the spark, the primary action, the network dots) — never flood fill;
 * the external networks are rendered as neutral chrome, never their brand hexes.
 *
 * Facts are grounded in docs/133 (Social Media Posting): organic posting is a
 * FREE, independently-gated module for every tenant (a CMS-only publisher, a
 * shop, a CRM team all equally). One upload derives per-platform aspect
 * renditions via an attention-aware crop with a draggable focal point;
 * require-approval is the default with a per-post override and approving is a
 * staff permission; scheduling and publish run the same lifecycle as the rest of
 * the platform. Paid ads are a separate future module — organic stays free.
 */
export function SocialPage() {
  return (
    <>
      <SocialHero />
      <SocialFanOut />
      <SocialCapabilities />
      <SocialProof />
      <SocialPricing />
      <Faq
        items={SOCIAL_FAQ}
        id="faq"
        accent={S.color}
        heading={
          <>
            Social questions
            <Spark color={S.color} />
          </>
        }
        lede="What connects, what it costs, and how one post reaches every network — answered straight. Still deciding? Start the 14-day trial; Social is free either way."
      />
      <SocialCta />
    </>
  );
}

const S = getModuleColor('social');

// The three networks sparx posts to today. Named, not brand-colored — the module
// hue is the only color that paints a control here (RULE #1 / no hardcoded hex).
const NETWORKS: { name: string; frame: string; label: string }[] = [
  { name: 'Facebook', frame: 'aspect-square', label: 'Feed · 1:1' },
  { name: 'Instagram', frame: 'aspect-[9/16]', label: 'Story · 9:16' },
  { name: 'Pinterest', frame: 'aspect-[2/3]', label: 'Pin · 2:3' },
];

// ── HERO ─────────────────────────────────────────────────────────────────────
function SocialHero() {
  return (
    <Section padding="xl">
      <div className="flex flex-col gap-9">
        <div className="max-w-[1000px]">
          <Display as="h1" size={100} lineHeight={94}>
            One post,{' '}
            <span className="text-ink-subtle">
              every network
              <Spark color={S.color} />
            </span>
          </Display>
        </div>

        <div className="flex flex-col items-start justify-between gap-9 lg:flex-row lg:items-end">
          <Text variant="lead" className="text-ink-muted max-w-[620px]">
            Compose a post once, drop in your photos, and send it to Facebook, Instagram, and
            Pinterest at the time you choose. sparx crops each image to the shape every platform
            wants, keeps your products and media one click away, and holds each post for approval
            before it reaches a live account. Free with every sparx plan.
          </Text>

          <div className="flex flex-col items-start gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <a href={signupHref('social-hero')}>
                <Button color="module-social" size="xl">
                  Start free →
                </Button>
              </a>
              <a href="#fan-out">
                <Button size="xl" variant="outline">
                  See how one post flows
                </Button>
              </a>
            </div>
            <Text className="text-mini text-ink-subtle font-mono">
              Free with sparx · Connect your own accounts
            </Text>
          </div>
        </div>

        {/* the three networks, as neutral chips with the module dot */}
        <div className="border-base-300 flex flex-wrap items-center gap-2.5 border-t pt-8">
          <Text as="span" className="text-caption text-ink-muted mr-1 font-medium">
            Posts to
          </Text>
          {NETWORKS.map((n) => (
            <span
              key={n.name}
              className="bg-base-200 border-base-300 text-caption inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium"
            >
              <Dot color={S.color} size={8} />
              {n.name}
            </span>
          ))}
          <span className="text-ink-subtle text-caption font-mono">— more on the way</span>
        </div>
      </div>
    </Section>
  );
}

// ── FAN-OUT · the core beat ──────────────────────────────────────────────────
function SocialFanOut() {
  return (
    <Section id="fan-out" surface="surface" padding="lg">
      <div className="max-w-[720px]">
        <SectionHeader
          accent={S.color}
          headline={<>Compose once. It lands everywhere, in the right shape</>}
          lede={
            <>
              Write the caption a single time and upload one photo. sparx derives the feed, story,
              and pin crops each network wants — attention-aware, with a focal point you can drag —
              and sends the post to every account you picked. One upload, correct everywhere.
            </>
          }
        />
      </div>

      <div className="mt-14 flex flex-col items-stretch gap-8 lg:flex-row lg:items-start">
        {/* composer */}
        <div className="bg-base-100 border-base-300 flex w-full shrink-0 flex-col gap-4 rounded-2xl border p-6 lg:w-[360px]">
          <div className="flex items-center gap-2">
            <Dot color={S.color} size={8} />
            <Text as="span" className="text-caption text-ink-muted font-medium">
              One composer
            </Text>
          </div>
          <div className="bg-base-200 border-base-300 rounded-xl border p-4">
            <Text className="text-body-sm">
              New arrivals just dropped — the whole spring set is live now. Which one’s yours?
            </Text>
          </div>
          {/* the single uploaded photo */}
          <div className="border-base-300 flex items-center gap-3 rounded-xl border p-3">
            <span className={`${S.bg} bg-soft h-12 w-12 shrink-0 rounded-lg`} aria-hidden />
            <div className="flex flex-col">
              <Text as="span" className="text-caption font-medium">
                spring-set.jpg
              </Text>
              <Text as="span" className="text-mini text-ink-subtle font-mono">
                one upload · from your library
              </Text>
            </div>
          </div>
        </div>

        {/* connector — a labelled rule that reads "fans out to" */}
        <div className="flex shrink-0 items-center justify-center py-2 lg:flex-col lg:py-0 lg:pt-16">
          <span className="bg-base-300 h-px w-16 lg:h-16 lg:w-px" aria-hidden />
          <Text as="span" className="text-mini text-ink-subtle px-3 font-mono whitespace-nowrap">
            fans out to
          </Text>
          <span className="bg-base-300 h-px w-16 lg:h-16 lg:w-px" aria-hidden />
        </div>

        {/* three network renditions, each in its own aspect */}
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          {NETWORKS.map((n) => (
            <div
              key={n.name}
              className="bg-base-100 border-base-300 flex flex-col gap-3 rounded-2xl border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <Text as="span" className="text-caption font-medium">
                  {n.name}
                </Text>
                <Text as="span" className="text-mini text-ink-subtle font-mono">
                  {n.label}
                </Text>
              </div>
              {/* the same photo, auto-cropped to this network's shape */}
              <div className={`${n.frame} ${S.bg} bg-soft w-full rounded-lg`} aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── CAPABILITIES ─────────────────────────────────────────────────────────────
function SocialCapabilities() {
  const items: { title: string; body: string }[] = [
    {
      title: 'Compose once, post everywhere',
      body: 'Write the caption a single time and pick which accounts it goes to. sparx fans it out to your Facebook Page, Instagram, and Pinterest boards — no re-typing, no logging into three apps.',
    },
    {
      title: 'The right shape, automatically',
      body: 'Upload one photo and sparx derives the feed, story, and landscape crops each network wants — attention-aware, with a draggable focal point so the subject is never cut off.',
    },
    {
      title: 'Schedule or post now',
      body: 'Send it this instant or line it up for later. Scheduled posts sit in one queue you can see and reorder, and they publish on time without you at the keyboard.',
    },
    {
      title: 'Approvals before it goes live',
      body: 'Nothing reaches a live account unreviewed unless you decide it should. Require approval by default, override per post, and control who may publish to the brand’s accounts.',
    },
    {
      title: 'Straight from your catalog',
      body: 'Post the product you’re already selling or a picture from your media library — the same records the rest of sparx uses. No export, no re-uploading the same photo into another tool.',
    },
    {
      title: 'Free, and it’s yours',
      body: 'Organic posting is free with every sparx plan. Connect your own accounts in a click and disconnect them just as easily — your reach and your audience stay yours.',
    },
  ];

  return (
    <Section padding="lg">
      <SectionHeader
        accent={S.color}
        headline={<>Everything the post needs, nothing it doesn’t</>}
      />
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="bg-base-100 border-base-300 flex min-h-[210px] flex-col gap-3 rounded-xl border px-6 pt-7 pb-8"
          >
            <span className={`${S.bg} h-[3px] w-7 rounded-full`} aria-hidden />
            <Heading level={3} size={4}>
              {it.title}
            </Heading>
            <Text className="text-small text-ink-muted">{it.body}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── DARK PROOF ───────────────────────────────────────────────────────────────
function SocialProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={S.color} />}</>,
      l: 'upload → every network’s crop, derived for you — no resizing by hand',
    },
    { n: '3', l: 'networks today — Facebook, Instagram, Pinterest — from one composer' },
    { n: '$0', l: 'organic posting is free with every plan, no per-post or per-account fee' },
    {
      n: '100%',
      l: 'held for approval by default — nothing goes live unreviewed unless you allow it',
    },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          Your accounts, your audience, your posts
          <Spark color={S.color} />
        </Display>
        <Text variant="lead" className="text-ink-muted mt-6 max-w-[640px]">
          Social runs on the same media library and catalog as the rest of sparx, so the photo you
          just cropped and the product you’re selling are already here. Connect your own accounts,
          keep your own reach, and post to every network from one place — free.
        </Text>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? undefined : 'border-base-300 border-l pl-8'}>
            <div className="font-sans text-[clamp(36px,5vw,54px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <Text className="text-small text-ink-muted mt-3">{s.l}</Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ────────────────────────────────────────────────────────────
function SocialPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col lg:flex-row ${S.bg} bg-soft border-base-300 items-center justify-between gap-8 rounded-[14px] border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans text-[56px] font-medium tracking-[-0.025em]">Free</span>
            <Text as="span" className="text-body text-ink-subtle">
              with sparx
            </Text>
          </div>
          <Text className="text-small text-ink-muted m-0 max-w-[640px]">
            Organic posting to Facebook, Instagram, and Pinterest is free for every tenant — no
            per-post fee, no per-account fee, no add-on charge. Switch it on alongside whatever
            modules you run and it lands on the same one bill. Paid social ads are a separate module
            down the road; the posting you do every day stays free.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all modules →
            </Button>
          </a>
          <a href={signupHref('social-pricing')}>
            <Button color="module-social" size="lg">
              Start free
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ─────────────────────────────────────────────────────────
function SocialCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Post to every network today
          <Spark color={S.color} />
        </Display>
        <Text variant="lead" className="text-ink-muted m-0 max-w-[640px]">
          Turn Social on, connect your accounts, and your next post goes to Facebook, Instagram, and
          Pinterest at once — each in the right shape, on the schedule you set. It’s free, it reads
          from the catalog and media you already have, and your accounts stay yours.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <a href={signupHref('social-final')}>
            <Button color="module-social" size="xl">
              Start free →
            </Button>
          </a>
          <a href="#fan-out">
            <Button size="xl" variant="outline">
              See how one post flows
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}

// Page-specific FAQ — real evaluation questions, grounded in docs/133 + docs/17
// (free module, no tiers). Feeds the FAQPage JSON-LD via <Faq>, so accuracy is
// load-bearing (an assistant quotes these verbatim).
const SOCIAL_FAQ: FaqItem[] = [
  {
    id: 'social-networks',
    question: 'Which social networks can I post to?',
    answer:
      'Facebook Pages, Instagram, and Pinterest today, from one composer — write the caption once, pick the accounts, and sparx publishes to each. More networks are on the way. You connect your own accounts, so posts go out as your brand, not a shared handle.',
  },
  {
    id: 'social-cost',
    question: 'How much does Social cost?',
    answer:
      'Organic posting is free with every sparx plan — no per-post fee, no per-account fee, and no add-on charge. It switches on like any other module and adds nothing to your bill. Paid social advertising, with campaign budgets and spend, is a separate module planned for later; the day-to-day posting stays free.',
  },
  {
    id: 'social-images',
    question: 'Do I have to resize my images for each network?',
    answer:
      'No. Upload one photo and sparx derives the feed, story, and pin crops each network wants — an attention-aware crop with a focal point you can drag, so the subject is never cut off. One upload becomes the correct rendition everywhere, and a per-post override is there if you want to fine-tune a single network.',
  },
  {
    id: 'social-approval',
    question: 'Can I review posts before they go live?',
    answer:
      'Yes, and that’s the default. Every post is held for approval before it reaches a live account unless you deliberately turn that off for a specific automation. Who is allowed to approve and publish to the brand’s accounts is itself a staff permission, so nothing goes out unreviewed by accident.',
  },
  {
    id: 'social-schedule',
    question: 'Can I schedule posts ahead of time?',
    answer:
      'Yes. Post right now or line it up for later. Scheduled posts sit in one queue you can see and reorder, and they publish on time on their own — no need to be at the keyboard when they go out.',
  },
  {
    id: 'social-content',
    question: 'Where do the posts pull their content from?',
    answer:
      'From the same records the rest of sparx uses. Post a product you’re already selling or an image from your media library — no export and no re-uploading the same photo into another tool. Because it’s one platform, the post is part of the business, not a silo.',
  },
];
