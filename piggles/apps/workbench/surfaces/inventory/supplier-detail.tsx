'use client';

// ONE SUPPLIER: set them up, keep their details current, record what you buy from
// them, and retire them. Create and edit are one pane (`{id:'new'}` before it
// exists), with one explicit Save and a leave-guard while there are unsaved edits.

import { Card } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PriceLadders, SupplierScorecardPanel } from './supplier-performance-panels';
import type { SupplierDetail } from './suppliers-data';
import {
  SupplierReachSection,
  SupplierTermsSection,
  SupplierWhoSection,
} from './supplier-detail-fields';
import { SupplierAddressSection, SupplierNotesSection } from './supplier-detail-address';
import { PurchasingLinks } from './supplier-detail-links';
import { SupplierPurchaseOrders } from './supplier-detail-orders';
import { SupplierRetireRow } from './supplier-detail-retire';
import { SupplierToolbar } from './supplier-detail-toolbar';
import { useSupplierDetail, type SupplierDetailState } from './use-supplier-detail';

// One centered, capped column: a handful of grouped fields with no running
// summary worth standing beside them, so not a form chassis with an empty rail.
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

// A failed load REPLACES the form, never an empty one beside a dead Save.
function SupplierLoadError({ supplier }: { supplier: SupplierDetailState['supplier'] }) {
  return (
    <div className={PANE_SHELL}>
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          error={supplier.error}
          title="Could not load this supplier"
          description="This is a problem reaching the server. The supplier record is unaffected."
          missingTitle="This supplier no longer exists"
          missingDescription="It may have been removed. Its past orders are unaffected."
          onRetry={() => {
            void supplier.refetch();
          }}
        />
      </Card>
    </div>
  );
}

// Everything here needs a saved supplier to hang off. The scorecard sits right
// under the stated terms, because its point is the gap between the two.
function SupplierSavedSections({
  ctx,
  detail,
  data,
}: {
  ctx: SurfaceContext;
  detail: SupplierDetailState;
  data: SupplierDetail;
}) {
  const { id } = detail;
  return (
    <>
      <SupplierScorecardPanel supplierId={id} statedLeadTimeDays={data.leadTimeDays} />

      <PurchasingLinks supplierId={id} variants={data.variants} currency={data.currency} />

      <PriceLadders variants={data.variants} currency={data.currency} />

      <SupplierPurchaseOrders supplierId={id} ctx={ctx} />

      <SupplierRetireRow
        isActive={data.isActive}
        archiving={detail.archiving}
        onArchive={detail.onArchive}
      />
    </>
  );
}

export function SupplierDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const detail = useSupplierDetail(ctx);
  const { isNew, supplier, form, set } = detail;

  if (!isNew && supplier.isError) return <SupplierLoadError supplier={supplier} />;

  if (!isNew && (supplier.isPending || !detail.loaded)) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <SupplierToolbar detail={detail} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <SupplierWhoSection
            form={form}
            set={set}
            touched={detail.touched}
            codeOk={detail.codeOk}
          />
          <SupplierReachSection form={form} set={set} />
          <SupplierTermsSection form={form} set={set} />
          <SupplierAddressSection form={form} set={set} />
          <SupplierNotesSection form={form} set={set} />

          {isNew || !supplier.data ? null : (
            <SupplierSavedSections ctx={ctx} detail={detail} data={supplier.data} />
          )}
        </div>
      </div>
    </div>
  );
}
