import { Heart } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState, Table } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

interface TopVariant {
  variantId: string;
  sku: string;
  variantTitle: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
  saveCount: number;
}

interface WishlistAnalytics {
  wishlistCount: number;
  itemCount: number;
  topVariants: TopVariant[];
}

export default async function WishlistsPage() {
  const analytics = await api.get<WishlistAnalytics>('/v1/commerce/wishlists/analytics?take=50');
  const { wishlistCount, itemCount, topVariants } = analytics;

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Heart className="h-5 w-5" />}
          title="Wishlists"
          badge={
            <Badge color="module">
              {wishlistCount} lists · {itemCount} items
            </Badge>
          }
          description="Analytics view. Customers own their wishlists; staff do not edit them. Use this list to decide restock priority, promo targeting, and which abandoned-wishlist nudges to send."
        />

        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Most-saved variants</h3>
              <p className="opacity-70">
                Aggregated across every customer wishlist in the tenant. Top 50.
              </p>
            </div>
            {topVariants.length === 0 ? (
              <EmptyState
                icon={<Heart className="h-5 w-5" />}
                title="No saves yet"
                description="Once the storefront ships, wishlist saves show up here within seconds."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="text-right">Saved by</th>
                  </tr>
                </thead>
                <tbody>
                  {topVariants.map((row) => (
                    <tr key={row.variantId}>
                      <td>
                        {row.variantTitle ? (
                          <p className="text-sm">{row.variantTitle}</p>
                        ) : (
                          <p className="text-base-content/70 text-sm">Default</p>
                        )}
                      </td>
                      <td>
                        <p className="font-mono text-xs">{row.sku}</p>
                      </td>
                      <td>{row.productTitle}</td>
                      <td className="text-right">
                        <Badge color="module" variant="soft" size="sm">
                          {row.saveCount}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
