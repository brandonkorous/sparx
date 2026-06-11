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
import { Badge, Button, Card, CardContent, Container, Grid, Heading, Stack, Text } from '@sparx/ui';
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
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
          <Link href={`/marketplace/${category.id}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {category.label}
          </Link>
        </Button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {preview ? (
              <img
                src={preview}
                alt={`${item.name} preview`}
                className="w-full rounded-lg border border-[var(--color-border)]"
              />
            ) : (
              <div className="aspect-[16/10] w-full rounded-lg border border-[var(--color-border)]" />
            )}
            <Text variant="muted" className="mt-4">
              {item.description ?? item.tagline ?? ''}
            </Text>
          </div>

          <Card variant="module">
            <CardContent>
              <Stack gap={4}>
                {tag ? (
                  <Badge variant="soft" className="self-start">
                    {tag}
                  </Badge>
                ) : null}
                <Heading level={1}>{item.name}</Heading>
                <ListingCardActions item={item} canInstall={canInstall} detail />
                {included.length > 0 ? (
                  <div>
                    <Text size="sm" weight="medium" className="mb-2">
                      What&apos;s included
                    </Text>
                    <Stack gap={1}>
                      {included.map((line) => (
                        <Text key={line} size="sm" variant="muted">
                          {line}
                        </Text>
                      ))}
                    </Stack>
                  </div>
                ) : null}
                {requires.length > 0 ? (
                  <div>
                    <Text size="sm" weight="medium" className="mb-2">
                      Requires
                    </Text>
                    <div className="flex flex-wrap gap-2">
                      {requires.map((m) => (
                        <Badge key={m} variant="outline">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Text size="xs" variant="muted">
                  Version {item.version}
                </Text>
              </Stack>
            </CardContent>
          </Card>
        </div>

        {related.length > 0 ? (
          <Stack gap={4}>
            <Heading level={2}>Related {category.label.toLowerCase()}</Heading>
            <Grid minItemWidth="16rem" gap={4}>
              {related.map((r) => (
                <ListingCard key={r.slug} item={r} canInstall={canInstall} />
              ))}
            </Grid>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
