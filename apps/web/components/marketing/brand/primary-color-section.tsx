import { Section, SectionHeader, Text } from '../primitives';
import { CopyValue, Swatch } from './interactive';

// Live tiles: each paints its `var(--color-*)` and shows the resolved hex, so a
// theme change in @sparx/brand/theme.css flows straight through — nothing to
// re-type here.
const RAMP = [
  {
    name: 'Primary',
    value: 'var(--color-primary)',
    token: '--color-primary',
    note: 'Buttons, links, active states, the “x”.',
  },
  {
    name: 'Primary · dark',
    value: 'var(--color-primary)',
    theme: 'dark' as const,
    token: '--color-primary',
    note: 'The very same token, resolved in dark — Ember holds in both modes.',
  },
  {
    name: 'Soft tint',
    value: 'color-mix(in oklab, var(--color-primary) 15%, var(--color-base-100))',
    token: 'bg-primary bg-soft',
    note: 'Background washes and chips — a theme-aware computed mix, never a baked hex.',
  },
] as const;

export function PrimaryColorSection() {
  return (
    <Section id="color" surface="surface" padding="lg">
      <div className="flex flex-col gap-12">
        <SectionHeader
          accent="var(--color-primary)"
          headline="sparx Ember"
          lede="One brand color carries the platform. It is the “x” in the wordmark, the color of the spark, and the default accent on every sparx surface — the instant of ignition, made into a hex. (Each module keeps its own hue for wayfinding; Ember is the brand.)"
        />

        <div className="bg-primary flex min-h-[240px] flex-col justify-end gap-5 rounded-xl p-[clamp(32px,5vw,56px)]">
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: 'clamp(28px, 4vw, 40px)',
              letterSpacing: '-0.02em',
              color: 'var(--color-primary-content)',
            }}
          >
            sparx Ember
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <CopyValue value="#e04631" tone="strong" />
            <CopyValue value="--color-primary" />
            <Text
              as="span"
              size={13}
              color="color-mix(in oklab, var(--color-primary-content) 72%, var(--color-primary))"
            >
              Geist 500 · the platform accent
            </Text>
          </div>
        </div>

        <div className="mkt-grid-4-2-1">
          {RAMP.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </div>
    </Section>
  );
}
