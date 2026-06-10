// One catalog listing as a grid card (docs/60 §8). Presentational + category-
// blind: it renders the shared spine (preview, name, tagline, publisher, price)
// plus a single category-specific tag, and links to the detail page. No client
// state — usable from the server browse/home pages AND the client load-more
// island (it imports only the TYPE from lib/marketplace, so no server code is
// pulled into the client bundle).

import { getCategory } from '@/lib/marketplace-registry';
import type { MarketplaceListing } from '@/lib/marketplace';

/** Price label — Free when zero, else dollars, with a /mo suffix for subscriptions. */
function priceLabel(price: MarketplaceListing['price']): string {
  if (price.cents === 0 || price.model === 'free') return 'Free';
  const dollars =
    price.cents % 100 === 0 ? `$${price.cents / 100}` : `$${(price.cents / 100).toFixed(2)}`;
  return price.model === 'subscription' ? `${dollars}/mo` : dollars;
}

/** The one category-specific descriptor shown as the card's tag. */
function listingTag(item: MarketplaceListing): string | null {
  return (
    item.blueprint?.vertical ??
    item.theme?.industry ??
    item.theme?.mood ??
    item.component?.group ??
    item.integration?.kind ??
    null
  );
}

/** A short "what's inside" line for blueprints (the only category with contents). */
function contentsHint(item: MarketplaceListing): string | null {
  const c = item.blueprint?.contents;
  if (!c) return null;
  const parts: string[] = [];
  if (c.pages) parts.push(`${c.pages} pages`);
  if (c.products) parts.push(`${c.products} products`);
  if (c.emails) parts.push(`${c.emails} emails`);
  return parts.slice(0, 2).join(' · ') || null;
}

export function ListingCard({ item }: { item: MarketplaceListing }) {
  const accent = item.accent ?? getCategory(item.category)?.accent ?? 'var(--sparx-primary)';
  const tag = listingTag(item);
  const hint = contentsHint(item);
  const preview = item.media.find((m) => m.kind === 'image')?.url ?? item.media[0]?.url;

  return (
    <a
      href={`/market/${item.category}/${item.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderTop: `3px solid ${accent}`,
        borderRadius: '8px',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {/* Preview */}
      <div
        style={{
          aspectRatio: '16 / 10',
          width: '100%',
          backgroundColor: 'var(--color-bg-page)',
          borderBottom: '1px solid var(--color-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {preview ? (
          /* Hot-linked external/tenant preview (docs/54); next/image gains little here. */
          <img
            src={preview}
            alt={`${item.name} preview`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '9999px',
              backgroundColor: accent,
              opacity: 0.18,
            }}
          />
        )}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px' }}>
        {tag ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'flex-start',
              padding: '3px 9px',
              borderRadius: '9999px',
              backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '11px',
              letterSpacing: '0.02em',
              color: accent,
              marginBottom: '12px',
            }}
          >
            {tag}
          </span>
        ) : null}

        <h3
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '18px',
            letterSpacing: '-0.015em',
            lineHeight: '24px',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {item.name}
        </h3>

        {item.tagline ? (
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: '21px',
              color: 'var(--color-text-secondary)',
              paddingTop: '6px',
              margin: 0,
            }}
          >
            {item.tagline}
          </p>
        ) : null}

        {hint ? (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
              paddingTop: '12px',
              margin: 0,
            }}
          >
            {hint}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginTop: 'auto',
            paddingTop: '20px',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {item.publisher.displayName}
            {item.publisher.verified ? <span style={{ color: accent }}>✓</span> : null}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '13px',
              color: 'var(--color-text-primary)',
            }}
          >
            {priceLabel(item.price)}
          </span>
        </div>
      </div>
    </a>
  );
}
