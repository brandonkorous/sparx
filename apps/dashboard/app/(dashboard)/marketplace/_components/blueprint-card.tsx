// A blueprint catalog card (docs/60). Used on the home featured grid, the browse
// grid, and the detail "related" strip. Thumb + title link to the detail page;
// quick install/review lives inline via BlueprintCardActions (shared with the
// install lifecycle, docs/54 §8).

import Link from 'next/link';
import { Badge, Card, CardContent, CardHeader, CardTitle, Stack, Text } from '@sparx/ui';

import type { CatalogItem } from '../_types';
import { BlueprintCardActions } from './blueprint-card-actions';

function contentBadges(c: CatalogItem['contents']): string[] {
  return [
    `${c.products} products`,
    `${c.content} content`,
    `${c.pages} pages`,
    `${c.emails} emails`,
    `${c.components} components`,
    `Theme: ${c.theme}`,
  ];
}

export function BlueprintCard({ item, canInstall }: { item: CatalogItem; canInstall: boolean }) {
  const href = `/marketplace/blueprints/${item.key}`;
  return (
    <Card variant="module" className="flex flex-col overflow-hidden">
      {item.preview ? (
        <Link href={href} className="block">
          <img
            src={item.preview}
            alt={`${item.name} preview`}
            className="aspect-[16/10] w-full border-b border-[var(--color-border)] object-cover object-top"
          />
        </Link>
      ) : null}
      <CardHeader>
        <Stack direction="row" align="center" gap={2} className="justify-between">
          <CardTitle className="min-w-0 truncate">
            <Link href={href} className="hover:underline">
              {item.name}
            </Link>
          </CardTitle>
          <Badge variant="soft">{item.vertical}</Badge>
        </Stack>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <Stack gap={3} className="flex-1">
          <Text size="sm" variant="muted" className="line-clamp-2">
            {item.summary}
          </Text>
          <div className="flex flex-wrap gap-2">
            {contentBadges(item.contents).map((b) => (
              <Badge key={b} variant="outline">
                {b}
              </Badge>
            ))}
          </div>
          <div className="mt-auto pt-1">
            <BlueprintCardActions
              blueprintKey={item.key}
              blueprintName={item.name}
              latestVersion={item.version}
              install={item.install}
              canInstall={canInstall}
            />
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
