// A marketplace category tile (docs/60 §3 home). Live categories link to their
// browse route; coming-soon categories render a non-interactive tile with a
// badge. The accent is catalog data applied as an inline style (a stripe + icon
// chip), not a control variant.

import Link from 'next/link';
import { Badge, Card, CardContent, Stack, Text } from '@sparx/ui';

import type { MarketplaceCategory } from '../_registry';

export function CategoryTile({
  category,
  count,
}: {
  category: MarketplaceCategory;
  count?: number;
}) {
  const Icon = category.icon;
  const live = category.status === 'live';

  const inner = (
    <Card className="relative h-full overflow-hidden transition-shadow hover:shadow-md">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: category.accent }}
      />
      <CardContent>
        <Stack gap={3}>
          <div className="flex items-center justify-between">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: category.accent }}
            >
              <Icon className="h-5 w-5" />
            </span>
            {live ? (
              count != null ? (
                <Text size="sm" weight="medium">
                  {count.toLocaleString()}
                </Text>
              ) : null
            ) : (
              <Badge color="info" variant="soft">
                Coming soon
              </Badge>
            )}
          </div>
          <div>
            <Text weight="medium">{category.label}</Text>
            <Text size="sm" variant="muted" className="mt-1">
              {category.tagline}
            </Text>
          </div>
        </Stack>
      </CardContent>
    </Card>
  );

  if (!live) return <div className="opacity-75">{inner}</div>;
  return (
    <Link href={`/marketplace/${category.id}`} className="block">
      {inner}
    </Link>
  );
}
