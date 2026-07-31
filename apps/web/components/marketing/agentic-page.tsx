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

/**
 * The /agentic marketing page — the AGENTIC / MCP half of the one $49 AI module,
 * told as a positioning story rather than the generic module template. The thesis
 * is the inversion: sparx does NOT ship another chatbot you have to learn; it
 * opens a direct line (the Model Context Protocol) so the assistant you already
 * use can read and write your live business data. "Bring your own AI."
 *
 * This is the INWARD-facing tool (your team, your own AI). Its companion, /ai
 * (AiPage), is the OUTWARD-facing tool: the AI concierge you hand your CUSTOMERS
 * in live chat. Same $49 module, two tools — the two pages cross-link (see
 * <ConciergeCrossLink> below and /ai's <AgenticCrossLink>).
 *
 * Built on the marketing primitives + the per-module colors (this module's
 * accent is AI pink). Section backgrounds alternate page → surface for rhythm,
 * with two dark THEME ISLANDS (`<Section surface="dark">` — the safety surface
 * and the close), never a painted near-black. The single connection endpoint
 * shown is real: services/api-mcp serves Streamable HTTP at mcp.sparx.works/v1,
 * authed by a scoped `sk_live_…` key issued in the dashboard. The literal
 * per-client config deliberately lives in the dashboard connect screen + /docs,
 * never hard-coded here (the key is per-tenant and secret; client configs change).
 *
 * Styling contract: silicaui components + Tailwind utilities only (see
 * SILICA-VOCABULARY.md). Type comes from the editorial `text-*` scale registered
 * in app/globals.css; ink from `text-base-content` / `text-ink-muted` /
 * `text-ink-subtle` (all REAL inks that mix into base-100, never transparent).
 * The only inline styles left are genuinely dynamic values — a module hue read
 * from `getModuleColor()`.
 */
export function AgenticPage() {
  return (
    <>
      <AiHero />
      <TheInversion />
      <HowItWorks />
      <AskInPlainEnglish />
      <ToolSurface />
      <ScopedAudited />
      <WorksWithEveryAssistant />
      <ConciergeCrossLink />
      <AiPricing />
      <AiCta />
    </>
  );
}

const AI = getModuleColor('ai');

/** The real MCP transport endpoint — services/api-mcp, behind Caddy. */
const ENDPOINT = 'mcp.sparx.works/v1';

// ── HERO ────────────────────────────────────────────────────────────────────
function AiHero() {
  // This module's own color, full-bleed — the page sells the standout AI/MCP
  // capability, so it gets the one saturated hero on the marketing site.
  // `bg-*` sets only the fill, so the ink is explicit: `text-neutral` is the
  // near-black token (it stays near-black in BOTH themes, unlike base-content),
  // which measures ~7:1 on the bright magenta and keeps the band tonally tied to
  // the rest of the site. The spark flips to `--color-neutral-content` so the
  // brand accent still reads against its own color. No hexes on either axis.
  return (
    <section className={`${AI.bg} px-page pb-section-lg text-neutral pt-[clamp(56px,9vw,96px)]`}>
      <Container className="flex flex-col gap-10">
        <div className="flex max-w-[1100px] flex-col gap-2">
          <Display as="h1" size={104} lineHeight={96} color="currentColor">
            Bring your
          </Display>
          <Display as="h1" size={104} lineHeight={96} color="currentColor">
            own AI
            <Spark color="var(--color-neutral-content)" />
          </Display>
        </div>

        <div className="max-w-content flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <p className="text-lede m-0 max-w-[640px] font-sans">
            We didn&rsquo;t build you another AI assistant to learn. We opened a direct line so the
            AI you <em>already use</em> &mdash; Claude, ChatGPT, Copilot &mdash; can read and write
            your live business data in plain English, from the same chat you&rsquo;re already in. No
            new tool. No new tab. No exports.
          </p>

          <div className="flex flex-col items-start gap-3.5">
            <div className="flex flex-wrap items-center gap-4">
              <Button color="neutral" size="lg">
                Connect your AI →
              </Button>
              <a href="#how">
                {/* On the band, `variant="outline"` draws from the ambient ink —
                    the same near-black the band already carries. */}
                <Button size="lg" variant="outline">
                  See how it works
                </Button>
              </a>
            </div>
            <span className="text-mini font-mono">Claude · ChatGPT · Copilot · any MCP client</span>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ── THE INVERSION · the core positioning ────────────────────────────────────
function TheInversion() {
  const usual = [
    'A branded copilot bolted onto the dashboard.',
    'Another chat box, with its own personality to learn.',
    'A separate history, walled off from the chats you actually work in.',
    'One more tool to open, check, and keep in your head.',
  ];
  const sparx = [
    'The assistant you already use — and already trust.',
    'Your existing threads, context, and habits, untouched.',
    'An open port (MCP), not a walled garden you log into.',
    'Your whole business, reachable from where your attention already is.',
  ];

  return (
    <Section surface="surface" padding="lg">
      <div className="max-w-[760px]">
        <SectionHeader
          accent={AI.color}
          headline={
            <>
              sparx inside your AI &mdash;{' '}
              <span className="text-ink-muted">not another AI inside sparx</span>
            </>
          }
          lede={
            <>
              Every other platform&rsquo;s move is to add a chatbot you have to learn. That&rsquo;s
              vendor-centric &mdash; it assumes their product deserves your attention. We did the
              opposite: sparx doesn&rsquo;t ask for your attention, it makes your business{' '}
              <em>reachable</em> from wherever your attention already is.
            </>
          }
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        <ContrastCard tone="muted" title="A new bot to babysit" points={usual} />
        <ContrastCard tone="accent" title="A line to the AI you have" points={sparx} />
      </div>
    </Section>
  );
}

function ContrastCard({
  tone,
  title,
  points,
}: {
  tone: 'muted' | 'accent';
  title: string;
  points: string[];
}) {
  const accent = tone === 'accent';
  return (
    <div
      className={`border-base-300 flex flex-col gap-4 rounded-xl border p-8 ${
        accent ? `${AI.bg} bg-soft` : 'bg-base-200'
      }`}
    >
      {/* The two titles ARE the contrast — the "The usual way" / "The sparx way"
          uppercase-mono kickers that used to sit above them were eyebrows. */}
      <Heading level={3}>{title}</Heading>
      <ul className="m-0 grid list-none gap-3 p-0">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3">
            <span className="shrink-0 pt-2">
              <Dot color={accent ? AI.color : 'var(--color-ink-subtle)'} size={7} />
            </span>
            <span className="text-body-sm text-ink-muted font-sans">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── HOW IT WORKS · three steps + the real endpoint ──────────────────────────
function HowItWorks() {
  // No `01 / 02 / 03` markers: a step number above the heading is the banned
  // eyebrow slot. The order is carried by the grid and the verbs themselves.
  const steps = [
    {
      title: 'Activate',
      body: 'Turn on the AI module in your dashboard — one click. It gates the MCP server and tracks which modules your AI can reach.',
    },
    {
      title: 'Connect',
      body: 'In Settings → AI Integrations, generate a scoped key. Paste it, with the endpoint below, into your assistant once.',
    },
    {
      title: 'Ask',
      body: 'In the chat you already use: “What were my top customers this quarter?” Your AI does the rest, live.',
    },
  ];

  return (
    <Section id="how" padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>Connect in three steps</>}
        lede={
          <>
            No integration project, no consultant. The whole thing is generate a key, paste it once,
            and start asking.
          </>
        }
      />

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className={`border-base-300 flex min-h-[210px] flex-col gap-3.5 rounded-xl border px-6 pt-7 pb-8 ${
              i === 0 ? `${AI.bg} bg-soft` : 'bg-base-100'
            }`}
          >
            <Heading level={3}>{s.title}</Heading>
            <p className="text-small text-ink-muted m-0 font-sans">{s.body}</p>
          </div>
        ))}
      </div>

      {/* endpoint callout */}
      <div
        // Dark endpoint exhibit. `bg-soft` mixes into `--color-base-100`, so
        // making this a `data-theme="dark"` island flips that token to the brand
        // navy and the SAME soft treatment lands on a dark surface — no
        // hand-mixed hue, and no hardcoded near-black to drift from the theme.
        data-theme="dark"
        className={`flex flex-col gap-8 lg:flex-row ${AI.bg} bg-soft mt-6 items-center justify-between rounded-xl px-7 py-6`}
      >
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* A readable label for the value below it, not an uppercase-mono
              eyebrow: sentence case, full ink, at the body-label step. */}
          <span className="text-mini text-ink-muted font-sans">One endpoint</span>
          <code className="text-h3 text-base-content font-mono font-medium break-all">
            {ENDPOINT}
          </code>
          <span className="text-mini text-ink-muted font-mono">
            Authorization: Bearer sk_live_…
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Streamable HTTP', 'scoped key', 'any MCP client'].map((t) => (
            <span
              key={t}
              className="bg-base-300 text-base-content text-micro rounded-full px-3 py-1 font-mono"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="text-small text-ink-muted mt-4 max-w-[640px] font-sans">
        The exact config for each client — Claude, ChatGPT, Copilot — is generated with your real
        key in the dashboard and spelled out step by step in the{' '}
        <a href="/docs" className={`${AI.ink} font-medium`}>
          connection guide
        </a>
        .
      </p>
    </Section>
  );
}

// ── ASK IN PLAIN ENGLISH · example chat windows ─────────────────────────────
function AskInPlainEnglish() {
  // Each example is its OWN chat window — window chrome, the assistant it runs
  // in, a real transcript, and a live input bar — so it reads as "this happens
  // inside the AI you already use," not an API console. No code or schema; the
  // only "tech" is the friendly "Used sparx" line, the same disclosure real MCP
  // clients surface. Clients + personas are mixed on purpose (a blog post,
  // customers, a sales check, stock) so every kind of owner sees themselves, in
  // whichever assistant they already use.
  const chats: {
    client: string;
    ask: string;
    answer: string;
    via: string;
    confirm?: boolean;
  }[] = [
    {
      client: 'Claude',
      ask: 'Write a short post announcing we’re open Saturdays now, and save it as a draft.',
      answer:
        'Done — I’ve saved a draft, “Now Open Saturdays,” to your blog. Want me to publish it, or schedule it for Friday morning?',
      via: 'Saved a draft to your site',
    },
    {
      client: 'ChatGPT',
      ask: 'Which customers haven’t bought from me in a while? Send them a friendly note with a discount.',
      answer:
        'I found 47 people who haven’t ordered in about 3 months. I’ll send your “Win-Back” email with 10% off — just say the word and it goes out.',
      via: 'Ready to send — waiting for your OK',
      confirm: true,
    },
    {
      client: 'Copilot',
      ask: 'How’s business this month compared to last?',
      answer:
        'You’re at $84,200 this month — up 23% from $68,400 last month. Your best seller is the Bosch Injector Set.',
      via: 'Read from your live data',
    },
    {
      client: 'Cursor',
      ask: 'Anything I’m about to run out of?',
      answer:
        'Five products are running low, including the Bosch Injector Set (3 left). Want me to start a reorder list?',
      via: 'Read from your live data',
    },
  ];

  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>Ask in plain English</>}
        lede={
          <>
            No dashboards to learn, no exports, no formulas. You ask the way you&rsquo;d ask a
            colleague &mdash; in the assistant you already use &mdash; and it works from your live,
            up-to-the-minute data.
          </>
        }
      />

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        {chats.map((c) => (
          <ChatWindow key={c.ask} {...c} />
        ))}
      </div>
    </Section>
  );
}

function ChatWindow({
  client,
  ask,
  answer,
  via,
  confirm,
}: {
  client: string;
  ask: string;
  answer: string;
  via: string;
  confirm?: boolean;
}) {
  return (
    <div className="bg-base-200 border-base-300 flex flex-col overflow-hidden rounded-2xl border shadow-xl">
      {/* window chrome — which assistant this is running in */}
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <span className="inline-flex items-center gap-2.5">
          <Dot color={AI.color} size={8} />
          <span className="text-caption font-sans font-medium">{client}</span>
        </span>
        {/* Decorative "new chat" affordance, not copy — subtle ink is correct. */}
        <span aria-hidden className="text-body text-ink-subtle font-mono">
          +
        </span>
      </div>

      {/* transcript */}
      <div className="flex flex-1 flex-col gap-4 px-4 py-5">
        {/* user turn — right-aligned bubble + the owner's profile avatar */}
        <div className="flex max-w-[92%] items-start gap-2.5 self-end">
          <div className="bg-base-100 text-small rounded-[14px_14px_4px_14px] px-3.5 py-2.5 font-sans font-medium">
            {ask}
          </div>
          <UserAvatar />
        </div>

        {/* assistant turn — avatar + bubble + the friendly "Used sparx" receipt */}
        <div className="flex items-start gap-2.5">
          <ChatAvatar label="AI" accent />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="bg-base-200 border-base-300 text-small text-ink-muted rounded-[14px_14px_14px_4px] border px-3.5 py-2.5 font-sans">
              {answer}
            </div>
            <span
              className={`text-mini inline-flex items-center gap-2 pl-0.5 font-sans ${
                confirm ? AI.ink : 'text-ink-muted'
              }`}
            >
              <Dot color={AI.color} size={6} />
              Used sparx · {via}
            </span>
          </div>
        </div>
      </div>

      {/* input bar — the detail that makes it read as a real chat window */}
      <div className="border-base-300 flex items-center gap-2.5 border-t px-3.5 py-3">
        {/* Placeholder copy — genuinely not meant to be read. */}
        <span className="border-base-300 bg-base-100 text-caption text-ink-subtle flex-1 truncate rounded-full border px-3.5 py-2 font-sans">
          Message {client}…
        </span>
        <span
          aria-hidden
          className={`${AI.bg} text-module-ai-content text-body-sm inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans`}
        >
          ↑
        </span>
      </div>
    </div>
  );
}

/** The owner's profile avatar on the user turn — a neutral circular photo
 *  stand-in (generic person glyph) so the chat reads as a real account, without
 *  implying a specific named person. */
function UserAvatar() {
  return (
    <span
      aria-hidden
      className="bg-base-100 border-base-300 text-ink-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
    >
      <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2.2c-4.5 0-8.2 2.3-8.2 5.1V21h16.4v-1.7c0-2.8-3.7-5.1-8.2-5.1Z" />
      </svg>
    </span>
  );
}

function ChatAvatar({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`text-micro inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono font-medium ${
        accent
          ? `${AI.bg} text-module-ai-content`
          : 'bg-base-100 border-base-300 text-ink-muted border'
      }`}
    >
      {label}
    </span>
  );
}

// ── TOOL SURFACE · what the AI can reach ────────────────────────────────────
function ToolSurface() {
  const groups: {
    module: MarketingModule;
    label: string;
    actions: string;
  }[] = [
    {
      module: 'commerce',
      label: 'Orders & revenue',
      actions: 'Orders, order stats, unfulfilled queue, top customers, revenue summaries.',
    },
    {
      module: 'crm',
      label: 'Customers & CRM',
      actions: 'Profiles, inactive lists, B2B accounts, pipeline, add a note.',
    },
    {
      module: 'commerce',
      label: 'Products & inventory',
      actions: 'Catalog search, low-stock alerts, per-product performance, adjust inventory.',
    },
    {
      module: 'email',
      label: 'Email & campaigns',
      actions: 'Delivery and open rates, active automations, send a broadcast to a segment.',
    },
    {
      module: 'builder',
      label: 'Site & pages',
      actions: 'Read and update Builder pages, layouts, and published content.',
    },
    {
      module: 'ai',
      label: 'Automations',
      actions: 'List, trigger, and inspect platform automations and their runs.',
    },
    {
      module: 'crm',
      label: 'Invoicing & quotes',
      actions: 'Draft and read invoices and quotes — when the Invoicing module is on.',
    },
    {
      module: 'scheduling',
      label: 'Scheduling & bookings',
      actions: 'Services, availability, and bookings — create, reschedule, or cancel a booking.',
    },
    {
      module: 'cms',
      label: 'Universal search',
      actions: 'One query across every record — products, customers, content, more.',
    },
  ];

  return (
    <Section padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>Everything your AI can reach</>}
        lede={
          <>
            Your assistant can use the tools for the modules you&rsquo;ve turned on &mdash; and only
            those. Scopes follow your modules, so the surface grows as you do.
          </>
        }
      />

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => {
          const c = getModuleColor(g.module);
          return (
            <div
              key={g.label}
              className="bg-base-100 border-base-300 flex min-h-[156px] flex-col gap-3 rounded-xl border p-6"
            >
              <span
                className={`${c.bg} bg-soft inline-flex h-8 w-8 items-center justify-center rounded-lg`}
              >
                <Dot color={c.color} size={9} />
              </span>
              <Heading level={3} size={5}>
                {g.label}
              </Heading>
              <p className="text-caption text-ink-muted m-0 font-sans">{g.actions}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── SCOPED & AUDITED · trust (dark theme island) ────────────────────────────
function ScopedAudited() {
  const items = [
    {
      title: 'Per-agent keys',
      body: 'Issue a separate scoped key for each assistant or teammate. They never share one credential.',
    },
    {
      title: 'Per-tool permissions',
      body: 'A key carries exactly the scopes you grant — read-only, a single module, or write where you allow it.',
    },
    {
      title: 'Writes confirm first',
      body: 'Anything that changes data — an order status, inventory, a send — surfaces a confirmation before it runs.',
    },
    {
      title: 'Every call audited',
      body: 'Tool name, actor, and result land in the audit log. You can see exactly what your AI did, and when.',
    },
    {
      title: 'Revoke in one click',
      body: 'Kill a key the moment you want to. The line closes instantly — no propagation delay, no leftover access.',
    },
    {
      title: 'Abuse-capped, not metered',
      body: 'A flat per-tenant rate limit blunts runaway loops and accidental bulk actions. It’s a guardrail, not a meter.',
    },
  ];

  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[720px]">
        <Display size={56} lineHeight={60}>
          Let AI touch your business — safely
          <Spark color={AI.color} />
        </Display>
        <p className="text-lede text-ink-muted mt-6 mb-0 max-w-[640px] font-sans">
          Opening a line to your data is only worth it if you stay in control of it. Access is
          scoped, every action is logged, and you can cut it off in a click.
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
            <p className="text-caption text-ink-muted m-0 font-sans">{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── WORKS WITH EVERY ASSISTANT ──────────────────────────────────────────────
function WorksWithEveryAssistant() {
  const clients = [
    { name: 'Claude', note: 'Anthropic · MCP over SSE' },
    { name: 'ChatGPT', note: 'OpenAI · MCP over HTTP' },
    { name: 'Copilot', note: 'Microsoft · MCP over HTTP' },
    { name: 'Cursor', note: 'In-editor · MCP' },
    { name: 'Any MCP client', note: 'One endpoint, all of them' },
  ];

  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={AI.color}
        headline={<>Works with every assistant</>}
        lede={
          <>
            MCP is an open standard, so this isn&rsquo;t a one-vendor bet. The same endpoint and key
            work in whatever you already use — switch assistants and your connection comes with you.
          </>
        }
      />

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {clients.map((c) => (
          <div
            key={c.name}
            className="bg-base-200 border-base-300 flex flex-col gap-1.5 rounded-xl border px-6 py-5"
          >
            <Heading level={3} size={5}>
              {c.name}
            </Heading>
            <span className="text-mini text-ink-muted font-mono">{c.note}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── CROSS-LINK · the other half of the AI module (the concierge) ────────────
function ConciergeCrossLink() {
  return (
    <Section padding="lg">
      {/* The two headings carry the inward/outward contrast themselves — the
          "This page · inward" / "Its twin · outward" mono kickers that used to
          sit above them were eyebrows, so they're gone. */}
      <div
        className={`flex flex-col gap-8 lg:flex-row ${AI.bg} bg-soft border-base-300 items-center justify-between rounded-2xl border p-10`}
      >
        <div className="flex-1">
          <Heading level={3}>The agentic line faces your team</Heading>
          <p className="text-small text-ink-muted mt-1.5 mb-0 font-sans">
            The AI you already use, pointed at your own live data over MCP.
          </p>
        </div>

        <span aria-hidden className={`${AI.ink} text-h1 leading-none`}>
          →
        </span>

        <div className="flex-1">
          <Heading level={3}>The concierge faces your customers</Heading>
          <p className="text-small text-ink-muted mt-1.5 mb-3.5 font-sans">
            An AI first-responder in your live chat, grounded on your catalog and policies.
          </p>
          <a href="/ai">
            <Button color="module-ai" size="md">
              Meet the concierge →
            </Button>
          </a>
        </div>
      </div>
      <p className="text-mini text-ink-muted mt-4 text-center font-mono">
        Both tools · one $49 AI module
      </p>
    </Section>
  );
}

// ── PRICING STRIP ───────────────────────────────────────────────────────────
function AiPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col gap-8 lg:flex-row ${AI.bg} bg-soft border-base-300 items-center justify-between rounded-xl border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-ink-muted text-h1 font-sans font-medium">+</span>
            <Display as="h3" size={56} lineHeight={56}>
              $49
            </Display>
            <span className="text-body text-ink-muted font-sans">/mo</span>
          </div>
          <p className="text-small text-ink-muted m-0 max-w-[640px] font-sans">
            A flat $49/mo. Connect any MCP client and read or write live data across every module
            you run — scoped, audited, revocable, all on one bill.
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
    </Section>
  );
}

// ── FINAL CTA (dark theme island) ───────────────────────────────────────────
function AiCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-10">
        <Display size={88} lineHeight={84}>
          Your business, in the chat you already use
          <Spark color={AI.color} />
        </Display>
        <p className="text-lede text-ink-muted m-0 max-w-[640px] font-sans">
          No new assistant to learn, no migration, no contract. Generate a key, paste it once, and
          ask your own AI anything about your business. Turn it off any time — your data stays.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="xl" variant="solid">
            Connect your AI →
          </Button>
          <a href="/docs">
            <Button size="xl" variant="outline">
              Read the connection guide
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
