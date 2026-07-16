// A marketplace category tile (docs/60 §3 home). Live categories link to their
// browse route; coming-soon categories render a non-interactive tile with a
// badge. The accent is catalog data applied as an inline style (a stripe + icon
// chip), not a control variant.

import Link from 'next/link';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

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
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: category.accent }}
            >
              <Icon className="h-5 w-5" />
            </span>
            {live ? (
              count != null ? (
                <p className="text-sm font-medium">{count.toLocaleString()}</p>
              ) : null
            ) : (
              <Badge color="info" variant="soft">
                Coming soon
              </Badge>
            )}
          </div>
          <div>
            <p className="font-medium">{category.label}</p>
            <p className="text-base-content mt-1 text-sm">{category.tagline}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  if (!live) return <div className="opacity-75">{inner}</div>;
  return (
    <Link href={`/marketplace/${category.id}`} className="block">
      {inner}
    </Link>
  );
}
