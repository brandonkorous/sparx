import { Button } from '@wizeworks/silicaui-react';
import { badgeClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display, Section, SectionHeader, Spark } from './primitives';

/**
 * The /partners section components (hero, social proof, the opportunity ledger,
 * the how-it-works rail, the directory-CTA split, the dark final CTA).
 * The tiers matrix and the apply form live in their own files; the orchestrator
 * in partners-page.tsx assembles all of them. Platform Ember is the through-line.
 *
 * Class-based per SILICA-VOCABULARY.md: the Ember tint is silica's own
 * `bg-primary bg-soft` treatment, ink comes from `text-ink-muted`/`text-primary`,
 * and the dark final CTA is a `<Section surface="dark">` island rather than a
 * hand-painted near-black with hand-picked white/grey partners.
 */

const EMBER = 'var(--color-primary)';

// ── HERO ────────────────────────────────────────────────────────────────────
export function PartnersHero() {
  const earn = [
    '20–30% first-payment commission',
    '5% ongoing on managed accounts',
    'earn on every client that publishes',
  ];
  return (
    <section className="bg-primary bg-soft px-page pt-[clamp(56px,8vw,104px)] pb-[clamp(72px,10vw,120px)]">
      <Container className="flex flex-col gap-7">
        <div className="max-w-[820px]">
          <Display as="h1" size={96} lineHeight={94}>
            Build your practice
            <br />
            on sparx
            <Spark />
          </Display>
        </div>
        <p className="text-ink-muted max-w-[620px] text-[clamp(17px,1.7vw,20px)] leading-[1.55]">
          Help businesses replace their site, CRM, and email stack with one platform &mdash; and get
          paid every time one goes live. No reseller contract. No minimums.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#apply">
            <Button size="lg">Apply to become a partner →</Button>
          </a>
          <a href="/partners/directory">
            <Button size="lg" variant="outline">
              Browse the partner directory
            </Button>
          </a>
        </div>
        <div className="text-primary text-mini mt-3 flex flex-wrap gap-x-[26px] gap-y-2.5 font-mono">
          {earn.map((e) => (
            <span key={e} className="inline-flex items-center gap-2">
              <span className="bg-primary size-[7px] shrink-0 rounded-full" />
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
    <Section surface="surface" padding="md" className="py-0!" bleed>
      <Container>
        <div className="mkt-proof-3">
          {cells.map((c) => (
            <div key={c.lab} className="px-7 py-[clamp(28px,4vw,44px)]">
              <div className="text-[clamp(30px,4vw,44px)] font-medium tracking-[-0.03em]">
                {c.num === 'Be first.' ? (
                  <>
                    Be first
                    <Spark />
                  </>
                ) : (
                  c.num
                )}
              </div>
              <div className="text-ink-muted text-small mt-2 max-w-[300px]">{c.lab}</div>
            </div>
          ))}
        </div>
      </Container>
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
      <div className="mt-12">
        {rows.map((r) => (
          <div key={r.token} className="mkt-opp-row">
            <p className="m-0 max-w-[720px] text-[clamp(19px,2.2vw,25px)] leading-[1.35] font-medium tracking-[-0.02em]">
              {r.claim} <span className="text-ink-muted font-normal">{r.thin}</span>
            </p>
            <span className="text-primary text-[clamp(19px,2.3vw,28px)] font-medium tracking-[-0.02em] whitespace-nowrap">
              {r.token}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── HOW IT WORKS · rail ─────────────────────────────────────────────────────
export function PartnersSteps() {
  const steps = [
    {
      t: 'Apply',
      d: 'Submit your application. Informal partners are approved instantly; registered and certified go to a quick review.',
    },
    {
      t: 'Build',
      d: 'Get your partner dashboard. Manage client accounts, track referrals, and grab the pitch deck and proposal templates.',
    },
    {
      t: 'Refer',
      d: 'Bring clients onto sparx with your referral link. When they publish and pay, you earn — automatically attributed.',
    },
    {
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
      <div className="mkt-steprail mt-14">
        {steps.map((s) => (
          <div key={s.t} className="mkt-step">
            <span className="mkt-step-arrow text-ink-subtle text-h4" aria-hidden>
              →
            </span>
            {/* The rail's column marker: the 2px Ember rule delineates each step's
                track. The old `01`/`02` numerals above the heading were step
                markers — an eyebrow by another name — and are gone. */}
            <span className="border-primary block w-10 border-t-2" aria-hidden />
            <h3 className="text-h4 mt-3.5 font-medium tracking-[-0.02em]">{s.t}</h3>
            <p className="text-ink-muted text-small mt-2.5">{s.d}</p>
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
    { name: <span className="font-medium">Northlight Studio</span>, loc: 'Remote' },
    { name: <Chip label="Registered" tone="reg" />, loc: 'Portland, OR' },
  ];
  return (
    <Section surface="surface" padding="lg">
      <div className="mkt-dircta border-base-300 bg-base-200 rounded-[18px] border p-[clamp(28px,4vw,48px)]">
        <div>
          <h3 className="text-[clamp(24px,3vw,34px)] leading-[1.1] font-medium tracking-[-0.025em]">
            Looking for a partner, not a program?
          </h3>
          <p className="text-ink-muted text-body mt-4 max-w-[460px]">
            If you&rsquo;re a business that wants help getting set up on sparx, browse certified
            partners by location and specialty and reach out directly.
          </p>
          <a href="/partners/directory" className="mt-6 inline-block">
            <Button color="neutral" size="lg">
              Find a partner →
            </Button>
          </a>
        </div>
        <div className="flex flex-col gap-2.5">
          {preview.map((p, i) => (
            <div
              key={i}
              className="border-base-300 bg-base-100 flex items-center justify-between gap-3.5 rounded-xl border px-[18px] py-3.5"
            >
              <span className="text-body-sm">{p.name}</span>
              <span className="text-ink-subtle text-caption">{p.loc}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Directory tier chip — a real silica badge, not a hand-rolled fill + ink pair. */
function Chip({ label, tone }: { label: string; tone: 'cert' | 'reg' }) {
  return (
    <span
      className={badgeClasses({
        color: tone === 'cert' ? 'primary' : 'info',
        variant: 'soft',
        size: 'sm',
      })}
    >
      {label}
    </span>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
export function PartnersFinalCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-[26px]">
        <Display size={78} lineHeight={76}>
          Start earning on sparx
          <Spark color={EMBER} />
        </Display>
        <p className="text-ink-muted text-lede max-w-[560px]">
          Apply in two minutes. Refer your first client this week. Get paid when they go live.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <a href="#apply">
            <Button size="xl">Apply to become a partner →</Button>
          </a>
          <a href="/partners/directory">
            <Button size="xl" variant="outline">
              Browse the directory
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
