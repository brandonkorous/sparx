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
  const accent = item.accent ?? getCategory(item.category)?.accent ?? 'var(--color-primary)';
  const tag = listingTag(item);
  const hint = contentsHint(item);
  const preview = item.media.find((m) => m.kind === 'image')?.url ?? item.media[0]?.url;

  return (
    <a
      href={`/market/${item.category}/${item.slug}`}
      className="border-base-300 bg-base-100 flex w-full flex-col overflow-hidden rounded-lg border text-inherit no-underline"
    >
      {/* Preview */}
      <div className="bg-base-200 border-base-300 flex aspect-[16/10] w-full items-center justify-center border-b">
        {preview ? (
          /* Hot-linked external/tenant preview (docs/54); next/image gains little here. */
          <img src={preview} alt={`${item.name} preview`} className="h-full w-full object-cover" />
        ) : (
          // Decorative placeholder puck — the listing's category hue is catalog
          // data (a JS value), so the fill stays inline.
          <span
            aria-hidden
            className="h-10 w-10 rounded-full opacity-[0.18]"
            style={{ backgroundColor: accent }}
          />
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        {tag ? (
          <span
            className="text-micro mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-[3px] font-medium tracking-[0.02em]"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
              color: accent,
            }}
          >
            {tag}
          </span>
        ) : null}

        <h3 className="text-base-content text-lede m-0 font-medium tracking-[-0.015em]">
          {item.name}
        </h3>

        {item.tagline ? (
          <p className="text-ink-muted text-small m-0 pt-1.5">{item.tagline}</p>
        ) : null}

        {hint ? <p className="text-ink-subtle text-mini m-0 pt-3 font-mono">{hint}</p> : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-ink-subtle text-caption inline-flex items-center gap-1.5">
            {item.publisher.displayName}
            {item.publisher.verified ? <span style={{ color: accent }}>✓</span> : null}
          </span>
          <span className="text-base-content text-caption font-medium">
            {priceLabel(item.price)}
          </span>
        </div>
      </div>
    </a>
  );
}
