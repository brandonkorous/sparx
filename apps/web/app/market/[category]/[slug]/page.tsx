// Listing detail (docs/60 §10, Detail tier). Gallery + "what you get" on the
// left; a sticky action panel on the right (category, price, social proof,
// what's-included, requirements, version, publisher) whose CTA is the public
// funnel's hand-off: "Sign up to install" → the dashboard signup carrying the
// blueprint intent (docs/54 §15). A related strip closes it out. Generic over
// category; the blueprint contents/requirements render from the typed block.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Button } from '@sparx/ui';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { Section, Display, Spark } from '@/components/marketing/primitives';
import {
  fetchListing,
  fetchCategory,
  signUpHref,
  type MarketplaceListing,
} from '@/lib/marketplace';
import { getCategory } from '@/lib/marketplace-registry';
import { ListingCard } from '../../_components/listing-card';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const item = await fetchListing(category, slug);
  if (!item) return { title: 'Marketplace — Sparx' };
  const image = item.media.find((m) => m.kind === 'image')?.url;
  return {
    title: `${item.name} — Sparx Marketplace`,
    description: item.tagline ?? item.description ?? undefined,
    alternates: { canonical: `/market/${category}/${slug}` },
    openGraph: image ? { images: [{ url: image }] } : undefined,
  };
}

/** Blueprint "what's included" lines (the only category with a contents block). */
function includedLines(item: MarketplaceListing): string[] {
  const c = item.blueprint?.contents;
  if (!c) return [];
  const lines: string[] = [];
  if (c.pages) lines.push(`${c.pages} ${c.pages === 1 ? 'page' : 'pages'}`);
  if (c.products) lines.push(`${c.products} ${c.products === 1 ? 'product' : 'products'}`);
  if (c.content) lines.push(`${c.content} content ${c.content === 1 ? 'entry' : 'entries'}`);
  if (c.emails) lines.push(`${c.emails} ${c.emails === 1 ? 'email' : 'emails'}`);
  if (c.components)
    lines.push(`${c.components} ${c.components === 1 ? 'component' : 'components'}`);
  if (c.theme) lines.push(`${c.theme} theme`);
  return lines;
}

function priceLabel(price: MarketplaceListing['price']): string {
  if (price.cents === 0 || price.model === 'free') return 'Free';
  const dollars =
    price.cents % 100 === 0 ? `$${price.cents / 100}` : `$${(price.cents / 100).toFixed(2)}`;
  return price.model === 'subscription' ? `${dollars}/mo` : dollars;
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const item = await fetchListing(category, slug);
  if (!item) notFound();

  const related = await fetchCategory(category, { limit: '4' }).then((r) =>
    r.items.filter((i) => i.slug !== item.slug).slice(0, 3)
  );

  const accent = item.accent ?? cat.accent;
  const images = item.media.filter((m) => m.kind === 'image');
  const hero = images[0]?.url ?? item.media[0]?.url;
  const included = includedLines(item);
  const requires = item.blueprint?.requiredModules ?? [];
  const tag =
    item.blueprint?.vertical ??
    item.theme?.industry ??
    item.component?.group ??
    item.integration?.kind ??
    null;

  // The funnel hand-off. Blueprints carry their slug so a later onboarding slice
  // can auto-install; other categories fall back to a generic signup.
  const ctaHref =
    item.category === 'blueprints' ? signUpHref({ blueprint: item.slug }) : signUpHref();
  const ctaLabel =
    item.category === 'blueprints'
      ? 'Start with this blueprint'
      : `Sign up to use this ${cat.singular}`;

  return (
    <>
      <Nav />

      <Section surface="page" padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <a
            href={`/market/${cat.id}`}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
              textDecoration: 'none',
            }}
          >
            ← {cat.label}
          </a>

          <div className="mkt-stack-on-tablet" style={{ gap: '40px', alignItems: 'flex-start' }}>
            {/* Gallery + description */}
            <div
              style={{
                flex: '2 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {hero ? (
                /* Hot-linked preview (docs/54). */
                <img
                  src={hero}
                  alt={`${item.name} preview`}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border-default)',
                  }}
                />
              ) : (
                <div
                  style={{
                    aspectRatio: '16 / 10',
                    width: '100%',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                  }}
                />
              )}

              {images.length > 1 ? (
                <div className="mkt-cluster" style={{ gap: '10px' }}>
                  {images.slice(1, 5).map((m) => (
                    /* Hot-linked preview (docs/54). */
                    <img
                      key={m.url}
                      src={m.url}
                      alt={m.alt ?? `${item.name} preview`}
                      style={{
                        width: '120px',
                        height: '76px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border-default)',
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {item.description ? (
                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '16px',
                    lineHeight: '26px',
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                    paddingTop: '8px',
                  }}
                >
                  {item.description}
                </p>
              ) : null}
            </div>

            {/* Action panel */}
            <aside
              style={{
                flex: '1 1 320px',
                maxWidth: '380px',
                width: '100%',
                position: 'sticky',
                top: '96px',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)',
                borderTop: `3px solid ${accent}`,
                borderRadius: '12px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {tag ? (
                <span
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '11px',
                    color: accent,
                  }}
                >
                  {tag}
                </span>
              ) : null}

              <div>
                <h1
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '26px',
                    letterSpacing: '-0.02em',
                    lineHeight: '32px',
                    color: 'var(--color-text-primary)',
                    margin: 0,
                  }}
                >
                  {item.name}
                </h1>
                {item.tagline ? (
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
                    {item.tagline}
                  </p>
                ) : null}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '20px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {priceLabel(item.price)}
                </span>
                {item.installCount > 0 ? (
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    {item.installCount} installs
                  </span>
                ) : null}
              </div>

              <a href={ctaHref} style={{ display: 'block' }}>
                <Button size="lg" style={{ width: '100%', backgroundColor: '#0A0A0A' }}>
                  {ctaLabel}
                </Button>
              </a>

              {included.length > 0 ? (
                <Detail label="What's included">
                  {included.map((line) => (
                    <Row key={line}>{line}</Row>
                  ))}
                </Detail>
              ) : null}

              {requires.length > 0 ? (
                <Detail label="Requires">
                  <div className="mkt-cluster" style={{ gap: '8px' }}>
                    {requires.map((m) => (
                      <span
                        key={m}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '9999px',
                          border: '1px solid var(--color-border-default)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </Detail>
              ) : null}

              <Detail label="Details">
                <Row>Version {item.version}</Row>
                <Row>
                  By {item.publisher.displayName}
                  {item.publisher.verified ? <span style={{ color: accent }}> ✓</span> : null}
                </Row>
              </Detail>
            </aside>
          </div>

          {related.length > 0 ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '24px' }}
            >
              <Display as="h2" size={32}>
                More {cat.label.toLowerCase()}
                <Spark color={accent} />
              </Display>
              <div className="mkt-grid-3-2-1">
                {related.map((r) => (
                  <ListingCard key={r.id} item={r} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      <Footer />
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        borderTop: '1px solid var(--color-border-default)',
        paddingTop: '16px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '12px',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}
