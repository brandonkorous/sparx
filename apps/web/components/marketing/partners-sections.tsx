import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Section, SectionHeader, Spark } from './primitives';

/**
 * The /partners section components (hero, social proof, the opportunity ledger,
 * the numbered how-it-works rail, the directory-CTA split, the dark final CTA).
 * The tiers matrix and the apply form live in their own files; the orchestrator
 * in partners-page.tsx assembles all of them. Platform Ember is the through-line.
 */

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
const EMBER = 'var(--color-primary)';
const EMBER_TINT = 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))';
const EMBER_TEXT = 'var(--color-primary)';

// ── HERO ────────────────────────────────────────────────────────────────────
export function PartnersHero() {
  const earn = [
    '20–30% first-payment commission',
    '5% ongoing on managed accounts',
    'earn on every client that publishes',
  ];
  return (
    <section
      style={{
        backgroundColor: EMBER_TINT,
        paddingTop: 'clamp(56px, 8vw, 104px)',
        paddingBottom: 'clamp(72px, 10vw, 120px)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ maxWidth: '820px' }}>
          <Display as="h1" size={96} lineHeight={94}>
            Build your practice
            <br />
            on sparx
            <Spark />
          </Display>
        </div>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 'clamp(17px, 1.7vw, 20px)',
            lineHeight: 1.55,
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            maxWidth: '620px',
            margin: 0,
          }}
        >
          Help businesses replace their site, CRM, and email stack with one platform &mdash; and get
          paid every time one goes live. No reseller contract. No minimums.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="#apply">
            <Button size="lg">Apply to become a partner →</Button>
          </a>
          <a href="/partners/directory">
            <Button size="lg" variant="outline">
              Browse the partner directory
            </Button>
          </a>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 26px',
            marginTop: '12px',
            fontFamily: MONO,
            fontSize: '12.5px',
            color: EMBER_TEXT,
          }}
        >
          {earn.map((e) => (
            <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: EMBER }} />
              {e}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ── SOCIAL PROOF STRIP (empty-safe) ─────────────────────────────────────────
export function PartnersProof({ partnerCount }: { partnerCount?: number }) {
  const has = typeof partnerCount === 'number' && partnerCount > 0;
  const lead = has
    ? { num: String(partnerCount), lab: 'partners building their practice on sparx today.' }
    : { num: 'Be first.', lab: 'The program is opening now — founding partners set the pace.' };
  const cells = [
    lead,
    { num: '8', lab: 'modules your clients can turn on — site to AI, one bill.' },
    {
      num: '14 days',
      lab: "free on sparx — start building a client's site the day you sign them.",
    },
  ];
  return (
    <Section surface="surface" padding="md" style={{ paddingTop: 0, paddingBottom: 0 }} bleed>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%' }}>
        <div className="mkt-proof-3">
          {cells.map((c) => (
            <div key={c.lab} style={{ padding: 'clamp(28px, 4vw, 44px) 28px' }}>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(30px, 4vw, 44px)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-base-content)',
                }}
              >
                {c.num === 'Be first.' ? (
                  <>
                    Be first
                    <Spark />
                  </>
                ) : (
                  c.num
                )}
              </div>
              <div
                style={{
                  fontFamily: SANS,
                  fontSize: '14px',
                  lineHeight: '21px',
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  marginTop: '8px',
                  maxWidth: '300px',
                }}
              >
                {c.lab}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ── THE OPPORTUNITY · argument ledger ───────────────────────────────────────
export function PartnersOpportunity() {
  const rows: { claim: React.ReactNode; thin: string; token: string }[] = [
    {
      claim: 'sparx replaces five tools at once.',
      thin: 'Every client you bring on sees immediate, visible ROI against what they were already paying for a store, a CRM, and an email tool.',
      token: '5 tools → 1',
    },
    {
      claim: 'A free trial makes an easier close.',
      thin: "Spin up a client's site on a 14-day free trial — so your pitch is a demo of the real thing, not a slide deck, and churn stays low.",
      token: '14-day trial',
    },
    {
      claim: 'You earn on every subscription — and keep earning.',
      thin: 'Commission on the first payment, plus ongoing revenue on managed accounts for as long as the client stays.',
      token: 'once + ongoing',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={EMBER}
        headline={<>An easier sale, and a better one</>}
        lede="sparx pays you to do what you already do — set businesses up right. Three reasons the math works in your favor."
      />
      <div style={{ marginTop: '48px' }}>
        {rows.map((r) => (
          <div key={r.token} className="mkt-opp-row">
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: 'clamp(19px, 2.2vw, 25px)',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                lineHeight: 1.35,
                maxWidth: '720px',
                color: 'var(--color-base-content)',
              }}
            >
              {r.claim}{' '}
              <span
                style={{
                  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  fontWeight: 400,
                }}
              >
                {r.thin}
              </span>
            </p>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 'clamp(19px, 2.3vw, 28px)',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: EMBER_TEXT,
                whiteSpace: 'nowrap',
              }}
            >
              {r.token}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HOW IT WORKS · numbered rail ────────────────────────────────────────────
export function PartnersSteps() {
  const steps = [
    {
      n: '01',
      t: 'Apply',
      d: 'Submit your application. Informal partners are approved instantly; registered and certified go to a quick review.',
    },
    {
      n: '02',
      t: 'Build',
      d: 'Get your partner dashboard. Manage client accounts, track referrals, and grab the pitch deck and proposal templates.',
    },
    {
      n: '03',
      t: 'Refer',
      d: 'Bring clients onto sparx with your referral link. When they publish and pay, you earn — automatically attributed.',
    },
    {
      n: '04',
      t: 'Grow',
      d: 'Hit activity thresholds to advance tiers. Higher tiers unlock higher commission and exclusive resources.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={EMBER}
        headline={<>How it works</>}
        lede="From application to your first payout, four steps — no gatekeeping, no long onboarding."
      />
      <div className="mkt-steprail" style={{ marginTop: '56px' }}>
        {steps.map((s) => (
          <div key={s.n} className="mkt-step">
            <span
              className="mkt-step-arrow"
              aria-hidden
              style={{
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                fontSize: '20px',
              }}
            >
              →
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '13px',
                color: EMBER,
                borderTop: `2px solid ${EMBER}`,
                paddingTop: '14px',
                display: 'inline-block',
                width: '40px',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: '14px 0 0',
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.02em',
              }}
            >
              {s.t}
            </h3>
            <p
              style={{
                margin: '10px 0 0',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {s.d}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── DIRECTORY CTA · split band ──────────────────────────────────────────────
export function PartnersDirectoryCta() {
  const preview = [
    { name: <Chip label="Certified" tone="cert" />, loc: 'Austin, TX' },
    { name: <span style={{ fontWeight: 500 }}>Northlight Studio</span>, loc: 'Remote' },
    { name: <Chip label="Registered" tone="reg" />, loc: 'Portland, OR' },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div
        className="mkt-dircta"
        style={{
          border: '1px solid var(--color-base-300)',
          borderRadius: '18px',
          padding: 'clamp(28px, 4vw, 48px)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 'clamp(24px, 3vw, 34px)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            Looking for a partner, not a program?
          </h3>
          <p
            style={{
              margin: '16px 0 0',
              fontFamily: SANS,
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              maxWidth: '460px',
            }}
          >
            If you&rsquo;re a business that wants help getting set up on sparx, browse certified
            partners by location and specialty and reach out directly.
          </p>
          <a href="/partners/directory" style={{ display: 'inline-block', marginTop: '24px' }}>
            <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
              Find a partner →
            </Button>
          </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {preview.map((p, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                padding: '14px 18px',
                border: '1px solid var(--color-base-300)',
                borderRadius: '12px',
                backgroundColor: 'var(--color-base-100)',
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: '15px' }}>{p.name}</span>
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: '13px',
                  color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {p.loc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Chip({ label, tone }: { label: string; tone: 'cert' | 'reg' }) {
  const cert = tone === 'cert';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontFamily: SANS,
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: cert ? EMBER_TINT : '#ECFEFF',
        color: cert ? EMBER_TEXT : '#0E7490',
      }}
    >
      {label}
    </span>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
export function PartnersFinalCta() {
  return (
    <section
      style={{
        backgroundColor: '#0A0A0A',
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '26px', alignItems: 'flex-start' }}
      >
        <Display size={78} lineHeight={76} color="#FFFFFF">
          Start earning on sparx
          <Spark color={EMBER} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: 1.6,
            color: '#A1A1AA',
            maxWidth: '560px',
            margin: 0,
          }}
        >
          Apply in two minutes. Refer your first client this week. Get paid when they go live.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px', marginTop: '10px' }}>
          <a href="#apply">
            <Button size="xl">Apply to become a partner →</Button>
          </a>
          <a href="/partners/directory">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              Browse the directory
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
