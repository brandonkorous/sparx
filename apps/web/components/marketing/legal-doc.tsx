/**
 * Marketing-side layout for Sparx's OWN platform legal documents (docs/42 §6)
 * — Terms, Privacy, DPA, Acceptable Use. Replaces the per-page ComingSoon
 * stub with a real, versioned, indexable page: Nav + an editorial header
 * (eyebrow, title, version + effective date) + a readable prose column +
 * Footer.
 *
 * Content is authored per page from the small helpers exported here
 * (`LegalSection` / `LegalP` / `LegalList` / `LegalSubhead`) so every doc
 * shares one typographic register. No raw Tailwind per docs/23 §1 — inline
 * styles reference CSS variables from packages/ui/src/tokens.css.
 */
import type { ReactNode } from 'react';
import { Nav } from './nav';
import { Footer } from './footer';
import { Container, Eyebrow, Display, Spark } from './primitives';

const PROSE_MAX = '760px';

export function LegalDoc({
  eyebrow = 'Legal',
  title,
  version,
  effectiveDate,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Date-based version string from lib/legal-versions.ts. */
  version: string;
  /** Human effective date shown beside the version. */
  effectiveDate: string;
  /** One- or two-sentence plain-language lede under the title. */
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <Nav />
      <section
        style={{
          paddingTop: 'clamp(96px, 11vw, 150px)',
          paddingBottom: 'clamp(32px, 5vw, 56px)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Container style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Eyebrow color="var(--color-text-tertiary)">{eyebrow}</Eyebrow>
          <Display as="h1" size={64} lineHeight={64}>
            {title}
            <Spark />
          </Display>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              display: 'flex',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <span>Version {version}</span>
            <span>Effective {effectiveDate}</span>
          </div>
          {intro ? (
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '18px',
                lineHeight: '30px',
                color: 'var(--color-text-secondary)',
                maxWidth: '640px',
                margin: 0,
                paddingTop: '8px',
              }}
            >
              {intro}
            </p>
          ) : null}
        </Container>
      </section>

      <section
        style={{
          paddingBottom: 'clamp(80px, 10vw, 140px)',
          paddingLeft: 'var(--gutter-page)',
          paddingRight: 'var(--gutter-page)',
          backgroundColor: 'var(--color-bg-page)',
        }}
      >
        <Container>
          <div
            style={{ maxWidth: PROSE_MAX, display: 'flex', flexDirection: 'column', gap: '40px' }}
          >
            {children}
          </div>
        </Container>
      </section>
      <Footer />
    </>
  );
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      style={{ display: 'flex', flexDirection: 'column', gap: '12px', scrollMarginTop: '96px' }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '22px',
          lineHeight: '28px',
          letterSpacing: '-0.02em',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {heading}
      </h2>
      {children}
    </section>
  );
}

export function LegalSubhead({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: '16px',
        lineHeight: '24px',
        color: 'var(--color-text-primary)',
        margin: '8px 0 0',
      }}
    >
      {children}
    </h3>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '15px',
        lineHeight: '26px',
        color: 'var(--color-text-secondary)',
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontFamily: 'var(--font-sans)',
        fontSize: '15px',
        lineHeight: '26px',
        color: 'var(--color-text-secondary)',
      }}
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
