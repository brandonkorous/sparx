'use client';

// Entering a supplier's invoice: its own screen, apart from deciding whether to pay one.
// Lines start from the ORDER at the agreed price and received quantity, so a change is a
// real difference, not a typo. A bill with no order behind it can be entered, not checked.

import { Heading } from '@wizeworks/silicaui-react';
import { PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useSupplierBillDraft } from './use-supplier-bill-draft';
import {
  BillInvoiceSection,
  BillOrderSection,
  BillSaveRow,
  ChooseOrderAlert,
} from './supplier-bill-new-sections';
import { BillChargesSection } from './supplier-bill-new-charges';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

export function NewSupplierBill({ ctx }: { ctx: SurfaceContext }) {
  const draft = useSupplierBillDraft(ctx);

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className={COLUMN}>
        <Heading level={2} className="text-lg">
          Enter a supplier&apos;s invoice
        </Heading>

        <BillOrderSection draft={draft} />

        {draft.purchaseOrderId === '' ? <ChooseOrderAlert draft={draft} ctx={ctx} /> : null}

        {draft.purchaseOrderId !== '' ? (
          <>
            <BillInvoiceSection draft={draft} />
            <BillChargesSection draft={draft} />
            <BillSaveRow draft={draft} />
          </>
        ) : null}
      </div>
    </div>
  );
}
