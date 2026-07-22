// Listing detail (docs/60 §10, Detail tier). Gallery + "what you get" on the
// left; a sticky action panel on the right (category, price, social proof,
// what's-included, requirements, version, publisher) whose CTA is the public
// funnel's hand-off: "Sign up to install" → the dashboard signup carrying the
// blueprint intent (docs/54 §15). A related strip closes it out. Generic over
// category; the blueprint contents/requirements render from the typed block.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { Section, Display, Spark } from '@/components/marketing/primitives';
import {
  fetchListing,
  fetchCategory,
  signUpHref,
  type MarketplaceListing,
} from '@/lib/marketplace';
import { getCategory } from '@/lib/marketplace-registry';
import { fetchChatAvailability } from '@/lib/chat';
import { ListingCard } from '../../_components/listing-card';
import { MarketChatCta } from '../../_components/chat-cta';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const item = await fetchListing(category, slug);
  if (!item) return { title: 'Marketplace — sparx' };
  const description = item.tagline ?? item.description ?? undefined;
  return {
    title: `${item.name} — sparx Marketplace`,
    description,
    alternates: { canonical: `/market/${category}/${slug}` },
    // No `images` here on purpose. Setting it would override the generated card
    // in ./opengraph-image.tsx with the listing's raw media URL — an
    // arbitrary-dimension CDN asset with no og:image:width/height/type, which
    // LinkedIn drops. `url` must be per-page: LinkedIn de-duplicates shares by
    // og:url, so inheriting the layout's site-root value collapsed every listing
    // share onto the homepage's cached preview.
    openGraph: {
      title: `${item.name} — sparx Marketplace`,
      description,
      url: `https://sparx.works/market/${category}/${slug}`,
    },
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

  // "Chat with {publisher}" CTA (docs/72 §"Chat module integration"). Only for
  // tenant-published listings whose tenant has the chat module live — first-party
  // (sparx) and partner listings have no tenant inbox to route a buyer to. The
  // browser-reachable api origin is read server-side (a runtime value, not the
  // build-time-baked NEXT_PUBLIC_*) and handed to the client widget as a prop.
  const chatSlug = item.publisher.type === 'tenant' ? item.publisher.slug : null;
  const chatAvailable = chatSlug ? await fetchChatAvailability(chatSlug) : null;
  const chatApiUrl = process.env.SPARX_PUBLIC_API_REST_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
  const showChat = Boolean(chatSlug && chatAvailable && chatApiUrl);

  return (
    <Section surface="page" padding="lg">
      <div className="flex flex-col gap-8">
        <a href={`/market/${cat.id}`} className="text-ink-muted text-caption no-underline">
          ← {cat.label}
        </a>

        <div className="flex flex-col items-start gap-10 lg:flex-row">
          {/* Gallery + description */}
          <div className="flex min-w-0 flex-[2_1_0] flex-col gap-5">
            {hero ? (
              /* Hot-linked preview (docs/54). */
              <img
                src={hero}
                alt={`${item.name} preview`}
                className="border-base-300 w-full rounded-xl border"
              />
            ) : (
              <div className="border-base-300 bg-base-100 aspect-[16/10] w-full rounded-xl border" />
            )}

            {images.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2.5">
                {images.slice(1, 5).map((m) => (
                  /* Hot-linked preview (docs/54). */
                  <img
                    key={m.url}
                    src={m.url}
                    alt={m.alt ?? `${item.name} preview`}
                    className="border-base-300 h-[76px] w-[120px] rounded-lg border object-cover"
                  />
                ))}
              </div>
            ) : null}

            {item.description ? (
              <p className="text-ink-muted text-body m-0 pt-2">{item.description}</p>
            ) : null}
          </div>

          {/* Action panel */}
          <aside
            className="border-base-300 sticky top-24 flex w-full max-w-[380px] flex-[1_1_320px] flex-col gap-5 rounded-xl border p-7"
            // The one lead panel on the detail page carries the soft 12% wash of
            // the listing's accent — catalog data (a JS value), so it stays inline.
            style={{
              backgroundColor: `color-mix(in oklab, ${accent} 12%, var(--color-base-100))`,
            }}
          >
            {tag ? (
              <span
                className="text-micro self-start rounded-full px-2.5 py-1 font-medium"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                  color: accent,
                }}
              >
                {tag}
              </span>
            ) : null}

            <div>
              <h1 className="text-base-content text-h1 m-0 font-medium tracking-[-0.02em]">
                {item.name}
              </h1>
              {item.tagline ? (
                <p className="text-ink-muted text-small m-0 pt-2">{item.tagline}</p>
              ) : null}
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-base-content text-h4 font-medium">
                {priceLabel(item.price)}
              </span>
              {item.installCount > 0 ? (
                <span className="text-ink-muted text-caption">{item.installCount} installs</span>
              ) : null}
            </div>

            <a href={ctaHref} className="block">
              <Button color="neutral" size="lg" className="w-full">
                {ctaLabel}
              </Button>
            </a>

            {showChat && chatSlug ? (
              <MarketChatCta
                apiUrl={chatApiUrl}
                tenantSlug={chatSlug}
                publisherName={item.publisher.displayName}
                accentColor={accent}
              />
            ) : null}

            {included.length > 0 ? (
              <Detail label="What's included">
                {included.map((line) => (
                  <Row key={line}>{line}</Row>
                ))}
              </Detail>
            ) : null}

            {requires.length > 0 ? (
              <Detail label="Requires">
                <div className="flex flex-wrap items-center gap-2">
                  {requires.map((m) => (
                    <Badge key={m} variant="outline" size="sm">
                      {m}
                    </Badge>
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
          <div className="flex flex-col gap-6 pt-6">
            <Display as="h2" size={32}>
              More {cat.label.toLowerCase()}
              <Spark color={accent} />
            </Display>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <ListingCard key={r.id} item={r} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-base-300 flex flex-col gap-2 border-t pt-4">
      {/* A spec-group label, meant to be read — full ink, not a faded caption. */}
      <span className="text-base-content text-small font-medium">{label}</span>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <span className="text-ink-muted text-small">{children}</span>;
}
