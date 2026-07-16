// /marketplace/[category]/[slug] — a single listing's detail (docs/60 §7):
// preview + an action panel (what's included, requirements, version, and the
// category's primary CTA) + a related strip. Generic over category; blueprint
// specifics (the "what's included" counts + required modules) render from the
// typed blueprint block. Install lifecycle is unchanged (docs/54 §8) — the
// action panel drives it via ListingCardActions and links to the review surface.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import type { MarketplaceListing, MarketplaceListResponse } from '../../_types';

import { api } from '@/lib/api-rest-client';
import { getCategory } from '../../_registry';
import { ListingCard } from '../../_components/listing-card';
import { ListingCardActions } from '../../_components/listing-card-actions';

export const dynamic = 'force-dynamic';

/** "What's included" lines for a blueprint; empty for categories without a
 *  contents breakdown yet. */
function includes(item: MarketplaceListing): string[] {
  if (item.blueprint) {
    const c = item.blueprint.contents;
    return [
      `${c.products} products`,
      `${c.pages} pages`,
      `${c.content} content entries`,
      `${c.emails} emails`,
      `${c.components} components`,
      `${c.theme} theme`,
    ];
  }
  return [];
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category: categoryId, slug } = await params;
  const category = getCategory(categoryId);
  if (!category) notFound();

  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';

  const item = await api
    .get<MarketplaceListing>(
      `/v1/marketplace/${encodeURIComponent(categoryId)}/${encodeURIComponent(slug)}`
    )
    .catch(() => null);
  if (!item) notFound();

  const related = await api
    .get<MarketplaceListResponse>(`/v1/marketplace/${encodeURIComponent(categoryId)}?limit=4`)
    .then((r) => r.items.filter((i) => i.slug !== item.slug).slice(0, 3))
    .catch(() => [] as MarketplaceListing[]);

  const preview = item.media[0]?.url;
  const tag =
    item.blueprint?.vertical ??
    item.theme?.industry ??
    item.component?.group ??
    item.integration?.kind ??
    null;
  const included = includes(item);
  const requires = item.blueprint?.requiredModules ?? [];

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 self-start"
          render={
            <Link href={`/marketplace/${category.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {category.label}
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {preview ? (
              <img
                src={preview}
                alt={`${item.name} preview`}
                className="border-base-300 w-full rounded-lg border"
              />
            ) : (
              <div className="border-base-300 aspect-[16/10] w-full rounded-lg border" />
            )}
            <p className="text-base-content mt-4">{item.description ?? item.tagline ?? ''}</p>
          </div>

          <Card className="bg-module bg-soft">
            <CardBody>
              <div className="flex flex-col gap-4">
                {tag ? (
                  <Badge variant="soft" className="self-start">
                    {tag}
                  </Badge>
                ) : null}
                <h1 className="text-3xl font-semibold">{item.name}</h1>
                <ListingCardActions item={item} canInstall={canInstall} detail />
                {included.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">What&apos;s included</p>
                    <div className="flex flex-col gap-1">
                      {included.map((line) => (
                        <p key={line} className="text-base-content text-sm">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {requires.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Requires</p>
                    <div className="flex flex-wrap gap-2">
                      {requires.map((m) => (
                        <Badge key={m} color="neutral" variant="soft" size="sm">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="text-base-content text-xs">Version {item.version}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {related.length > 0 ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Related {category.label.toLowerCase()}
            </h2>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(16rem,100%),1fr))' }}
            >
              {related.map((r) => (
                <ListingCard key={r.slug} item={r} canInstall={canInstall} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
