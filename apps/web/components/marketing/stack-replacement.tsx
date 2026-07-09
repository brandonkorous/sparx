import { Button } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Spark } from './primitives';
import { Reveal } from './reveal';

// "Six tabs. One bill." — the cost/fragmentation beat, built as a PAS argument
// (docs/learnings/landing-page-sections.md §7, §14): name the pain, show its real
// cost, hand over the fix. The device is a SWAP LEDGER, not two disconnected
// lists — each line maps the JOB a tool does for you today to the sparx module
// that absorbs it, so the replacement is *shown*, not told. Framing is
// category-led (no competitor brand tiles) so it stays durable and non-defensive.
// Sits on the recessed ground tier (.mkt-ground): the fragmented "before" is the
// floor the clean receipt lifts off of.

const SIGNUP = 'https://app.sparx.works/sign-up?ref=stack';

interface Swap {
  today: string;
  todayNote: string;
  todayPrice: number | null;
  module: string;
  modulePrice: number;
  color: string;
}

// Left: realistic market rates for each job. Right: real sparx module prices
// (the modules catalog). Totals are computed below, never asserted — "show your
// math" so the savings read audited, not made up.
//
// Every job is a NATIVE module, so the right column reads "Built in" for all rows
// rather than re-listing six module names (which would re-fragment the very thing
// the section collapses — six tabs into one). `module` stays as data: it labels
// the row for screen readers and keeps the per-module display one render-swap away;
// `color` rides along for that same fallback.
const SWAP: Swap[] = [
  {
    today: 'Online store + checkout',
    todayNote: 'storefront, cart, payments',
    todayPrice: 399,
    module: 'Commerce',
    modulePrice: 49,
    color: '#F97316',
  },
  {
    today: 'CRM + marketing',
    todayNote: 'contacts, pipeline, automations',
    todayPrice: 1600,
    module: 'CRM',
    modulePrice: 49,
    color: '#06B6D4',
  },
  {
    today: 'Email platform',
    todayNote: 'sending, lists, deliverability',
    todayPrice: 350,
    module: 'Email',
    modulePrice: 29,
    color: '#0EA5E9',
  },
  {
    today: 'CMS + blog',
    todayNote: 'content, media, SEO',
    todayPrice: 180,
    module: 'CMS',
    modulePrice: 49,
    color: '#14B8A6',
  },
  {
    today: 'Automation glue',
    todayNote: 'the wiring between apps',
    todayPrice: 240,
    module: 'Automation',
    modulePrice: 0,
    color: 'var(--color-success)',
  },
  {
    today: 'Site + hosting',
    todayNote: 'usually bundled, never free',
    todayPrice: null,
    module: 'Builder',
    modulePrice: 10,
    color: '#6366F1',
  },
];

const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
const beforeTotal = SWAP.reduce((sum, r) => sum + (r.todayPrice ?? 0), 0);
const afterTotal = SWAP.reduce((sum, r) => sum + r.modulePrice, 0);
const saveYear = (beforeTotal - afterTotal) * 12;

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 500,
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
};
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '13px' };

export function StackReplacement() {
  return (
    <Section id="platform" padding="lg" className="mkt-ground">
      <Reveal className="mkt-stack-split">
        <div className="mkt-stack-copy">
          <SectionHeader
            headline={
              <>
                Six tabs.
                <br />
                One bill
                <Spark />
              </>
            }
            lede={
              <>
                A tab for your store, another for email, a CRM that talks to neither, and an
                automation bill quietly holding it together. You&apos;re paying for the seams — and
                still can&apos;t pull one honest report. sparx is the whole stack on one data layer.
              </>
            }
          />
          <LedgerActions />
        </div>
        <SwapLedger />
      </Reveal>
    </Section>
  );
}

// The receipt: column labels → one swap row per job → totals → the savings bottom
// line. A surface card lifting off the recessed ground tier.
function SwapLedger() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        className="mkt-swap-row mkt-swap-head"
        style={{
          padding: '13px 24px',
          backgroundColor: 'var(--color-base-200)',
          borderBottom: '1px solid var(--color-base-300)',
        }}
      >
        <span style={LABEL}>Your stack today</span>
        <span aria-hidden />
        <span style={LABEL}>On sparx</span>
      </div>

      {SWAP.map((row, i) => (
        <SwapRow key={row.today} row={row} isLast={i === SWAP.length - 1} />
      ))}

      <div
        className="mkt-swap-row"
        style={{
          borderTop: '2px solid color-mix(in oklab, var(--color-base-content) 30%, transparent)',
        }}
      >
        <div className="mkt-swap-cell">
          <span style={{ ...LABEL, color: 'var(--color-base-content)' }}>Total today</span>
          <span style={{ ...MONO, fontSize: '15px', color: 'var(--color-danger)' }}>
            {fmt(beforeTotal)}/mo
          </span>
        </div>
        <Arrow />
        <div className="mkt-swap-cell">
          <span style={{ ...LABEL, color: 'var(--color-base-content)' }}>One bill</span>
          <span style={{ ...MONO, fontSize: '15px', color: 'var(--color-primary)' }}>
            {fmt(afterTotal)}/mo
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '6px 24px',
          padding: '20px 24px',
          backgroundColor: 'color-mix(in oklab, var(--color-success) 15%, var(--color-base-100))',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: 'clamp(22px, 3vw, 30px)',
            letterSpacing: '-0.02em',
            color: 'var(--color-success)',
          }}
        >
          You save {fmt(saveYear)} a year
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          Pay only for the modules you switch on
        </span>
      </div>
    </div>
  );
}

function LedgerActions() {
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'flex-start' }}
    >
      <div className="mkt-cluster" style={{ gap: '12px' }}>
        <Button size="lg" color="primary" variant="solid" render={<a href={SIGNUP} />}>
          Start my site free →
        </Button>
        <Button size="lg" variant="outline" render={<a href="/pricing" />}>
          See the full price list
        </Button>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        No card · cancel anytime · switch a module off and its bill stops
      </span>
    </div>
  );
}

function SwapRow({ row, isLast }: { row: Swap; isLast: boolean }) {
  return (
    <div
      className="mkt-swap-row"
      style={{ borderBottom: isLast ? undefined : '1px solid #F4F4F5' }}
    >
      <div className="mkt-swap-cell">
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '14px',
              color: 'var(--color-base-content)',
            }}
          >
            {row.today}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {row.todayNote}
          </span>
        </span>
        <span
          style={{
            ...MONO,
            flexShrink: 0,
            color: row.todayPrice
              ? 'color-mix(in oklab, var(--color-base-content) 70%, transparent)'
              : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          {row.todayPrice ? `${fmt(row.todayPrice)}/mo` : '—'}
        </span>
      </div>

      <Arrow />

      <div className="mkt-swap-cell">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{ flexShrink: 0, color: 'var(--color-primary)' }}
          >
            <path d="M5 12L10 17L19 7" stroke="currentColor" strokeWidth={2.6} />
          </svg>
          <span
            aria-label={`${row.module}, built into sparx`}
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '14px',
              color: 'var(--color-base-content)',
            }}
          >
            Built in
          </span>
        </span>
        <span
          style={{
            ...MONO,
            flexShrink: 0,
            color: row.modulePrice
              ? 'color-mix(in oklab, var(--color-base-content) 70%, transparent)'
              : 'var(--color-success)',
          }}
        >
          {row.modulePrice ? `+${fmt(row.modulePrice)}/mo` : '$0'}
        </span>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <span className="mkt-swap-arrow" aria-hidden>
      <svg width={22} height={12} viewBox="0 0 22 12" fill="none">
        <path d="M0 6H19M19 6L14 1M19 6L14 11" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    </span>
  );
}
