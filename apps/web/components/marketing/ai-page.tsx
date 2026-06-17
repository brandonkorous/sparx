import { Button } from '@sparx/ui';
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
 * The /ai marketing page — the AI · MCP module, told as a positioning story
 * rather than the generic module template. The thesis is the inversion: sparx
 * does NOT ship another chatbot you have to learn; it opens a direct line (the
 * Model Context Protocol) so the assistant you already use can read and write
 * your live business data. "Bring your own AI."
 *
 * Built on the marketing primitives + the eight module colors (this module's
 * accent is AI pink). Section backgrounds alternate page → surface for rhythm,
 * with two near-black bands (the safety surface and the close). The single
 * connection endpoint shown is real: services/api-mcp serves Streamable HTTP at
 * mcp.sparx.works/v1, authed by a scoped `sk_live_…` key issued in the
 * dashboard. The literal per-client config deliberately lives in the dashboard
 * connect screen + /docs, never hard-coded here (the key is per-tenant and
 * secret; client configs change).
 */
export function AiPage() {
  return (
    <>
      <AiHero />
      <TheInversion />
      <HowItWorks />
      <AskInPlainEnglish />
      <ToolSurface />
      <ScopedAudited />
      <WorksWithEveryAssistant />
      <AiPricing />
      <AiCta />
    </>
  );
}

const AI = getModuleColor('ai');
const MODS = {
  builder: getModuleColor('builder'),
  commerce: getModuleColor('commerce'),
  cms: getModuleColor('cms'),
  crm: getModuleColor('crm'),
  email: getModuleColor('email'),
  b2b: getModuleColor('b2b'),
  ai: getModuleColor('ai'),
  dropship: getModuleColor('dropship'),
} as const;

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

/** The real MCP transport endpoint — services/api-mcp, behind Caddy. */
const ENDPOINT = 'mcp.sparx.works/v1';

// ── HERO ────────────────────────────────────────────────────────────────────
function AiHero() {
  // This module's own color, full-bleed — the page sells the standout AI/MCP
  // capability, so it gets the one saturated hero on the marketing site. Near-
  // black ink on the bright magenta keeps it ~7:1 legible and tonally connected
  // to the rest of the site (which is built on the same #0A0A0A ink); the spark
  // flips to white so the brand accent still reads against its own color.
  const ink = '#0A0A0A';
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: AI.color,
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '1100px' }}>
          <Display as="h1" size={104} lineHeight={96} color={ink}>
            Bring your
          </Display>
          <Display as="h1" size={104} lineHeight={96} color={ink}>
            own AI
            <Spark color="#FFFFFF" />
          </Display>
        </div>

        <div
          className="mkt-stack-on-tablet mkt-align-end-on-desktop"
          style={{ justifyContent: 'space-between', gap: '40px', maxWidth: '1280px' }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 'clamp(16px, 1.6vw, 20px)',
              lineHeight: 1.55,
              color: 'rgba(10,10,10,0.82)',
              maxWidth: '640px',
              margin: 0,
            }}
          >
            We didn&rsquo;t build you another AI assistant to learn. We opened a direct line so the
            AI you <em>already use</em> &mdash; Claude, ChatGPT, Copilot &mdash; can read and write
            your live business data in plain English, from the same chat you&rsquo;re already in. No
            new tool. No new tab. No exports.
          </p>

          <div
            className="mkt-align-end-on-desktop"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              alignItems: 'flex-start',
            }}
          >
            <div className="mkt-cluster" style={{ gap: '12px' }}>
              <Button size="lg" style={{ backgroundColor: ink }}>
                Connect your AI →
              </Button>
              <a href="#how">
                <Button
                  size="lg"
                  variant="outline"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'rgba(10,10,10,0.28)',
                    color: ink,
                  }}
                >
                  See how it works
                </Button>
              </a>
            </div>
            <span style={{ fontFamily: MONO, fontSize: '12px', color: 'rgba(10,10,10,0.62)' }}>
              Claude · ChatGPT · Copilot · any MCP client
            </span>
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
      <div style={{ maxWidth: '760px' }}>
        <SectionHeader
          accent={AI.color}
          headline={
            <>
              sparx inside your AI &mdash;{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>
                not another AI inside sparx
              </span>
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

      <div className="mkt-grid-2-1" style={{ marginTop: '56px', gap: '24px' }}>
        <ContrastCard
          tone="muted"
          kicker="The usual way"
          title="A new bot to babysit"
          points={usual}
        />
        <ContrastCard
          tone="accent"
          kicker="The sparx way"
          title="A line to the AI you have"
          points={sparx}
        />
      </div>
    </Section>
  );
}

function ContrastCard({
  tone,
  kicker,
  title,
  points,
}: {
  tone: 'muted' | 'accent';
  kicker: string;
  title: string;
  points: string[];
}) {
  const accent = tone === 'accent';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        padding: '32px',
        backgroundColor: 'var(--color-bg-page)',
        border: '1px solid var(--color-border-default)',
        borderTop: `3px solid ${accent ? AI.color : 'var(--color-border-strong, #D4D4D8)'}`,
        borderRadius: '12px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: accent ? AI.text : 'var(--color-text-tertiary)',
          }}
        >
          {kicker}
        </span>
        <h3
          style={{
            margin: 0,
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '22px',
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          {title}
        </h3>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
        {points.map((p) => (
          <li key={p} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
            <span style={{ paddingTop: '7px', flexShrink: 0 }}>
              <Dot color={accent ? AI.color : 'var(--color-text-tertiary)'} size={7} />
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: '23px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {p}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── HOW IT WORKS · three steps + the real endpoint ──────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Activate',
      body: 'Turn on the AI module in your dashboard — one click. It gates the MCP server and tracks which modules your AI can reach.',
    },
    {
      n: '02',
      title: 'Connect',
      body: 'In Settings → AI Integrations, generate a scoped key. Paste it, with the endpoint below, into your assistant once.',
    },
    {
      n: '03',
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

      <div className="mkt-grid-3-2-1" style={{ marginTop: '56px' }}>
        {steps.map((s) => (
          <div
            key={s.n}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '30px 26px 34px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderTop: `3px solid ${AI.color}`,
              borderRadius: '12px',
              minHeight: '210px',
            }}
          >
            <span
              style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '22px',
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '23px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {/* endpoint callout */}
      <div
        className="mkt-stack-on-tablet"
        style={{
          marginTop: '24px',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
          padding: '26px 30px',
          backgroundColor: '#0A0A0A',
          borderRadius: '14px',
          borderTop: `3px solid ${AI.color}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#71717A',
            }}
          >
            One endpoint
          </span>
          <code
            style={{
              fontFamily: MONO,
              fontSize: 'clamp(16px, 2.4vw, 22px)',
              fontWeight: 500,
              color: '#FFFFFF',
              wordBreak: 'break-all',
            }}
          >
            {ENDPOINT}
          </code>
          <span style={{ fontFamily: MONO, fontSize: '12.5px', color: '#A1A1AA' }}>
            Authorization: Bearer sk_live_…
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['Streamable HTTP', 'scoped key', 'any MCP client'].map((t) => (
            <span
              key={t}
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                padding: '5px 11px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.78)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <p
        style={{
          marginTop: '16px',
          fontFamily: SANS,
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-tertiary)',
          maxWidth: '640px',
        }}
      >
        The exact config for each client — Claude, ChatGPT, Copilot — is generated with your real
        key in the dashboard and spelled out step by step in the{' '}
        <a href="/docs" style={{ color: AI.text, fontWeight: 500 }}>
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

      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-page)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 14px 40px rgba(15, 23, 42, 0.06)',
      }}
    >
      {/* window chrome — which assistant this is running in */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 18px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
          <Dot color={AI.color} size={8} />
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: '13px',
              color: 'var(--color-text-primary)',
            }}
          >
            {client}
          </span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: '16px', color: 'var(--color-text-tertiary)' }}>
          +
        </span>
      </div>

      {/* transcript */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px 18px',
        }}
      >
        {/* user turn — right-aligned bubble + the owner's profile avatar */}
        <div
          style={{
            alignSelf: 'flex-end',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            maxWidth: '92%',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-surface)',
              borderRadius: '14px 14px 4px 14px',
              padding: '10px 14px',
              fontFamily: SANS,
              fontSize: '14.5px',
              lineHeight: '22px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
            }}
          >
            {ask}
          </div>
          <UserAvatar />
        </div>

        {/* assistant turn — avatar + bubble + the friendly "Used sparx" receipt */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <ChatAvatar label="AI" accent />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div
              style={{
                backgroundColor: 'var(--color-bg-page)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '14px 14px 14px 4px',
                padding: '10px 14px',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {answer}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                paddingLeft: '2px',
                fontFamily: SANS,
                fontSize: '12px',
                color: confirm ? AI.text : 'var(--color-text-tertiary)',
              }}
            >
              <Dot color={AI.color} size={6} />
              Used sparx · {via}
            </span>
          </div>
        </div>
      </div>

      {/* input bar — the detail that makes it read as a real chat window */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        <span
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '9999px',
            border: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-bg-surface)',
            fontFamily: SANS,
            fontSize: '13px',
            color: 'var(--color-text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Message {client}…
        </span>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            borderRadius: '9999px',
            backgroundColor: AI.color,
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SANS,
            fontSize: '15px',
          }}
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
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: '9999px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        color: 'var(--color-text-tertiary)',
      }}
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
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        borderRadius: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent ? AI.color : 'var(--color-bg-surface)',
        border: accent ? 'none' : '1px solid var(--color-border-default)',
        fontFamily: MONO,
        fontSize: '11px',
        fontWeight: 500,
        color: accent ? '#FFFFFF' : 'var(--color-text-tertiary)',
      }}
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

      <div className="mkt-grid-4-2-1" style={{ marginTop: '52px' }}>
        {groups.map((g) => {
          const c = MODS[g.module];
          return (
            <div
              key={g.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '24px',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '12px',
                minHeight: '156px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  backgroundColor: c.tint,
                }}
              >
                <Dot color={c.color} size={9} />
              </span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {g.label}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  lineHeight: '21px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {g.actions}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── SCOPED & AUDITED · trust (dark) ─────────────────────────────────────────
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
    <section
      style={{
        paddingTop: 'var(--section-py-lg)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container>
        <div style={{ maxWidth: '720px' }}>
          <Display size={56} lineHeight={60} color="#FFFFFF">
            Let AI touch your business — safely
            <Spark color={AI.color} />
          </Display>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '18px',
              lineHeight: '30px',
              color: '#A1A1AA',
              maxWidth: '640px',
              margin: '24px 0 0',
            }}
          >
            Opening a line to your data is only worth it if you stay in control of it. Access is
            scoped, every action is logged, and you can cut it off in a click.
          </p>
        </div>

        <div className="mkt-grid-3-2-1" style={{ marginTop: '56px' }}>
          {items.map((it) => (
            <div
              key={it.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '24px',
                backgroundColor: '#141414',
                border: '1px solid #262626',
                borderRadius: '12px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
                }}
              >
                <Dot color={AI.color} size={8} />
                {it.title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: SANS,
                  fontSize: '13.5px',
                  lineHeight: '21px',
                  color: '#A1A1AA',
                }}
              >
                {it.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
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

      <div className="mkt-grid-4-2-1" style={{ marginTop: '48px' }}>
        {clients.map((c) => (
          <div
            key={c.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '22px 24px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
            }}
          >
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
                color: 'var(--color-text-primary)',
              }}
            >
              {c.name}
            </span>
            <span
              style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}
            >
              {c.note}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ───────────────────────────────────────────────────────────
function AiPricing() {
  return (
    <Section padding="lg">
      <div
        className="mkt-stack-on-tablet"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderTop: `3px solid ${AI.color}`,
          borderRadius: '12px',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '40px',
                letterSpacing: '-0.02em',
                color: 'var(--color-text-tertiary)',
              }}
            >
              +
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '56px',
                letterSpacing: '-0.025em',
                color: 'var(--color-text-primary)',
              }}
            >
              $49
            </span>
            <span
              style={{ fontFamily: SANS, fontSize: '16px', color: 'var(--color-text-tertiary)' }}
            >
              /mo
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'var(--color-text-secondary)',
              margin: 0,
              maxWidth: '640px',
            }}
          >
            A flat $49/mo. Connect any MCP client and read or write live data across every module
            you run — scoped, audited, revocable, all on one bill.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
            Activate AI
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function AiCta() {
  return (
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Your business, in the chat you already use
          <Spark color={AI.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          No new assistant to learn, no migration, no contract. Generate a key, paste it once, and
          ask your own AI anything about your business. Turn it off any time — your data stays.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" variant="solid">
            Connect your AI →
          </Button>
          <a href="/docs">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              Read the connection guide
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
