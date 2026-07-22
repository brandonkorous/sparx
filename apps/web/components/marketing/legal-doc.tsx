/**
 * Marketing-side layout for sparx's OWN platform legal documents (docs/42 §6)
 * — Terms, Privacy, DPA, Acceptable Use. Replaces the per-page ComingSoon
 * stub with a real, versioned, indexable page: an editorial header (title,
 * version + effective date) + a readable prose column. Nav/Footer come from the
 * root layout.
 *
 * Content is authored per page from the small helpers exported here
 * (`LegalSection` / `LegalP` / `LegalList` / `LegalSubhead`) so every doc
 * shares one typographic register. Appearance is the marketing utility
 * vocabulary registered in app/globals.css — the editorial `text-*` scale and
 * the real-ink `text-ink-*` colors — never inline style.
 */
import type { ReactNode } from 'react';
import { Heading } from '@wizeworks/silicaui-react';
import { Container, Display, Spark, Text } from './primitives';

export function LegalDoc({
  title,
  version,
  effectiveDate,
  intro,
  children,
}: {
  /** @deprecated Eyebrows are removed brand-wide (RULE #2); value ignored. */
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
      <section className="bg-base-200 px-page pt-[clamp(96px,11vw,150px)] pb-[clamp(32px,5vw,56px)]">
        <Container className="flex flex-col gap-5">
          <Display as="h1" size={64} lineHeight={64}>
            {title}
            <Spark />
          </Display>
          <div className="flex flex-wrap gap-5">
            <Text as="span" mono size={13} tone="subtle">
              Version {version}
            </Text>
            <Text as="span" mono size={13} tone="subtle">
              Effective {effectiveDate}
            </Text>
          </div>
          {intro ? (
            <Text size={18} className="max-w-[640px] pt-2">
              {intro}
            </Text>
          ) : null}
        </Container>
      </section>

      <section className="bg-base-200 px-page pb-[clamp(80px,10vw,140px)]">
        <Container>
          <div className="flex max-w-[760px] flex-col gap-10">{children}</div>
        </Container>
      </section>
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
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <Heading level={2} size={3}>
        {heading}
      </Heading>
      {children}
    </section>
  );
}

export function LegalSubhead({ children }: { children: ReactNode }) {
  return (
    <Heading level={3} size={5} className="mt-2">
      {children}
    </Heading>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  // 16px, not the old 15 — long-form prose sits on the body floor.
  return <Text size={16}>{children}</Text>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="text-body text-ink-muted flex list-disc flex-col gap-2 pl-5 font-sans">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
