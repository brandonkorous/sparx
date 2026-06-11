import type { ReactNode } from 'react';
import { Button } from '@sparx/ui';
import {
  CAPABILITY_AREAS,
  STATUS_META,
  capabilityCounts,
  type Capability,
  type CapabilityArea,
  type CapabilityStatus,
} from '@/lib/capabilities';
import { Container, Display, Dot, Section, SectionHeader, Spark } from './primitives';

/**
 * The /features marketing page — the answer to "what do I actually get?".
 *
 * The rest of the site sells the 11 headline modules. This page exists to show
 * the *breadth* underneath them: every shipped capability, everything in build,
 * and what's on the roadmap — rendered straight from `lib/capabilities.ts` so the
 * counts in the hero can never disagree with the list below them.
 *
 * Deliberately distinct from /platform (which explains how the system works) and
 * the home page (which sells the cost story). This page is a scannable index of
 * sheer surface area. Built on the marketing primitives; module areas reuse their
 * brand color, cross-cutting platform areas carry their own accent.
 */

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

export function FeaturesPage() {
  const counts = capabilityCounts();
  const modules = CAPABILITY_AREAS.filter((a) => a.module);
  const platform = CAPABILITY_AREAS.filter((a) => !a.module);

  return (
    <>
      <FeaturesHero counts={counts} />

      <Section padding="lg">
        <SectionHeader
          accent="var(--sparx-primary)"
          headline={
            <>
              Eleven modules.{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>Activate any combination</span>
            </>
          }
          lede={
            <>
              Each module is a deep product in its own right — and switching one on costs nothing
              until you use it. Turn it off and it stops billing the same day; the data stays put.
            </>
          }
        />
        <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {modules.map((area) => (
            <AreaBlock key={area.id} area={area} />
          ))}
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <SectionHeader
          accent="var(--sparx-primary)"
          headline={
            <>
              The platform underneath.{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>Included with every plan</span>
            </>
          }
          lede={
            <>
              Search, automation, multi-site, security, SEO, domains — the foundation every module
              shares. You don&apos;t buy these. They&apos;re just on.
            </>
          }
        />
        <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {platform.map((area) => (
            <AreaBlock key={area.id} area={area} surface />
          ))}
        </div>
      </Section>

      <FeaturesCta />
    </>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────
function FeaturesHero({ counts }: { counts: ReturnType<typeof capabilityCounts> }) {
  const metrics = [
    { v: String(counts.live), suffix: '+', s: 'capabilities live today', spark: true },
    { v: String(counts.building), s: 'more in active build' },
    { v: String(counts.modules), s: 'activatable modules' },
    { v: '1', s: 'shared data layer' },
    { v: '1', s: 'bill, cancel anytime' },
  ] as const;

  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-page)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <div style={{ maxWidth: '1100px' }}>
          <Display as="h1" size={96} lineHeight={90}>
            You don&apos;t buy modules.{' '}
            <span style={{ color: 'var(--color-text-tertiary)' }}>
              You get everything inside them
              <Spark />
            </span>
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
              color: 'var(--color-text-secondary)',
              maxWidth: '620px',
              margin: 0,
            }}
          >
            The pricing page lists modules. This is what&apos;s actually inside them —{' '}
            {counts.live} shipped capabilities, {counts.building} more in build, and{' '}
            {counts.planned} on the roadmap. One platform replaces a stack of six or eight separate
            tools, and every piece reads and writes the same data.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="mkt-cluster" style={{ gap: '12px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Start free →
              </Button>
              <a href="/pricing">
                <Button size="lg" variant="outline">
                  See pricing
                </Button>
              </a>
            </div>
            <span style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              No credit card · Live in five minutes
            </span>
          </div>
        </div>

        {/* metric row */}
        <div
          className="mkt-cluster"
          style={{
            justifyContent: 'space-between',
            paddingTop: '32px',
            marginTop: '8px',
            borderTop: '1px solid var(--color-border-default)',
            gap: '32px 56px',
          }}
        >
          {metrics.map((m) => (
            <div key={m.s} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: '26px',
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text-primary)',
                }}
              >
                {m.v}
                {'suffix' in m && m.suffix ? (
                  <span
                    style={{ color: 'var(--color-text-tertiary)', fontWeight: 400, fontSize: '16px' }}
                  >
                    {m.suffix}
                  </span>
                ) : null}
                {'spark' in m && m.spark ? <Spark /> : null}
              </span>
              <span style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {m.s}
              </span>
            </div>
          ))}
        </div>

        <StatusLegend />
      </Container>
    </section>
  );
}

function StatusLegend() {
  const order: CapabilityStatus[] = ['live', 'building', 'planned'];
  return (
    <div className="mkt-cluster" style={{ gap: '20px' }}>
      {order.map((s) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Dot color={STATUS_META[s].color} size={8} />
          <span style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {STATUS_META[s].label}
          </span>
        </span>
      ))}
    </div>
  );
}

// ── AREA BLOCK ───────────────────────────────────────────────────────────────
function AreaBlock({ area, surface }: { area: CapabilityArea; surface?: boolean }) {
  const liveN = area.capabilities.filter((c) => c.status === 'live').length;
  const total = area.capabilities.length;

  return (
    <div
      id={area.id}
      style={{
        backgroundColor: surface ? 'var(--color-bg-page)' : 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderTop: `3px solid ${area.accent}`,
        borderRadius: '12px',
        padding: '28px',
        scrollMarginTop: '88px',
      }}
    >
      <div className="mkt-stack-on-tablet" style={{ gap: '32px' }}>
        {/* header column */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Dot color={area.accent} size={10} />
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.02em',
                color: 'var(--color-text-primary)',
              }}
            >
              {area.name}
            </h3>
          </div>
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '21px',
              color: 'var(--color-text-secondary)',
            }}
          >
            {area.summary}
          </p>
          <div
            style={{
              marginTop: '16px',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '6px',
              fontFamily: MONO,
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{total}</span>
            capabilities
            <span style={{ color: 'var(--color-text-tertiary)' }}>· {liveN} live</span>
          </div>
        </div>

        {/* capability chips */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignContent: 'flex-start',
          }}
        >
          {area.capabilities.map((cap) => (
            <CapabilityChip key={cap.name} cap={cap} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CapabilityChip({ cap }: { cap: Capability }) {
  const meta = STATUS_META[cap.status];
  const muted = cap.status === 'planned';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 13px',
        borderRadius: '9999px',
        border: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-page)',
        fontFamily: SANS,
        fontSize: '13px',
        fontWeight: 400,
        color: muted ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
      }}
      title={meta.label}
    >
      <Dot color={meta.color} size={7} />
      {cap.name}
    </span>
  );
}

// ── CTA ──────────────────────────────────────────────────────────────────────
function FeaturesCta(): ReactNode {
  return (
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-page)',
        borderTop: '1px solid var(--color-border-default)',
        textAlign: 'center',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <Display size={64} lineHeight={64}>
          Start with one. The rest is already built
          <Spark />
        </Display>
        <p
          style={{
            margin: '22px 0 34px',
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: 'var(--color-text-secondary)',
            maxWidth: '580px',
          }}
        >
          Switch on a single module from $10/mo and get a live site in five minutes. Everything on
          this page is waiting the moment you need it — no migration, no replatform, no goodbyes.
        </p>
        <div className="mkt-cluster" style={{ gap: '14px', justifyContent: 'center' }}>
          <Button size="xl" style={{ backgroundColor: '#0A0A0A' }}>
            Start free
          </Button>
          <a href="/platform">
            <Button size="xl" variant="outline">
              How it works
            </Button>
          </a>
        </div>
        <span style={{ marginTop: '22px', fontFamily: MONO, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
          No credit card · Cancel anytime · Your data, always exportable
        </span>
      </Container>
    </section>
  );
}
