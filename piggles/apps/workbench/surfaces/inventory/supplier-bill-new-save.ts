// Sending a newly entered supplier's invoice, then turning this pane into
// the saved invoice so a second press cannot enter it twice.

import type { useToast } from '@wizeworks/silicaui-react';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural, stockErrorMessage } from './data';
import type { SupplierBillInput, useCreateSupplierBill } from './supplier-bills-data';

interface SubmitSupplierBillArgs {
  ctx: SurfaceContext;
  create: ReturnType<typeof useCreateSupplierBill>;
  toast: ReturnType<typeof useToast>;
  input: SupplierBillInput;
}

export function submitSupplierBill({ ctx, create, toast, input }: SubmitSupplierBillArgs): void {
  create.mutate(input, {
    onSuccess: (saved) => {
      afterCommit(() => {
        toast.add({
          title: `Invoice ${saved.number} entered`,
          description:
            saved.match.ok === false
              ? `${plural(saved.match.linesFlagged, 'line', 'lines')} ${saved.match.linesFlagged === 1 ? 'does' : 'do'} not agree with the delivery: have a look before it is paid.`
              : 'It agrees with what was ordered and received.',
          type: saved.match.ok === false ? 'warning' : 'success',
        });
      });
      ctx.open('inventory.supplier-bills.detail', { id: saved.id }, { target: 'replace' });
    },
    onError: (error) => {
      afterCommit(() => {
        toast.add({
          title: 'Could not enter that invoice',
          description: stockErrorMessage(error, 'Nothing was saved. Please try again.'),
          type: 'error',
        });
      });
    },
  });
}
