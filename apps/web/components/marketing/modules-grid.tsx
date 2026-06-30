import { Section, SectionHeader, Dot, getModuleColor } from './primitives';
import { Reveal } from './reveal';
import { MODULES, MODULES_PRICE_FLOOR, type ModuleEntry } from './modules-catalog';

// The module menu — every billable module on one scannable grid (docs/learnings
// §1 clarity, §2 "a list with a job"). The job here is BREADTH + the modular
// promise: this is the whole platform, you switch on only what you need, and some
// pieces ride along free. The count is DERIVED from the catalog so it can never
// drift from the product the way the old hardcoded "Nine pieces" did.
//
// Cards wear a soft, theme-aware module-tint wash (color-mix into the surface, so
// it adapts to dark mode) instead of the retired 3px top stripe — matching the
// dashboard's <Card variant="module">. A module menu is the sanctioned exception
// to "one tinted card per page": here the tint is a color legend, not noise.

export function ModulesGrid() {
  return (
    <Section id="modules" surface="surface" padding="lg" className="mkt-stage">
      <Reveal style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        <SectionHeader
          accent="var(--sparx-primary)"
          headline={
            <>
              {MODULES.length} modules.{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>Switch on what you need</span>
            </>
          }
          lede={
            <>
              Every module shares one data layer, one dashboard, one bill — from $
              {MODULES_PRICE_FLOOR}/mo. Some, like Inventory and Invoicing, come free the moment you
              add Commerce. Turn a module off and it stops billing — no migration, no exports, no
              goodbyes.
            </>
          }
        />

        <div className="mkt-grid-4-2-1">
          {MODULES.map((m, i) => (
            <Reveal key={m.id} index={i % 4} style={{ display: 'flex' }}>
              <ModuleTile module={m} />
            </Reveal>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

function ModuleTile({ module: m }: { module: ModuleEntry }) {
  const color = getModuleColor(m.id);
  const tileStyle = {
    // Theme-aware tint: mixes the hue into the live surface token, so it stays a
    // tinted-white card in light mode and a tinted-dark card in dark mode.
    ['--tile-tint' as string]: `color-mix(in oklab, ${color.color} 8%, var(--color-bg-surface))`,
    ['--tile-accent' as string]: color.color,
  } as React.CSSProperties;

  const body = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <Dot color={color.color} size={7} />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '13px',
            letterSpacing: '0.01em',
            color: color.text,
          }}
        >
          {m.label}
        </span>
      </span>

      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '19px',
          letterSpacing: '-0.02em',
          lineHeight: '24px',
          color: 'var(--color-text-primary)',
          paddingTop: '18px',
          margin: 0,
        }}
      >
        {m.title}
      </h3>

      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          lineHeight: '21px',
          color: 'var(--color-text-secondary)',
          paddingTop: '8px',
          margin: 0,
        }}
      >
        {m.description}
      </p>

      <ModuleTileFooter module={m} color={color} />
    </>
  );

  return m.href ? (
    <a href={m.href} className="mkt-module-tile" style={tileStyle}>
      {body}
    </a>
  ) : (
    <div className="mkt-module-tile" style={tileStyle}>
      {body}
    </div>
  );
}

function ModuleTileFooter({
  module: m,
  color,
}: {
  module: ModuleEntry;
  color: ReturnType<typeof getModuleColor>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginTop: 'auto',
        paddingTop: '20px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '15px',
          color: 'var(--color-text-primary)',
        }}
      >
        ${m.price}
        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400, fontSize: '13px' }}>
          /mo
        </span>
      </span>

      {m.includedWith ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            backgroundColor: 'var(--color-success-tint)',
            borderRadius: '9999px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '11px',
            color: 'var(--color-success)',
            whiteSpace: 'nowrap',
          }}
        >
          Free with {m.includedWith.join(' or ')}
        </span>
      ) : m.href ? (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '13px',
            color: color.color,
          }}
        >
          Learn →
        </span>
      ) : null}
    </div>
  );
}
