import { Button } from '@wizeworks/silicaui-react';
import { Display, Dot, getModuleColor, Section, Spark } from './primitives';
import { type ModuleMeta } from '@/lib/modules';

/**
 * Reusable per-module marketing page. Each module's route
 * (`app/builder/page.tsx`, etc.) renders this with its `ModuleMeta`.
 * The module color is pulled from tokens via `getModuleColor()` so the hero
 * spark accent, the one soft-tinted lead feature card, and the pricing strip
 * stay consistent with the rest of the brand.
 */
export function ModulePage({ meta }: { meta: ModuleMeta }) {
  const color = getModuleColor(meta.module);
  return (
    <>
      <ModuleHero meta={meta} color={color} />
      <ModuleFeatures meta={meta} color={color} />
      <ModulePricingStrip meta={meta} color={color} />
      <ModuleCta meta={meta} color={color} />
    </>
  );
}

type ModuleColor = ReturnType<typeof getModuleColor>;

/** Strip any suffix after a middle-dot — "B2B · Wholesale · Fleet" → "B2B". */
function shortLabel(label: string): string {
  const head = label.split('·')[0];
  return head ? head.trim() : label;
}

function ModuleHero({ meta, color }: { meta: ModuleMeta; color: ModuleColor }) {
  return (
    // Not <Section>: the hero's top pad is a tighter fluid clamp than the shared
    // section rhythm, so it owns its own band.
    <section className="bg-base-200 px-page pb-section-lg pt-[clamp(56px,9vw,96px)]">
      <div className="max-w-content mx-auto flex w-full flex-col gap-10">
        <div className="flex max-w-[1100px] flex-col gap-2">
          <Display as="h1" size={104} lineHeight={96}>
            {meta.headlinePrimary}
          </Display>
          <Display as="h1" size={104} lineHeight={96}>
            {meta.headlineSecondary}
            <Spark color={color.color} />
          </Display>
        </div>

        <div className="max-w-content flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <p className="text-ink-muted m-0 max-w-[640px] text-[clamp(16px,1.6vw,20px)] leading-[1.55] font-normal">
            {meta.lede}
          </p>

          <div className="flex flex-col items-start gap-3.5 lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <Button color="neutral" size="lg">
                Start free
              </Button>
              <Button size="lg" variant="outline">
                See pricing
              </Button>
            </div>
            <span className="text-ink-subtle text-mini font-mono">
              {meta.marketingDomain ? `${meta.marketingDomain} · ` : ''}
              No credit card · Cancel anytime
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModuleFeatures({ meta, color }: { meta: ModuleMeta; color: ModuleColor }) {
  return (
    <Section surface="surface" padding="lg">
      <div className="flex flex-col gap-16">
        <div className="flex max-w-[720px] flex-col gap-5">
          <Display size={56} lineHeight={60}>
            Every part of {shortLabel(meta.label)}
            <Spark color={color.color} />
          </Display>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {meta.features.map((f, i) => (
            <div
              key={f.number}
              className={`border-base-300 flex flex-col gap-3.5 rounded-lg border p-8 ${
                i === 0 ? `${color.bg} bg-soft` : 'bg-base-200'
              }`}
            >
              {/* The card's `f.number` step marker was removed per the no-eyebrow
                  rule — it sat directly above the title doing nothing but
                  numbering it. The module dot carries the identity. */}
              <span
                className={`${color.bg} bg-soft inline-flex h-7 w-7 items-center justify-center rounded-md`}
              >
                <Dot color={color.color} size={8} />
              </span>
              <h3 className="text-base-content text-h4 m-0 pt-2 font-medium tracking-[-0.02em]">
                {f.title}
              </h3>
              <p className="text-ink-muted text-small m-0">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ModulePricingStrip({ meta, color }: { meta: ModuleMeta; color: ModuleColor }) {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col lg:flex-row ${color.bg} bg-soft border-base-300 items-center justify-between gap-8 rounded-xl border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            {meta.pricing.modifier ? (
              <span className="text-ink-subtle text-[40px] font-medium tracking-[-0.02em]">
                {meta.pricing.modifier}
              </span>
            ) : null}
            <span className="text-base-content text-[56px] font-medium tracking-[-0.025em]">
              {meta.pricing.price}
            </span>
            <span className="text-ink-subtle text-body">{meta.pricing.period}</span>
          </div>
          <p className="text-ink-muted text-small m-0 max-w-[640px]">{meta.pricing.bundleNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="neutral" size="lg">
            Activate {shortLabel(meta.label)}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function ModuleCta({ meta, color }: { meta: ModuleMeta; color: ModuleColor }) {
  return (
    // Themed dark island — the whole --color-base-* ramp flips, so the headline
    // and lede resolve on-brand without the old #0A0A0A/#FFFFFF/#A1A1AA trio.
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-12">
        <Display size={88} lineHeight={84}>
          Ready to go
          <Spark color={color.color} />
        </Display>
        <p className="text-ink-muted text-lede m-0 max-w-[640px]">
          Activate {shortLabel(meta.label)} in one click. No migration, no consultant, no contract.
          Turn it back off any time — your data stays.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xl" variant="solid">
            Start your site →
          </Button>
          <Button size="xl" variant="outline">
            Talk to sales
          </Button>
        </div>
      </div>
    </Section>
  );
}
