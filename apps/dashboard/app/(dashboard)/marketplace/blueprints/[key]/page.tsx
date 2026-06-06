// /marketplace/blueprints/[key] — a single blueprint's detail page (docs/60 §7):
// preview gallery + an action panel (what's included, requirements, version, and
// the shared install/review CTA) + a related strip. Install lifecycle is unchanged
// (docs/54 §8) — BlueprintCardActions drives it and links to the review surface.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Badge, Button, Card, CardContent, Container, Grid, Heading, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { BrowseResponse, CatalogItem } from '../../_types';
import { BlueprintCard } from '../../_components/blueprint-card';
import { BlueprintCardActions } from '../../_components/blueprint-card-actions';

export const dynamic = 'force-dynamic';

export default async function BlueprintDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';

  const item = await api
    .get<CatalogItem>(`/v1/marketplace/blueprints/${encodeURIComponent(key)}`)
    .catch(() => null);
  if (!item) notFound();

  const related = await api
    .get<BrowseResponse>('/v1/marketplace/blueprints?limit=4')
    .then((r) => r.items.filter((i) => i.key !== item.key).slice(0, 3))
    .catch(() => [] as CatalogItem[]);

  const includes = [
    `${item.contents.products} products`,
    `${item.contents.pages} pages`,
    `${item.contents.content} content entries`,
    `${item.contents.emails} emails`,
    `${item.contents.components} components`,
    `${item.contents.theme} theme`,
  ];

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
          <Link href="/marketplace/blueprints">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Blueprints
          </Link>
        </Button>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {item.preview ? (
              <img
                src={item.preview}
                alt={`${item.name} preview`}
                className="w-full rounded-lg border border-[var(--color-border)]"
              />
            ) : (
              <div className="aspect-[16/10] w-full rounded-lg border border-[var(--color-border)]" />
            )}
            <Text variant="muted" className="mt-4">
              {item.summary}
            </Text>
          </div>

          <Card variant="module">
            <CardContent>
              <Stack gap={4}>
                <Badge variant="soft" className="self-start">
                  {item.vertical}
                </Badge>
                <Heading level={1}>{item.name}</Heading>
                <BlueprintCardActions
                  blueprintKey={item.key}
                  blueprintName={item.name}
                  latestVersion={item.version}
                  install={item.install}
                  canInstall={canInstall}
                />
                <div>
                  <Text size="sm" weight="medium" className="mb-2">
                    What&apos;s included
                  </Text>
                  <Stack gap={1}>
                    {includes.map((line) => (
                      <Text key={line} size="sm" variant="muted">
                        {line}
                      </Text>
                    ))}
                  </Stack>
                </div>
                <div>
                  <Text size="sm" weight="medium" className="mb-2">
                    Requires
                  </Text>
                  <div className="flex flex-wrap gap-2">
                    {item.requiresModules.map((m) => (
                      <Badge key={m} variant="outline">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Text size="xs" variant="muted">
                  Version {item.version}
                </Text>
              </Stack>
            </CardContent>
          </Card>
        </div>

        {related.length > 0 ? (
          <Stack gap={4}>
            <Heading level={2}>Related blueprints</Heading>
            <Grid minItemWidth="16rem" gap={4}>
              {related.map((r) => (
                <BlueprintCard key={r.key} item={r} canInstall={canInstall} />
              ))}
            </Grid>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
