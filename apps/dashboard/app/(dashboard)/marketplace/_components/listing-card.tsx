// A generic marketplace listing card (docs/60) — used on the home featured grid,
// the category browse grid, and the detail "related" strip, for ANY category.
// Thumb + title link to the detail page; the category-specific tag, content
// badges, and primary action are derived from the listing's typed block, so one
// card renders blueprints, themes, components, and integrations alike.

import Link from 'next/link';
import { Badge, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
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
    <Card className="flex flex-col overflow-hidden">
      {preview ? (
        <Link href={href} className="block">
          <img
            src={preview}
            alt={`${item.name} preview`}
            className="border-base-300 aspect-[16/10] w-full border-b object-cover object-top"
          />
        </Link>
      ) : null}
      <CardBody className="flex flex-1 flex-col">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="min-w-0 truncate">
            <Link href={href} className="hover:underline">
              {item.name}
            </Link>
          </CardTitle>
          {tag ? <Badge variant="soft">{tag}</Badge> : null}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-base-content line-clamp-2 text-sm">
            {item.tagline ?? item.description ?? ''}
          </p>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <Badge key={b} color="neutral" variant="soft" size="sm">
                  {b}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="mt-auto pt-1">
            <ListingCardActions item={item} canInstall={canInstall} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
