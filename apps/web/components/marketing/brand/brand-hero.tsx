import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Spark } from '../primitives';
import { CopyValue } from './interactive';
import { OfficialWordmark } from './assets';

/** Section anchors surfaced as the "on this page" index. Ids match each
 *  <Section id> below the hero so the chips deep-link cleanly. */
export const BRAND_SECTIONS = [
  { id: 'wordmark', label: 'Wordmark' },
  { id: 'monogram', label: 'Monogram' },
  { id: 'misuse', label: 'Misuse' },
  { id: 'color', label: 'Primary color' },
  { id: 'modules', label: 'Module colors' },
  { id: 'palette', label: 'Palette' },
  { id: 'type', label: 'Typography' },
  { id: 'principles', label: 'Principles' },
  { id: 'voice', label: 'Voice & tone' },
  { id: 'not', label: "What we're not" },
  { id: 'downloads', label: 'Assets' },
] as const;

const IDENTITY: { label: string; value: string }[] = [
  { label: 'Platform', value: 'sparx' },
  { label: 'Company', value: 'WizeWorks, Inc.' },
  { label: 'Primary domain', value: 'sparx.works' },
  { label: 'Maintained by', value: 'brand@sparx.works' },
];

export function BrandHero() {
  return (
    <section
      style={{
        paddingTop: 'clamp(104px, 13vw, 168px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-base-200)',
        borderBottom: '1px solid var(--color-base-300)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        <OfficialWordmark style={{ width: 'clamp(208px, 32vw, 332px)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '880px' }}>
          <Display as="h1" size={84} lineHeight={80}>
            The system behind the spark
            <Spark />
          </Display>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '19px',
              lineHeight: '31px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              maxWidth: '660px',
              margin: 0,
            }}
          >
            The wordmark, the color system, the Geist type scale, and the voice that keep sparx
            coherent across thirteen modules, a dozen domains, and every surface a tenant touches.
            This page is the source of truth — for us, and for anyone building with the sparx brand.
          </p>
        </div>

        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="#downloads">
            <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
              Download brand assets
            </Button>
          </a>
          <a
            href="mailto:brand@sparx.works"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              textDecoration: 'none',
              padding: '12px 0',
            }}
          >
            Press kit → brand@sparx.works
          </a>
        </div>

        <IdentityList />

        <SectionIndex />

        <div
          className="mkt-cluster"
          style={{ gap: '10px', alignItems: 'center', paddingTop: '4px' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            Tap any swatch, hex, or token to copy it.
          </span>
          <CopyValue value="#6366F1" label="Copy the sparx Indigo hex" />
        </div>
      </Container>
    </section>
  );
}

function IdentityList() {
  return (
    <dl
      className="mkt-grid-4-2-1"
      style={{
        margin: '8px 0 0',
        paddingTop: '8px',
        borderTop: '1px solid var(--color-base-300)',
      }}
    >
      {IDENTITY.map((row) => (
        <div
          key={row.label}
          style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '24px' }}
        >
          <dt
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            {row.label}
          </dt>
          <dd
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '15px',
              color: 'var(--color-base-content)',
            }}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionIndex() {
  return (
    <nav
      aria-label="On this page"
      className="mkt-cluster"
      style={{ gap: '8px', paddingTop: '4px' }}
    >
      {BRAND_SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
            textDecoration: 'none',
            padding: '7px 13px',
            border: '1px solid var(--color-base-300)',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-base-100)',
          }}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
