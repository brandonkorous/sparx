import { notFound } from 'next/navigation';
import { Layers, Sparkles, Star } from 'lucide-react';

import { TabsContent, TabsList, TabsTrigger } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';

import { DetailHeaderSlot } from '../../../_components/detail-header-slot';
import { GuardedTabs } from '../../../_components/guarded-tabs';

import { CollectionMembershipEditor } from './_components/collection-membership-editor';
import { CollectionMetaForm } from './_components/collection-meta-form';

interface CollectionDetail {
  id: string;
  name: string;
  handle: string;
  type: 'manual' | 'rules';
  productCount: number;
  featured: boolean;
  updatedAt: string;
  description: string | null;
  heroMediaId: string | null;
  ruleSet: Record<string, unknown> | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageId: string | null;
  productIds: string[];
  propertyIds: string[];
  createdAt: string;
}

interface ProductListItem {
  id: string;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  vendor: string | null;
  productType: string | null;
  variantCount: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  imageUrl: string | null;
  tags: string[];
  updatedAt: string;
}

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function CollectionDetailContent({ id }: Props) {
  let collection: CollectionDetail;
  try {
    collection = await api.get<CollectionDetail>(`/v1/commerce/collections/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const { data: allProducts } = await api.getPaged<ProductListItem[]>(
    '/v1/commerce/products?take=250'
  );

  // Multi-site (docs/49 §3): the tenant's sites, for the "Visible on sites" control
  // on the Metadata tab. Defensive — a sites-read failure must not break the editor,
  // and SiteScopeField hides itself for single-site tenants anyway.
  const sites = await listProperties().catch(() => [] as Property[]);

  return (
    <>
      {/* Identity (name + handle) lives ONLY in the editable fields on the
          Metadata tab — no read-only heading restating them. The type + featured
          signals teleport into the active frame's header bar; the product count
          already rides on the Products tab badge. */}
      <DetailHeaderSlot>
        <Badge color={collection.type === 'rules' ? 'module' : 'neutral'} variant="soft">
          {collection.type === 'rules' ? (
            <>
              <Sparkles className="mr-1 h-3 w-3" />
              rules
            </>
          ) : (
            'manual'
          )}
        </Badge>
        {collection.featured && (
          <Badge color="accent" variant="soft">
            <Star className="mr-1 h-3 w-3" />
            featured
          </Badge>
        )}
      </DetailHeaderSlot>

      <GuardedTabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">
            <Layers className="mr-2 h-4 w-4" />
            Products
            <Badge variant="soft" size="sm" className="ml-2">
              {collection.productCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="meta">Metadata</TabsTrigger>
          {collection.type === 'rules' && <TabsTrigger value="rules">Rules</TabsTrigger>}
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Membership</h3>
                <p className="opacity-70">
                  {collection.type === 'manual'
                    ? 'Pick which products belong to this collection. Order maps to storefront sort.'
                    : 'Rules-driven membership is read-only here. Edit the ruleSet on the Rules tab; the indexer worker re-projects on the next flush.'}
                </p>
              </div>
              <CollectionMembershipEditor
                collectionId={collection.id}
                type={collection.type}
                selectedProductIds={collection.productIds}
                allProducts={allProducts.map((p) => ({
                  id: p.id,
                  title: p.title,
                  handle: p.handle,
                  status: p.status,
                  vendor: p.vendor,
                }))}
              />
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="meta">
          <CollectionMetaForm
            collectionId={collection.id}
            name={collection.name}
            handle={collection.handle}
            description={collection.description}
            featured={collection.featured}
            seoTitle={collection.seoTitle}
            seoDescription={collection.seoDescription}
            sites={sites}
            initialPropertyIds={collection.propertyIds ?? []}
          />
        </TabsContent>

        {collection.type === 'rules' && (
          <TabsContent value="rules">
            <Card>
              <CardBody>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-semibold">Rule editor — Phase 1.5</h3>
                  <p className="opacity-70">
                    The full rule editor (title / vendor / product_type / tag / price / inventory /
                    fitment predicates with AND/OR matching) lands alongside the commerce-indexer
                    worker. Today this collection&apos;s seeded ruleSet is persisted as-is;
                    merchants can still edit metadata and watch the projection.
                  </p>
                </div>
                <pre className="border-base-300 bg-base-200 overflow-auto rounded border p-3 text-xs">
                  {JSON.stringify(collection.ruleSet ?? {}, null, 2)}
                </pre>
              </CardBody>
            </Card>
          </TabsContent>
        )}
      </GuardedTabs>
    </>
  );
}
