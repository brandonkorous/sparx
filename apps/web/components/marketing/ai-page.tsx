import type { ReactNode } from 'react';
import { Button, Heading } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  type MarketingModule,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';
import { Faq, type FaqItem } from './faq';

/**
 * The /ai marketing page — the AI CONCIERGE: the outward half of the one $49 AI
 * module. Its companion, /agentic, is the inward half (point your OWN AI at your
 * data over MCP, for your team). This page sells the customer-facing tool: the
 * Live Chat AI first-responder that greets a tenant's website visitors, answers
 * from their LIVE catalog + policies, and hands off to a human the moment it's
 * unsure. Grounded in the real behavior of services/api-rest chat/ai-handler.ts.
 *
 * Honest, load-bearing framing (never soften it): sparx runs ZERO AI on its own
 * credential — the tenant brings their own Anthropic/OpenAI key (encrypted). No
 * key → every conversation goes to a human. The concierge does READ-only lookups
 * (max 4 round-trips), never acts on the customer's behalf, and escalates below a
 * confidence threshold, outside hours, or on any uncertainty.
 *
 * Visual differentiation from /agentic within the same module family: /agentic
 * owns the one SATURATED magenta flood hero on the marketing site, so the
 * front-of-house concierge takes the TINTED pink hero (the brand default for
 * module pages) instead — same AI-pink hue, distinctly softer. AI pink stays a
 * SIGNAL throughout (the spark, dots, the widget accent), never a wash. Section
 * backgrounds alternate page → surface for rhythm, with two dark THEME ISLANDS
 * (`<Section surface="dark">` — the BYOK truth + the close), never a painted
 * near-black. Example data rotates through EXAMPLE_BUSINESSES via <Cycle> so no
 * single vertical reads as "what the concierge is for."
 *
 * Styling contract: silicaui components + Tailwind utilities only (see
 * SILICA-VOCABULARY.md). Type comes from the editorial `text-*` scale registered
 * in app/globals.css; ink from `text-base-content` / `` /
 * `` (all REAL inks that mix into base-100, never transparent).
 * The only inline styles left are genuinely dynamic values — a module hue read
 * from `getModuleColor()`.
 */
export function AiPage() {
  return (
    <>
      <ConciergeHero />
      <AnswerLifecycle />
      <GroundedInData />
      <RunsOnYourKey />
      <KnowsWhenToEscalate />
      <ShapeItYourself />
      <AgenticCrossLink />
      <ConciergePricing />
      <Faq
        items={CONCIERGE_FAQ}
        id="faq"
        accent={AI.color}
        heading={
          <>
            Concierge questions
            <Spark color={AI.color} />
          </>
        }
        lede="Your own key, where its answers come from, when a human takes over, and what it costs — answered straight. Still weighing it? Read the chat docs or start the 14-day trial."
      />
      <ConciergeCta />
    </>
  );
}

const AI = getModuleColor('ai');

// Page-specific FAQ — the real objections a visitor evaluating the customer-
// facing concierge would raise, answered straight and grounded in the shipped
// behavior (chat/ai-handler.ts) + billing (docs/17). No tier/plan language. Feeds
// the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const CONCIERGE_FAQ: FaqItem[] = [
  {
    id: 'concierge-byok',
    question: 'Do I have to bring my own AI key?',
    answer:
      'Yes. sparx never answers your customers on an AI credential of its own — there is no house account to fall back on. You paste your own Anthropic or OpenAI key into your chat settings once, it is encrypted at rest, and every conversation runs on your model and your terms. Haven’t connected a key? The concierge stands down and every chat goes straight to your team, exactly as if AI were switched off.',
  },
  {
    id: 'concierge-hallucinate',
    question: 'Will it make things up about my products or policies?',
    answer:
      'The sparx concierge answers from your live data, not a snapshot of your site crawled weeks ago. Before it replies it can run up to four read-only lookups against your real catalog, prices, availability, published pages, and store details like hours and contact info. Every answer also carries a confidence score, and anything below the bar is handed to a person instead of guessed at.',
  },
  {
    id: 'concierge-handoff',
    question: 'What happens when it doesn’t know the answer?',
    answer:
      'It hands the conversation to your team. The chat drops into your staff inbox and the customer is told a person will follow up shortly. Outside your operating hours it leaves the away message you wrote and still passes the conversation along, and if a teammate has already picked up the chat it stays out of the way entirely. The sparx concierge is fail-safe by design: when it is unsure, it gets a human rather than reaching your customer unchecked.',
  },
  {
    id: 'concierge-actions',
    question: 'Can it place orders or change things for a customer?',
    answer:
      'No. The sparx concierge is strictly read-only. It can look up products, prices, availability, and store details to ground an answer, but it can never place an order, move money, or change a record on a customer’s behalf. Questions about a specific order, account, or refund go to a real person every time.',
  },
  {
    id: 'concierge-livechat',
    question: 'Do I need the Live Chat module too?',
    answer:
      'Yes, and the two are priced separately. Live Chat ($19/mo) gives you the chat widget on your site, the conversation routing, and the staff inbox your team answers from. The concierge that answers first is part of the sparx AI module ($49/mo). With Live Chat on its own, every conversation goes to a person. Add AI and the concierge takes the first pass.',
  },
  {
    id: 'concierge-control',
    question: 'Can I control its tone, greeting, and look?',
    answer:
      'Yes, without writing any code. In sparx you set the opening greeting, the away message, the tone and persona it writes in, the accent color, which corner of the page it sits in, and your operating hours — all from the dashboard, like any other setting. No prompt engineering, no training data, no developer.',
  },
  {
    id: 'concierge-usage-cost',
    question: 'What does the AI usage cost on top of the $49?',
    answer:
      'Because the sparx concierge runs on your own provider key, you pay Anthropic or OpenAI directly for what your conversations use, at their published rates. sparx charges the flat $49/mo for the AI module and never marks up, meters, or resells your messages. Each conversation is also capped at four lookups, so a confused answer cannot spiral into runaway usage.',
  },
  {
    id: 'concierge-vs-agentic',
    question: 'How is this different from the agentic / MCP tool?',
    answer:
      'They are two halves of the same sparx AI module ($49/mo), and turning it on gets you both. The concierge faces outward: it answers your customers in the live chat on your site. The agentic tool faces inward: it points the AI you already use — Claude, ChatGPT, Copilot — at your own business data, so your team can ask questions and get work done from the chat they are already in. One module, one bill, both tools.',
  },
];

// ── HERO ────────────────────────────────────────────────────────────────────
function ConciergeHero() {
  // Tinted (not flooded) AI-pink band — the front-of-house counterpart to
  // /agentic's saturated hero. `${AI.bg} bg-soft` is silica's theme-aware tint,
  // so it lands light in light mode and on-brand in dark. The figure is a live
  // chat widget on a tenant's site, rotating through EXAMPLE_BUSINESSES so the
  // "works for any business" claim is demonstrated, not asserted.
  return (
    <section className={`${AI.bg} bg-soft px-page pb-section-lg pt-[clamp(56px,9vw,96px)]`}>
      <Container>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          <div className="mkt-stack-copy">
            <div className="flex flex-col gap-1.5">
              <Display as="h1" size={96} lineHeight={90}>
                Answer every customer
              </Display>
              <Display as="h1" size={96} lineHeight={90}>
                the moment they ask
                <Spark color={AI.color} />
              </Display>
            </div>
            <p className="m-0 max-w-[560px] font-sans text-lg">
              Your customers arrive with a question. Your concierge greets them, answers from your
              real catalog and published pages, and hands off to a person the second it&rsquo;s
              unsure. Instant help at your front door, running on your own AI, never ours.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button color="neutral" size="lg">
                Turn on your concierge →
              </Button>
              <a href="#how">
                <Button size="lg" variant="outline">
                  See how it answers
                </Button>
              </a>
            </div>
            <span className="font-mono text-sm">
              Your key · your model · your customers&rsquo; questions
            </span>
          </div>

          <Cycle
            interval={4600}
            items={EXAMPLE_BUSINESSES.map((b) => (
              <ConciergeWidget key={b.name} business={b} />
            ))}
          />
        </div>
      </Container>
    </section>
  );
}

/** Derive a believable concierge exchange from a business fixture — real product
 *  + real shipping line, so the demo is grounded and rotates without a new
 *  dataset. Kept the same shape (ask + answer + receipt) across every business
 *  so the rotating widget never reflows. */
function conciergeScene(b: ExampleBusiness) {
  // Every fixture ships two products, but the index signature is unchecked —
  // fall back rather than assert so a future fixture edit can't crash the hero.
  const product = b.order.products[0]?.name ?? 'that item';
  const shipTail = b.order.shipping.label.split('· ')[1] ?? 'Standard shipping';
  const freeShip = b.order.shipping.value === '$0.00';
  const answer = freeShip
    ? `Yes! The ${product} is in stock, and ${shipTail.toLowerCase()} is free. Want me to pull up the details?`
    : `Yes! The ${product} is in stock. Shipping runs ${b.order.shipping.value} via ${shipTail}. Want me to pull up the details?`;
  return {
    ask: `Do you have the ${product} in stock, and how does shipping work?`,
    answer,
    receipt: `Answered from ${b.name}'s live catalog`,
  };
}

function ConciergeWidget({ business }: { business: ExampleBusiness }) {
  const scene = conciergeScene(business);
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-2xl">
      {/* browser chrome — this runs on the tenant's OWN site */}
      <div className="border-base-300 flex items-center gap-2 border-b px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden className="bg-base-300 h-3 w-3 rounded-full" />
        ))}
        <span className="ml-2 font-mono text-sm">{business.domain}</span>
      </div>

      {/* the widget sitting on the page, bottom-right like a real launcher */}
      <div className="bg-base-200 min-h-[340px] p-6">
        <div className="bg-base-100 border-base-300 ml-auto max-w-[340px] overflow-hidden rounded-2xl border shadow-xl">
          {/* head — the tenant's site name, on the concierge accent. `bg-*` only
              sets the fill, so the paired `-content` ink is explicit. */}
          <WidgetHead title={business.name} />

          {/* transcript */}
          <div className="bg-base-200 flex flex-col gap-3 p-4">
            <Bubble who="user">{scene.ask}</Bubble>
            <Bubble who="ai">{scene.answer}</Bubble>
            <Receipt dotColor={AI.color}>{scene.receipt}</Receipt>
          </div>

          {/* input bar */}
          <div className="border-base-300 bg-base-100 flex items-center gap-2 border-t px-3 py-2.5">
            {/* Placeholder copy — genuinely not meant to be read, so subtle ink. */}
            <span className="border-base-300 flex-1 rounded-full border px-3 py-2 font-sans text-sm">
              Type a message…
            </span>
            <span
              aria-hidden
              className={`${AI.bg} text-module-ai-content text-md grid h-8 w-8 place-items-center rounded-full`}
            >
              ↑
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The concierge widget's title bar — the tenant's site name on the AI accent.
 *  Shared by the hero widget and the live preview in <ShapeItYourself>. */
function WidgetHead({ title }: { title: string }) {
  return (
    <div className={`${AI.bg} text-module-ai-content flex items-center gap-2.5 px-4 py-3`}>
      <span
        aria-hidden
        className="text-md grid h-8 w-8 place-items-center rounded-full bg-current/20"
      >
        ✦
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm">Ask us anything</span>
      </span>
    </div>
  );
}

function Bubble({ who, children }: { who: 'user' | 'ai'; children: ReactNode }) {
  const user = who === 'user';
  return (
    <span
      className={`max-w-[90%] px-3 py-2.5 font-sans text-sm ${
        user
          ? 'bg-neutral text-neutral-content self-end rounded-[14px_14px_4px_14px] font-medium'
          : 'bg-base-100 border-base-300 self-start rounded-[14px_14px_14px_4px] border'
      }`}
    >
      {children}
    </span>
  );
}

function Receipt({ children, dotColor }: { children: ReactNode; dotColor: string }) {
  return (
    <span className="inline-flex items-center gap-2 pl-0.5 font-sans text-sm">
      <Dot color={dotColor} size={6} />
      {children}
    </span>
  );
}

// ── ANSWER LIFECYCLE · the confidence-gate fork ─────────────────────────────
function AnswerLifecycle() {
  const steps = [
    {
      title: 'A customer asks',
      body: 'In plain English, in the chat on your site. No menu to navigate, no ticket to file.',
    },
    {
      title: 'It looks things up',
      body: 'Up to four quick, read-only lookups against your real catalog, prices, availability, and published pages. The same records your dashboard shows.',
    },
    {
      title: 'It rates its own answer',
      body: 'Every reply carries a confidence score. High enough, and it sends. Anything less, and it forks to a person.',
    },
  ];
  return (
    <Section id="how" surface="surface" padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>One question, one honest answer</>}
        lede={
          <>
            No scripts to write, no decision trees to wire. It reads the question, checks your real
            data, and then either answers or gets a human. Every time.
          </>
        }
      />

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.title}
            className="bg-base-100 border-base-300 flex min-h-[190px] flex-col gap-3 rounded-xl border px-6 py-7"
          >
            <Dot color={AI.color} size={9} />
            <Heading level={3}>{s.title}</Heading>
            <p className="m-0 font-sans text-sm">{s.body}</p>
          </div>
        ))}
      </div>

      {/* the fork — the fail-safe branch made visible */}
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <ForkCard
          tone="confident"
          title="When it’s sure, it answers on the spot"
          body="In your customer’s hands in seconds, in your voice, at 2am and at any volume."
        />
        <ForkCard
          tone="human"
          title="When it isn’t, it fetches a person"
          body="It tells the customer a person will follow up, then drops the conversation into your staff inbox. It would rather fetch a human than guess."
        />
      </div>
    </Section>
  );
}

function ForkCard({
  tone,
  title,
  body,
}: {
  tone: 'confident' | 'human';
  title: string;
  body: string;
}) {
  const confident = tone === 'confident';
  return (
    <div
      className={`border-base-300 flex flex-col gap-2 rounded-xl border p-7 ${
        confident ? `${AI.bg} bg-soft` : 'bg-base-100'
      }`}
    >
      {/* No label above the heading. The two outcomes ARE the two headings —
          a kicker here (span OR Badge) is the banned eyebrow slot either way;
          the tint is what separates the branches. */}
      <Heading level={3}>{title}</Heading>
      <p className="m-0 font-sans text-sm">{body}</p>
    </div>
  );
}

// ── GROUNDED · live data, not a scraped FAQ ─────────────────────────────────
function GroundedInData() {
  const records: { module: MarketingModule; label: string; value: string; sub: string }[] = [
    {
      module: 'commerce',
      label: 'Catalog · live',
      value: 'Pour-Over Kit — 12 in stock',
      sub: 'Reads your real inventory count, not a cached page.',
    },
    {
      module: 'builder',
      label: 'Published pages · live',
      value: 'Returns, shipping, hours, contact',
      sub: 'Points customers to your own published pages and store details.',
    },
    {
      module: 'crm',
      label: 'Orders & accounts · off limits',
      value: 'Goes to a person, every time',
      sub: 'It never looks up or guesses at someone’s order or account.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>Live data, not a scraped FAQ</>}
        lede={
          <>
            Most chat bots guess from a snapshot of your site crawled weeks ago. Yours reads the
            same live records your dashboard shows, the moment they change. Change a price at 9:00
            and the answer is right at 9:01.
          </>
        }
      />
      <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <div className="bg-base-100 border-base-300 rounded-xl border p-7">
          <Receipt dotColor="var(--color-neutral)">A customer asks</Receipt>
          <p className="mt-3.5 mb-0 font-sans text-2xl font-medium tracking-[-0.01em]">
            &ldquo;Is the pour-over kit back in stock, and what&rsquo;s your return window?&rdquo;
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {records.map((r) => (
            <div
              key={r.value}
              className="bg-base-100 border-base-300 flex items-start gap-3 rounded-xl border px-4 py-4"
            >
              <span className="shrink-0 pt-1.5">
                <Dot color={getModuleColor(r.module).color} size={9} />
              </span>
              <div className="min-w-0">
                {/* A record label, not an eyebrow: full ink, sentence case, no
                    uppercase-mono micro-caps introducing the value below it. */}
                <div className="font-sans text-sm">{r.label}</div>
                <div className="text-md mt-0.5 font-sans font-medium">{r.value}</div>
                <div className="mt-0.5 font-sans text-sm">{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── BYOK · runs on your key (dark theme island) ─────────────────────────────
function RunsOnYourKey() {
  const items = [
    {
      title: 'Your key, encrypted',
      body: 'Paste your Anthropic or OpenAI key once. It’s encrypted at rest and only ever decrypted to answer.',
    },
    {
      title: 'Your model, your bill',
      body: 'You pay your provider directly for usage. sparx charges a flat fee, with no per-message markup.',
    },
    {
      title: 'No key, no guessing',
      body: 'Haven’t connected one? Every chat goes straight to a person. There is no sparx fallback AI.',
    },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[780px]">
        <Display size={56} lineHeight={60}>
          It runs on your AI. Never ours
          <Spark color={AI.color} />
        </Display>
        <p className="mt-6 mb-0 max-w-[660px] font-sans text-lg">
          sparx doesn&rsquo;t sell you intelligence. You connect your own provider key, encrypted,
          and yours to revoke. Every conversation runs on your model, on your terms. This is the
          floor, not a setting: sparx never answers your customers on a credential of its own.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="bg-base-200 border-base-300 flex flex-col gap-2.5 rounded-xl border p-6"
          >
            <Heading level={3} size={5} className="flex items-center gap-2.5">
              <Dot color={AI.color} size={8} />
              {it.title}
            </Heading>
            <p className="m-0 font-sans text-sm">{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── KNOWS WHEN TO ESCALATE · two outcome windows ────────────────────────────
function KnowsWhenToEscalate() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>It knows when to get a human</>}
        lede={
          <>
            Anything about a specific order, account, or refund goes straight to a person. So does
            any answer it isn&rsquo;t sure enough about. Outside your hours it leaves your away
            message and passes the conversation along. Fail-safe by design.
          </>
        }
      />

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        <OutcomeCard
          ask="What’s the difference between the two pour-over kits?"
          answer="The Classic kit is ceramic; the Pro adds a gooseneck kettle and a scale. Both ship free over $150."
          receipt="Answered · high confidence"
          dotColor={AI.color}
        />
        <OutcomeCard
          ask="Can you refund order #1042 and reship it to a new address?"
          answer="I want to get this exactly right, so I’m bringing in a teammate who can help. They’ll follow up shortly."
          receipt="Handed to your team · account action"
          dotColor={getModuleColor('crm').color}
        />
      </div>

      <p className="mt-5 max-w-[660px] font-sans text-sm">
        You set your operating hours and your away message. The confidence bar is built in and set
        high, so anything the concierge can&rsquo;t answer with certainty becomes a conversation
        waiting in your staff inbox.
      </p>
    </Section>
  );
}

function OutcomeCard({
  ask,
  answer,
  receipt,
  dotColor,
}: {
  ask: string;
  answer: string;
  receipt: string;
  dotColor: string;
}) {
  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-6 shadow-xl">
      <div className="flex flex-col gap-3">
        <Bubble who="user">{ask}</Bubble>
        <Bubble who="ai">{answer}</Bubble>
        <Receipt dotColor={dotColor}>{receipt}</Receipt>
      </div>
    </div>
  );
}

// ── SHAPE IT · no-code configuration + live preview ─────────────────────────
function ShapeItYourself() {
  const fields = [
    { label: 'Greeting', value: 'Hi! Ask us anything about our beans or your order.' },
    {
      label: 'Away message (outside hours)',
      value: 'We’re closed right now. Leave a note and we’ll reply first thing.',
    },
    { label: 'Tone', value: 'Warm · concise · first-name' },
  ];
  const swatches = ['ai', 'commerce', 'crm', 'builder'] as const;
  return (
    <Section padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>Yours to shape, no code</>}
        lede={
          <>
            Set it up like any other setting. Write the greeting in your voice, pick a tone, match
            your brand color, set your hours. No prompt engineering, no training data, no developer.
          </>
        }
      />

      <div className="mt-14 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        {/* the dashboard settings panel — field labels are legitimate UI mimicry */}
        <div className="bg-base-100 border-base-300 rounded-2xl border p-6 shadow-xl">
          {fields.map((f) => (
            <div key={f.label} className="mb-4">
              <span className="mb-1.5 block font-sans text-sm">{f.label}</span>
              <div className="border-base-300 rounded-lg border px-3 py-2.5 font-sans text-sm">
                {f.value}
              </div>
            </div>
          ))}
          <div>
            <span className="mb-2 block font-sans text-sm">Accent color</span>
            <div className="flex gap-2">
              {swatches.map((m, i) => (
                <span
                  key={m}
                  aria-hidden
                  className={`h-6 w-6 rounded-full ${i === 0 ? 'outline-2 outline-offset-2' : ''}`}
                  style={{ backgroundColor: getModuleColor(m).color }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* the live preview it drives */}
        <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-xl">
          <WidgetHead title="North Loop Roasters" />
          <div className="bg-base-200 flex flex-col gap-3 p-4">
            <Bubble who="ai">Hi! Ask us anything about our beans or your order.</Bubble>
            <Bubble who="user">When&rsquo;s this month&rsquo;s roast shipping?</Bubble>
            <Bubble who="ai">
              This month&rsquo;s washed Colombia ships Friday. Subscribers get it first.
            </Bubble>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── CROSS-LINK · the other half of the AI module ────────────────────────────
function AgenticCrossLink() {
  return (
    <Section surface="surface" padding="lg">
      {/* The two headings carry the outward/inward contrast themselves — the
          "This page · outward" / "Its twin · inward" mono kickers that used to
          sit above them were eyebrows, so they're gone. */}
      <div
        className={`flex flex-col gap-8 lg:flex-row ${AI.bg} bg-soft border-base-300 items-center justify-between rounded-2xl border p-10`}
      >
        <div className="flex-1">
          <Heading level={3}>The concierge faces your customers</Heading>
          <p className="mt-1.5 mb-0 font-sans text-sm">
            Answers your website visitors, grounded on your live data.
          </p>
        </div>

        <span aria-hidden className={`${AI.ink} text-3xl leading-none`}>
          →
        </span>

        <div className="flex-1">
          <Heading level={3}>The agentic line faces your team</Heading>
          <p className="mt-1.5 mb-3.5 font-sans text-sm">
            Point the AI you already use at your own data over MCP.
          </p>
          <a href="/agentic">
            <Button color="module-ai" size="md">
              Meet the agentic side →
            </Button>
          </a>
        </div>
      </div>
      <p className="mt-4 text-center font-mono text-sm">Both tools · one $49 AI module</p>
    </Section>
  );
}

// ── PRICING ─────────────────────────────────────────────────────────────────
function ConciergePricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col gap-8 lg:flex-row ${AI.bg} bg-soft border-base-300 items-center justify-between rounded-xl border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <Display as="h3" size={56} lineHeight={56}>
              $49
            </Display>
            <span className="text-md font-sans">/mo</span>
          </div>
          <p className="m-0 max-w-[620px] font-sans text-sm">
            One AI module, both tools: the customer-facing concierge on this page and the agentic
            MCP line for your own team. Bring your own key and pay your provider for usage. Flat, on
            one bill, no tiers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="neutral" size="lg">
            Activate AI
          </Button>
        </div>
      </div>
      <p className="mt-3.5 font-sans text-sm">
        The concierge needs the Live Chat module too ($19/mo) — that&rsquo;s the chat widget on your
        site and the staff inbox your team answers from. $68/mo for both, on one bill.
      </p>
    </Section>
  );
}

// ── FINAL CTA (dark theme island) ───────────────────────────────────────────
function ConciergeCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-10">
        <Display size={84} lineHeight={82}>
          Put a concierge at your front door
          <Spark color={AI.color} />
        </Display>
        <p className="m-0 max-w-[640px] font-sans text-lg">
          Connect your key, write a greeting, and your customers get straight answers from your real
          catalog in seconds, with a person always one step away. Turn it off any time. Your data
          stays.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button color="module-ai" size="xl">
            Turn on your concierge →
          </Button>
          <a href="/docs">
            {/* Inside the dark island `variant="outline"` resolves its own
                border + ink from the flipped base ramp — no hexes needed. */}
            <Button size="xl" variant="outline">
              Read the setup guide
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
