'use client';

// State and actions for a return that already exists: send it, record the
// credit, write it off, abandon it, or save its tracking number.

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { moneyCents, moneyText } from '../../components/money-input';
import { useConfirm } from '../../lib/confirm';
import { afterCommit } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, stockErrorMessage } from './data';
import {
  useCancelSupplierReturn,
  useCloseSupplierReturn,
  useRecordSupplierCredit,
  useSendSupplierReturn,
  useSupplierReturn,
  useUpdateSupplierReturn,
  type SupplierReturnDetail,
} from './supplier-returns-data';

// Spelled out because the toast's inferred type cannot be named here (TS2883).
export interface ExistingReturnState {
  data: SupplierReturnDetail | undefined;
  update: ReturnType<typeof useUpdateSupplierReturn>;
  send: ReturnType<typeof useSendSupplierReturn>;
  credit: ReturnType<typeof useRecordSupplierCredit>;
  close: ReturnType<typeof useCloseSupplierReturn>;
  cancel: ReturnType<typeof useCancelSupplierReturn>;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
  creditAmount: string;
  setCreditAmount: Dispatch<SetStateAction<string>>;
  tracking: string;
  setTracking: Dispatch<SetStateAction<string>>;
  trackingDirty: boolean;
  setTrackingDirty: Dispatch<SetStateAction<boolean>>;
}

export function useExistingReturn(id: string): ExistingReturnState {
  const existing = useSupplierReturn(id);
  const update = useUpdateSupplierReturn(id);
  const send = useSendSupplierReturn(id);
  const credit = useRecordSupplierCredit(id);
  const close = useCloseSupplierReturn(id);
  const cancel = useCancelSupplierReturn(id);
  const confirm = useConfirm();
  const toast = useToast();

  const data = existing.data;
  const [creditAmount, setCreditAmount] = useState('');
  const [tracking, setTracking] = useState('');
  const [trackingDirty, setTrackingDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCreditAmount(moneyText(data.creditExpectedCents));
    setTracking(data.trackingNumber ?? '');
    setTrackingDirty(false);
  }, [data]);

  return {
    data,
    update,
    send,
    credit,
    close,
    cancel,
    confirm,
    toast,
    creditAmount,
    setCreditAmount,
    tracking,
    setTracking,
    trackingDirty,
    setTrackingDirty,
  };
}

type Fail = (title: string) => (error: unknown) => void;

async function sendReturn(s: ExistingReturnState, data: SupplierReturnDetail, fail: Fail) {
  const ok = await s.confirm({
    title: `Send ${data.number} back?`,
    description: `${plural(data.lines.length, 'item', 'items')} will come off the shelf at ${data.warehouseName ?? 'this location'}, and ${formatCents(data.creditExpectedCents, data.currency)} goes on the list of what this supplier owes you. This cannot be undone from here: a mistake is corrected with a count.`,
    confirmLabel: 'It has gone back',
    cancelLabel: 'Not yet',
    color: 'warning',
  });
  if (!ok) return;
  s.send.mutate(undefined, {
    onSuccess: () => {
      afterCommit(() => {
        s.toast.add({
          title: `${data.number} sent`,
          description: `${formatCents(data.creditExpectedCents, data.currency)} now owed by ${data.supplierName ?? 'the supplier'}.`,
          type: 'success',
        });
      });
    },
    onError: fail('Could not send that return'),
  });
}

function recordCredit(s: ExistingReturnState, fail: Fail) {
  // Read the way a person writes money: "1,250.00", "$8.00" (issue 486).
  const creditReceivedCents = s.creditAmount.trim() === '' ? null : moneyCents(s.creditAmount);
  if (creditReceivedCents === null) return;
  s.credit.mutate(
    { creditReceivedCents },
    {
      onSuccess: (saved) => {
        afterCommit(() => {
          s.toast.add({
            title: 'Credit recorded',
            description:
              (saved.creditShortfallCents ?? 0) > 0
                ? `${formatCents(saved.creditShortfallCents ?? 0, saved.currency)} less than expected: worth querying.`
                : 'Settled in full.',
            type: (saved.creditShortfallCents ?? 0) > 0 ? 'warning' : 'success',
          });
        });
      },
      onError: fail('Could not record that credit'),
    }
  );
}

async function writeOff(s: ExistingReturnState, data: SupplierReturnDetail, fail: Fail) {
  const ok = await s.confirm({
    title: `Write off ${formatCents(data.creditExpectedCents, data.currency)}?`,
    description:
      'This says you have accepted that no credit is coming. The return stays on the record, and the money stops being chased.',
    confirmLabel: 'Write it off',
    cancelLabel: 'Keep chasing',
    color: 'danger',
  });
  if (!ok) return;
  s.close.mutate('No credit expected: written off.', {
    onSuccess: () => {
      afterCommit(() => {
        s.toast.add({ title: `${data.number} written off`, type: 'info' });
      });
    },
    onError: fail('Could not close that return'),
  });
}

async function abandon(
  ctx: SurfaceContext,
  s: ExistingReturnState,
  data: SupplierReturnDetail,
  fail: Fail
) {
  const ok = await s.confirm({
    title: `Abandon ${data.number}?`,
    description: 'Nothing has left the shelf, so nothing needs putting back. The record stays.',
    confirmLabel: 'Abandon it',
    cancelLabel: 'Keep it',
    color: 'danger',
  });
  if (!ok) return;
  s.cancel.mutate(undefined, {
    onSuccess: () => {
      afterCommit(() => {
        s.toast.add({ title: `${data.number} abandoned`, type: 'info' });
      });
      ctx.close();
    },
    onError: fail('Could not abandon that return'),
  });
}

function saveTracking(s: ExistingReturnState, fail: Fail) {
  s.update.mutate(
    { trackingNumber: s.tracking.trim() === '' ? null : s.tracking.trim() },
    {
      onSuccess: () => {
        s.setTrackingDirty(false);
        afterCommit(() => {
          s.toast.add({ title: 'Tracking saved', type: 'success' });
        });
      },
      onError: fail('Could not save that tracking number'),
    }
  );
}

export function returnActions(
  ctx: SurfaceContext,
  s: ExistingReturnState,
  data: SupplierReturnDetail
) {
  const fail = (title: string) => (error: unknown) => {
    afterCommit(() => {
      s.toast.add({
        title,
        description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
        type: 'error',
      });
    });
  };

  return {
    onSend: () => sendReturn(s, data, fail),
    onCredit: () => {
      recordCredit(s, fail);
    },
    onClose: () => writeOff(s, data, fail),
    onCancel: () => abandon(ctx, s, data, fail),
    onSaveTracking: () => {
      saveTracking(s, fail);
    },
  };
}

export type ReturnActions = ReturnType<typeof returnActions>;
