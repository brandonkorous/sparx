'use client';

// What the buttons on a count session DO — save, finish, approve, apply,
// discard, remove a line. Separated from the session so the pane holds state and
// draws, and this holds the consequences.
//
// ── The one guard that matters: applying ─────────────────────────────────
//
// Entering counts is routine and saved on demand. APPLYING a count writes a
// correction to every real stock number through the ledger and cannot be undone,
// so a count whose differences are large — in money OR in units — is named in
// plain figures before it is written. Both terms are needed: the money catches a
// costly swing, the units catch a big swing in items whose cost was never
// entered, whose value therefore reads as zero. Small counts apply without
// ceremony, so the confirm still means something when it appears.

import { useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { formatCents, plural } from './data';
import {
  countErrorMessage,
  useApproveCount,
  useCancelCount,
  useEnterCounts,
  usePostCount,
  useRemoveCountLine,
  useSubmitCount,
  type CountDetail,
  type CountLine,
} from './counts-data';
import { BIG_VARIANCE_UNITS } from './count-shared';

/** A line whose typed value is valid and actually differs from what the server
 *  holds — the only ones a Save needs to send. */
export interface ChangedLine {
  line: CountLine;
  value: number;
}

export function useCountActions(count: CountDetail, changed: ChangedLine[]) {
  const toast = useToast();
  const confirm = useConfirm();

  const enter = useEnterCounts(count.id);
  const submit = useSubmitCount(count.id);
  const approve = useApproveCount(count.id);
  const post = usePostCount(count.id);
  const cancel = useCancelCount(count.id);
  const removeLine = useRemoveCountLine(count.id);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const fail = (title: string, fallback: string) => (error: unknown) => {
    toast.add({ title, description: countErrorMessage(error, fallback), type: 'error' });
  };

  const saveEntries = () =>
    enter.mutateAsync(
      changed.map(({ line, value }) => ({ lineId: line.id, countedQuantity: value }))
    );

  const totalUnitVariance = count.lines.reduce(
    (sum, line) => sum + (line.variance === null ? 0 : Math.abs(line.variance)),
    0
  );
  const differing = count.lines.filter(
    (line) => line.variance !== null && line.variance !== 0
  ).length;

  const doSave = async () => {
    if (changed.length === 0) return;
    try {
      await saveEntries();
      afterPaneChange(() => {
        toast.add({ title: 'Counts saved', type: 'success' });
      });
    } catch (error) {
      fail('Could not save those counts', 'Nothing was changed.')(error);
    }
  };

  const doFinish = async () => {
    try {
      if (changed.length > 0) await saveEntries();
      await submit.mutateAsync();
      afterPaneChange(() => {
        toast.add({
          title: 'Counting finished',
          description: 'Review the differences below, then apply them to correct your stock.',
          type: 'success',
        });
      });
    } catch (error) {
      fail('Could not finish the count', 'Nothing was changed.')(error);
    }
  };

  const doApprove = async () => {
    try {
      await approve.mutateAsync();
      afterPaneChange(() => {
        toast.add({ title: 'Count approved', type: 'success' });
      });
    } catch (error) {
      fail('Could not approve the count', 'Only a manager can approve this.')(error);
    }
  };

  const doApply = async () => {
    const big =
      count.varianceValueCents > count.approvalThresholdCents ||
      totalUnitVariance >= BIG_VARIANCE_UNITS;
    if (big) {
      const worth =
        count.varianceValueCents > 0
          ? `, worth ${formatCents(count.varianceValueCents)} in all`
          : '';
      const ok = await confirm({
        title: `Apply ${count.number} and correct your stock?`,
        description: `This changes ${plural(differing, 'item', 'items')} at ${
          count.warehouseName ?? 'this location'
        }${worth}. Your on-hand numbers are corrected straight away and the change is recorded against your name. This cannot be undone — if a figure looks wrong, go back before applying.`,
        confirmLabel: 'Yes, apply it',
        cancelLabel: 'Go back',
        color: 'danger',
      });
      if (!ok) return;
    }
    try {
      await post.mutateAsync();
      afterPaneChange(() => {
        toast.add({
          title: `${count.number} applied`,
          description: `${plural(differing, 'item was', 'items were')} corrected.`,
          type: 'success',
        });
      });
    } catch (error) {
      fail('Could not apply the count', 'Your stock was not changed.')(error);
    }
  };

  const doDiscard = async () => {
    const ok = await confirm({
      title: `Discard ${count.number}?`,
      description:
        'Nothing on your shelves changes — the quantities you have entered are thrown away and the count is closed. This cannot be undone.',
      confirmLabel: 'Discard it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync();
      afterPaneChange(() => {
        toast.add({ title: `${count.number} discarded`, type: 'success' });
      });
    } catch (error) {
      fail('Could not discard the count', 'Nothing was changed.')(error);
    }
  };

  const removeItem = (line: CountLine) => {
    setRemovingId(line.id);
    removeLine.mutate(line.id, {
      onSettled: () => {
        setRemovingId(null);
      },
      onError: fail('Could not remove that item', 'Nothing was changed.'),
    });
  };

  return {
    doSave,
    doFinish,
    doApprove,
    doApply,
    doDiscard,
    removeItem,
    removingId,
    pending: {
      enter: enter.isPending,
      submit: submit.isPending,
      approve: approve.isPending,
      post: post.isPending,
      cancel: cancel.isPending,
    },
  };
}
