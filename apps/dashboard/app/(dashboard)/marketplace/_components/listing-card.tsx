// A generic marketplace listing card (docs/60) — used on the home featured grid,
// the category browse grid, and the detail "related" strip, for ANY category.
// Thumb + title link to the detail page; the category-specific tag, content
// badges, and primary action are derived from the listing's typed block, so one
// card renders blueprints, themes, components, and integrations alike.

import Link from 'next/link';
import { Badge, Card, CardContent, CardHeader, CardTitle, Stack, Text } from '@sparx/ui';
import type { MarketplaceListing } from '../_types';

import { ListingCardActions } from './listing-card-actions';

const ACRONYMS: Record<string, string> = { b2b: 'B2B', cms: 'CMS', crm: 'CRM', seo: 'SEO' };
function humanize(v: string): string {
  return ACRONYMS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

/** The single "tag" badge beside the title (vertical / industry / group / kind). */
function listingTag(l: MarketplaceListing): string | null {
  if (l.blueprint) return humanize(l.blueprint.vertical);
  if (l.theme) return l.theme.industry ? humanize(l.theme.industry) : l.theme.mood;
  if (l.component) return humanize(l.component.group);
  if (l.integration) return humanize(l.integration.kind);
  return null;
}

/** The content badges below the tagline — what the listing brings. */
function listingBadges(l: MarketplaceListing): string[] {
  if (l.blueprint) {
    const c = l.blueprint.contents;
    return [
      `${c.products} products`,
      `${c.content} content`,
      `${c.pages} pages`,
      `${c.emails} emails`,
      `${c.components} components`,
      `Theme: ${c.theme}`,
    ];
  }
  if (l.component) return l.component.surfaces.map(humanize);
  if (l.integration) return l.integration.scopes.slice(0, 4);
  return [];
}

export function ListingCard({
  item,
  canInstall,
}: {
  item: MarketplaceListing;
  canInstall: boolean;
}) {
  const href = `/marketplace/${item.category}/${item.slug}`;
  const preview = item.media[0]?.url;
  const tag = listingTag(item);
  const badges = listingBadges(item);

  return (
    <Card variant="module" className="flex flex-col overflow-hidden">
      {preview ? (
        <Link href={href} className="block">
          <img
            src={preview}
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
          {tag ? <Badge variant="soft">{tag}</Badge> : null}
        </Stack>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <Stack gap={3} className="flex-1">
          <Text size="sm" variant="muted" className="line-clamp-2">
            {item.tagline ?? item.description ?? ''}
          </Text>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <Badge key={b} variant="outline">
                  {b}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="mt-auto pt-1">
            <ListingCardActions item={item} canInstall={canInstall} />
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
