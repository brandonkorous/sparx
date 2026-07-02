import { Button } from '@sparx/ui';
import { Container, Display, Section, SectionHeader, Spark } from './primitives';

/**
 * The /partners section components (hero, social proof, the opportunity ledger,
 * the numbered how-it-works rail, the directory-CTA split, the dark final CTA).
 * The tiers matrix and the apply form live in their own files; the orchestrator
 * in partners-page.tsx assembles all of them. Platform indigo is the through-line.
 */

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';
const INDIGO = 'var(--sparx-primary)';
const INDIGO_TINT = 'var(--sparx-primary-tint)';
const INDIGO_TEXT = 'var(--sparx-primary-hover)';

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
        backgroundColor: INDIGO_TINT,
        paddingTop: 'clamp(56px, 8vw, 104px)',
        paddingBottom: 'clamp(72px, 10vw, 120px)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div style={{ maxWidth: '15ch' }}>
          <Display as="h1" size={96} lineHeight={94}>
            Build your practice on sparx
            <Spark />
          </Display>
        </div>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 'clamp(17px, 1.7vw, 20px)',
            lineHeight: 1.55,
            color: 'var(--color-text-secondary)',
            maxWidth: '620px',
            margin: 0,
          }}
        >
          Help businesses replace their storefront, CRM, and email stack with one platform &mdash;
          and get paid every time one goes live. No reseller contract. No minimums.
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
            color: INDIGO_TEXT,
          }}
        >
          {earn.map((e) => (
            <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: INDIGO }} />
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
    { num: '8', lab: 'modules your clients can turn on — storefront to AI, one bill.' },
    { num: '$0', lab: "to build a client's whole site — they pay only when it's live." },
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
                  color: 'var(--color-text-primary)',
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
                  color: 'var(--color-text-secondary)',
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
      claim: 'Free to build means an easier close.',
      thin: "You can build a client's entire site before they pay a cent — so the sale is a demo of the finished thing, and churn stays low.",
      token: '$0 to build',
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
        accent={INDIGO}
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
                color: 'var(--color-text-primary)',
              }}
            >
              {r.claim}{' '}
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>
                {r.thin}
              </span>
            </p>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 'clamp(19px, 2.3vw, 28px)',
                fontWeight: 500,
                letterSpacing: '-0.02em',
                color: INDIGO_TEXT,
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
        accent={INDIGO}
        headline={<>How it works</>}
        lede="From application to your first payout, four steps — no gatekeeping, no long onboarding."
      />
      <div className="mkt-steprail" style={{ marginTop: '56px' }}>
        {steps.map((s) => (
          <div key={s.n} className="mkt-step">
            <span
              className="mkt-step-arrow"
              aria-hidden
              style={{ color: 'var(--color-text-tertiary)', fontSize: '20px' }}
            >
              →
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '13px',
                color: INDIGO,
                borderTop: `2px solid ${INDIGO}`,
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
                color: 'var(--color-text-secondary)',
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
          border: '1px solid var(--color-border-default)',
          borderRadius: '18px',
          padding: 'clamp(28px, 4vw, 48px)',
          backgroundColor: 'var(--color-bg-page)',
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
              color: 'var(--color-text-secondary)',
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
                border: '1px solid var(--color-border-default)',
                borderRadius: '12px',
                backgroundColor: 'var(--color-bg-surface)',
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: '15px' }}>{p.name}</span>
              <span
                style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-tertiary)' }}
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
        backgroundColor: cert ? INDIGO_TINT : '#ECFEFF',
        color: cert ? INDIGO_TEXT : '#0E7490',
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
          <Spark color={INDIGO} />
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
