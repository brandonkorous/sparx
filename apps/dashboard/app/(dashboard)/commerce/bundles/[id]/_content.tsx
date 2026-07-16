import { notFound } from 'next/navigation';
import { Package2 } from 'lucide-react';

import { statusLabel } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import {
  BundleEditor,
  type ComponentDraft,
  type VariantOption,
} from '../_components/bundle-editor';
import { BundleDeleteButton } from './_components/bundle-delete-button';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

interface BundleComponent {
  id: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  defaultQuantity: number;
  isRequired: boolean;
  isSwappable: boolean;
  swappableProductId: string | null;
  position: number;
}

interface BundleDetail {
  id: string;
  bundleProductId: string;
  bundleProductTitle: string;
  pricingMode: string;
  fixedPriceCents: number | null;
  percentOffSum: number | null;
  inventoryMode: string;
  componentCount: number;
  updatedAt: string;
  components: BundleComponent[];
}

interface VariantListRow {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  productId: string;
  productTitle: string;
  productHandle: string;
  productStatus: string;
  archivedAt: string | null;
}

export async function BundleDetailContent({ id }: Props) {
  let bundle: BundleDetail;
  try {
    bundle = await api.get<BundleDetail>(`/v1/commerce/bundles/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const variantRows = await api.get<VariantListRow[]>('/v1/commerce/variants?take=500');
  const variants: VariantOption[] = variantRows.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    priceCents: v.priceCents,
    productId: v.productId,
    productTitle: v.productTitle,
  }));

  const initialComponents: ComponentDraft[] = bundle.components.map((c) => ({
    variantId: c.variantId,
    defaultQuantity: c.defaultQuantity,
    isRequired: c.isRequired,
    isSwappable: c.isSwappable,
    swappableProductId: c.swappableProductId,
    position: c.position,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Delete is a lifecycle action — teleports into the shared detail
          chrome's header (drawer/modal chrome or the full-page shell), parity
          with every other entity's Archive/Delete control. */}
      <DetailHeaderSlot>
        <BundleDeleteButton bundleId={bundle.id} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Package2 className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{bundle.bundleProductTitle}</h1>
            <Badge color="info" variant="soft" size="sm">
              {statusLabel(bundle.pricingMode)}
            </Badge>
            <Badge color="neutral" variant="soft" size="sm">
              {statusLabel(bundle.inventoryMode)}
            </Badge>
          </div>
          <p className="text-base-content text-sm">
            {bundle.componentCount} component{bundle.componentCount === 1 ? '' : 's'} · updated{' '}
            {new Date(bundle.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Configuration</h3>
            <p className="opacity-70">
              Edit pricing, inventory mode, and component list. Saving replaces the entire component
              list (small + simple beats diffing).
            </p>
          </div>
          <BundleEditor
            bundleId={bundle.id}
            products={[]}
            variants={variants}
            initialBundleProductId={bundle.bundleProductId}
            initialPricingMode={
              bundle.pricingMode as 'sum_of_components' | 'fixed' | 'percent_off_sum'
            }
            initialFixedPriceCents={bundle.fixedPriceCents}
            initialPercentOffSum={bundle.percentOffSum}
            initialInventoryMode={
              bundle.inventoryMode as 'decrement_components' | 'decrement_bundle_sku'
            }
            initialComponents={initialComponents}
          />
        </CardBody>
      </Card>
    </div>
  );
}
