import type { ReactNode } from 'react';
import { Button, Heading, Status, Text } from '@wizeworks/silicaui-react';
import { buttonClasses, cx } from '@wizeworks/silicaui-react/server';
import {
  CAPABILITY_AREAS,
  STATUS_META,
  capabilityCounts,
  type Capability,
  type CapabilityArea,
  type CapabilityStatus,
} from '@/lib/capabilities';
import { Container, Display, Section, SectionHeader, Spark } from './primitives';

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
 * sheer surface area. Built on the marketing primitives + silicaui typography;
 * module areas reuse their brand color, cross-cutting platform areas carry their
 * own accent. Per SILICA-VOCABULARY.md every value is a utility class — there is
 * no inline `style` on this page at all.
 */

export function FeaturesPage() {
  const counts = capabilityCounts();
  const modules = CAPABILITY_AREAS.filter((a) => a.module);
  const platform = CAPABILITY_AREAS.filter((a) => !a.module);

  return (
    <>
      <FeaturesHero counts={counts} />

      <Section padding="lg">
        <SectionHeader
          accent="var(--color-primary)"
          headline={
            <>
              {counts.modules} modules.{' '}
              <span className="text-ink-subtle">Activate any combination</span>
            </>
          }
          lede={
            <>
              Each module is a deep product in its own right — and switching one on costs nothing
              until you use it. Turn it off and it stops billing the same day; the data stays put.
            </>
          }
        />
        <div className="mt-12 flex flex-col gap-5">
          {modules.map((area) => (
            <AreaBlock key={area.id} area={area} />
          ))}
        </div>
      </Section>

      <Section surface="surface" padding="lg">
        <SectionHeader
          accent="var(--color-primary)"
          headline={
            <>
              The platform underneath.{' '}
              <span className="text-ink-subtle">Included with every plan</span>
            </>
          }
          lede={
            <>
              Search, automation, multi-site, security, SEO, domains — the foundation every module
              shares. You don&apos;t buy these. They&apos;re just on.
            </>
          }
        />
        <div className="mt-12 flex flex-col gap-5">
          {platform.map((area) => (
            <AreaBlock key={area.id} area={area} />
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
    <section className="bg-base-200 px-page pb-section-lg pt-[clamp(56px,9vw,96px)]">
      <Container className="flex flex-col gap-10">
        <div className="max-w-[1100px]">
          <Display as="h1" size={96} lineHeight={90}>
            You don&apos;t buy modules.{' '}
            <span className="text-ink-subtle">
              You get everything inside them
              <Spark />
            </span>
          </Display>
        </div>

        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <Text variant="lead" className="text-ink-muted max-w-[620px]">
            The pricing page lists modules. This is what&apos;s actually inside them — {counts.live}{' '}
            shipped capabilities, {counts.building} more in build, and {counts.planned} on the
            roadmap. One platform replaces a stack of six or eight separate tools, and every piece
            reads and writes the same data.
          </Text>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button color="neutral" size="lg">
                Start free →
              </Button>
              <a href="/pricing" className={buttonClasses({ size: 'lg', variant: 'outline' })}>
                See pricing
              </a>
            </div>
            <Text className="text-mini text-ink-subtle font-mono">
              No credit card · Live in five minutes
            </Text>
          </div>
        </div>

        {/* metric row */}
        <div className="border-base-300 mt-2 flex flex-wrap items-center justify-between gap-x-14 gap-y-8 border-t pt-8">
          {metrics.map((m) => (
            <div key={m.s} className="flex flex-col gap-1">
              <span className="text-h1 font-medium tracking-[-0.02em]">
                {m.v}
                {'suffix' in m && m.suffix ? (
                  <span className="text-ink-subtle text-body font-normal">{m.suffix}</span>
                ) : null}
                {'spark' in m && m.spark ? <Spark /> : null}
              </span>
              <Text className="text-caption text-ink-muted">{m.s}</Text>
            </div>
          ))}
        </div>

        <StatusLegend />
      </Container>
    </section>
  );
}

/**
 * Functional annotation legend — it explains what the coloured dot on every
 * capability chip means, so it is a key, not an eyebrow.
 */
function StatusLegend() {
  const order: CapabilityStatus[] = ['live', 'building', 'planned'];
  return (
    <div className="flex flex-wrap items-center gap-5">
      {order.map((s) => (
        <span key={s} className="inline-flex items-center gap-2">
          <Status color={STATUS_META[s].color} size="sm" label={STATUS_META[s].label} />
          <Text as="span" className="text-caption text-ink-muted">
            {STATUS_META[s].label}
          </Text>
        </span>
      ))}
    </div>
  );
}

// ── AREA BLOCK ───────────────────────────────────────────────────────────────
function AreaBlock({ area }: { area: CapabilityArea }) {
  const liveN = area.capabilities.filter((c) => c.status === 'live').length;
  const total = area.capabilities.length;

  return (
    <div
      id={area.id}
      // Each block wears a soft wash of its area hue. This is silica's OWN `soft`
      // treatment (`bg-<color> bg-soft` → `color-mix(in oklab, accent 15%, base)`),
      // not a local one. It used to be a hand-written `color-mix` at 8% against a
      // per-row base — the third private reimplementation of `soft` found in this
      // codebase, and the reason `lib/capabilities` had to carry a colour VALUE at
      // all. `bg-soft` reads `--u-accent`, which `bg-<color>` sets, so the two
      // classes compose with nothing threaded between them.
      className={cx('border-base-300 scroll-mt-[88px] rounded-xl border p-7', area.fill, 'bg-soft')}
    >
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* header column */}
        <div className="w-[280px] shrink-0">
          <div className="flex items-center gap-2.5">
            <Status color={area.color} size="md" />
            <Heading level={3} size={4}>
              {area.name}
            </Heading>
          </div>
          <Text className="text-small text-ink-muted mt-3">{area.summary}</Text>
          <div className="text-mini mt-4 inline-flex items-baseline gap-1.5 font-mono">
            <span className="font-medium">{total}</span>
            capabilities
            <span>· {liveN} live</span>
          </div>
        </div>

        {/* capability chips */}
        <div className="flex flex-1 flex-wrap content-start gap-2">
          {area.capabilities.map((cap) => (
            <CapabilityChip key={cap.name} cap={cap} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A capability + its shipping state. The state rides the dot color (decoded by
 * StatusLegend) — the NAME is always full ink, because every chip here is meant
 * to be read, planned ones included.
 */
function CapabilityChip({ cap }: { cap: Capability }) {
  const meta = STATUS_META[cap.status];
  return (
    <span
      className="border-base-300 bg-base-200 text-caption inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
      title={meta.label}
    >
      <Status color={meta.color} size="sm" label={meta.label} />
      {cap.name}
    </span>
  );
}

// ── CTA ──────────────────────────────────────────────────────────────────────
function FeaturesCta(): ReactNode {
  return (
    <Section padding="xl" className="border-base-300 border-t text-center">
      <div className="flex flex-col items-center">
        <Display size={64} lineHeight={64}>
          Start with one. The rest is already built
          <Spark />
        </Display>
        <Text variant="lead" className="text-ink-muted mt-6 mb-9 max-w-[580px]">
          Switch on a single module from $10/mo and get a live site in five minutes. Everything on
          this page is waiting the moment you need it — no migration, no replatform, no goodbyes.
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Button color="neutral" size="xl">
            Start free
          </Button>
          <a href="/platform" className={buttonClasses({ size: 'xl', variant: 'outline' })}>
            How it works
          </a>
        </div>
        <Text className="text-mini text-ink-subtle mt-6 font-mono">
          No credit card · Cancel anytime · Your data, always exportable
        </Text>
      </div>
    </Section>
  );
}
