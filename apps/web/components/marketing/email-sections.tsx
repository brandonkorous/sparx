import { Button } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The markup-heavy structural devices for the /email page, split out of
 * email-page.tsx so each file stays cohesive:
 *
 *  - EmailHero ........... tinted-band hero: split copy + a RENDERED BRANDED
 *    EMAIL PREVIEW (sender on the tenant's OWN domain, body from atomic
 *    components, an open/click/DKIM pulse) that crossfades through
 *    EXAMPLE_BUSINESSES — email reads as the same engine for ANY business.
 *  - EmailPipeline ...... the event-driven architecture as a 4-stage rail:
 *    a platform event → email.send → render → delivered from your domain.
 *  - EmailKinds ......... transactional vs marketing as a two-panel split,
 *    each with its real trigger flow — same engine, same reputation.
 *  - EmailDeliverability  the sender-health checklist (SPF·DKIM·DMARC Pass)
 *    beside the auto-configured DNS records panel — the real "Sending
 *    domains" surface.
 *
 * Grounded in docs/13 (Email PRD) + the real dashboard email surfaces (sender
 * health rows, domain states, broadcast vocabulary). Outbound is event-driven
 * (`email.send` → email-worker → @sparx/email React Email render → provider);
 * sends from the tenant's own domain after DKIM/SPF/DMARC verify. Email sky is
 * a deliverability signal, not flood fill.
 */

const E = getModuleColor('email');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── HERO ────────────────────────────────────────────────────────────────────
export function EmailHero() {
  const lede =
    'Transactional and marketing email, sent from your own domain and your reputation. Every message is triggered by a real platform event, rendered on-brand, and authenticated with SPF, DKIM, and DMARC the moment your domain verifies. No per-email markup — one flat price.';
  const chips = [
    'your own domain',
    'SPF · DKIM · DMARC',
    'transactional + marketing',
    'no per-email fees',
  ];
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: E.tint,
      }}
    >
      <Container>
        <div
          className="mkt-stack-on-tablet"
          style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Display as="h1" size={84} lineHeight={80}>
              Email on your own domain
              <Spark color={E.color} />
            </Display>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                maxWidth: '560px',
                margin: '28px 0 0',
              }}
            >
              {lede}
            </p>
            <div className="mkt-cluster" style={{ gap: '12px', marginTop: '34px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Activate Email →
              </Button>
              <a href="#pipeline">
                <Button size="lg" variant="outline">
                  See how a send flows
                </Button>
              </a>
            </div>
            <ul
              className="mkt-cluster"
              style={{ gap: '10px', marginTop: '26px', listStyle: 'none', padding: 0 }}
            >
              {chips.map((c) => (
                <li
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 13px',
                    backgroundColor: 'var(--color-base-100)',
                    border: '1px solid var(--color-base-300)',
                    borderRadius: '9999px',
                  }}
                >
                  <Dot color={E.color} size={6} />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: '12px',
                      color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                    }}
                  >
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div
            id="preview"
            style={{ flex: 1, minWidth: 0, width: '100%', scrollMarginTop: '80px' }}
          >
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <EmailPreviewCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — a real branded email in the inbox: sent
 *  from the business's OWN domain, body composed from atomic components, with an
 *  open/click/DKIM pulse. Crossfades through EXAMPLE_BUSINESSES; every scene has
 *  the same shape so the card never reflows. */
function EmailPreviewCard({ business }: { business: ExampleBusiness }) {
  const { email, name } = business;
  const initials = name
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '16px',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '12px 18px',
          backgroundColor: 'var(--color-base-200)',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: '#E4E4E7' }}
          />
        ))}
        <span
          style={{
            marginLeft: '8px',
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          inbox · {name}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          padding: '18px 22px',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: '9999px',
            backgroundColor: E.tint,
            border: `1.5px solid ${E.color}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '14px',
            color: E.text,
          }}
        >
          {initials}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SANS, fontWeight: 500, fontSize: '14.5px' }}>
            {email.transactional.subject}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: '12px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {email.sender} · to you · just now
          </span>
        </span>
      </div>
      <div style={{ padding: '22px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-base-200)',
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: '7px',
              backgroundColor: E.tint,
              border: `1px solid ${E.color}`,
            }}
          />
          <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>{name}</span>
        </div>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '14px',
            lineHeight: '23px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            margin: '16px 0 0',
          }}
        >
          {email.previewLine}
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '14px',
            lineHeight: '23px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            margin: '10px 0 0',
          }}
        >
          Tap below for the details — questions? Just reply to this email.
        </p>
        <span
          style={{
            display: 'inline-block',
            padding: '10px 18px',
            borderRadius: '8px',
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: '13px',
            color: '#FFFFFF',
            backgroundColor: E.color,
            marginTop: '16px',
          }}
        >
          View the details
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: '1px solid var(--color-base-300)',
        }}
      >
        {[
          [email.openRate, 'open rate'],
          [email.clickRate, 'click rate'],
          ['✓', 'DKIM signed'],
        ].map(([v, l], i) => (
          <div
            key={l}
            style={{
              padding: '13px 18px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-base-200)',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
                color: i === 2 ? E.text : 'var(--color-base-content)',
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: '10.5px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                marginTop: '2px',
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PIPELINE (event-driven architecture) ────────────────────────────────────
export function EmailPipeline() {
  const stages = [
    {
      n: '01 · trigger',
      title: 'A platform event fires',
      body: 'An order is paid, a cart is abandoned, a quote is sent — or you hit send on a broadcast.',
    },
    {
      n: '02 · queue',
      title: 'email.send is published',
      body: 'The event lands on a durable queue with retries — nothing is sent inline, nothing is lost.',
    },
    {
      n: '03 · render',
      title: 'Your template renders',
      body: 'A worker composes the message from atomic React Email components — HTML and plain text together.',
    },
    {
      n: '04 · deliver',
      title: 'Sent from your domain',
      body: 'Signed with your DKIM key and delivered to the inbox, with open, click, and bounce tracked back.',
    },
  ];
  return (
    <Section id="pipeline" surface="surface" padding="lg">
      <SectionHeader
        accent={E.color}
        headline="Every email is an event, not a blast"
        lede="Outbound mail is event-driven. A platform event publishes email.send; a worker renders your template and delivers it from your verified domain — the same path for an order receipt or a six-thousand-person broadcast."
      />
      <div
        className="mkt-pipeline"
        style={{ marginTop: '52px', backgroundColor: 'var(--color-base-100)' }}
      >
        {stages.map((s) => (
          <div key={s.n} className="mkt-stage" style={{ padding: '28px 24px' }}>
            <span
              style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: E.text }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: '14px 0 8px',
                fontFamily: SANS,
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13px',
                lineHeight: '20px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
