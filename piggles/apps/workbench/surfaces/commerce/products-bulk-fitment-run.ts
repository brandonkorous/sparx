'use client';

// The work behind the bulk "What they fit" dialog: the entries gathered, leaving
// with some asks first, and the write with its toast.

import { useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { productErrorMessage, type FitmentDomain } from './products-data';
import type { ChosenRule } from './fitment-choice';
import { ruleTitle } from './fitment-rule-words';
import { entryKey } from './products-bulk-fitment-entries';
import { useBulkAddFitment, useBulkRemoveFitment } from './products-bulk';
import {
  entriesPhrase,
  fitmentAddedToast,
  fitmentRemovedToast,
  type BulkTarget,
  type FitmentBulkResult,
} from './products-bulk-words';

function useLeaveGuard(adding: boolean, count: number, busy: boolean, onClose: () => void) {
  const confirm = useConfirm();
  return async () => {
    if (busy) return;
    if (count > 0) {
      const leave = await confirm({
        title: adding ? 'Leave without adding these?' : 'Leave without removing these?',
        description: `The ${count === 1 ? 'entry' : `${String(count)} entries`} you chose here will be forgotten. Nothing has been changed on any product.`,
        confirmLabel: 'Leave',
        cancelLabel: 'Keep choosing',
        color: 'warning',
      });
      if (!leave) return;
    }
    onClose();
  };
}

/** One write, either direction, of the entries gathered. */
function useFitmentWrite(adding: boolean, target: BulkTarget) {
  const add = useBulkAddFitment();
  const remove = useBulkRemoveFitment();
  const write = (entries: ChosenRule[]): Promise<FitmentBulkResult> =>
    adding
      ? add.mutateAsync({
          target,
          fitments: entries.map(({ domainId, nodeId, ranges }) => ({ domainId, nodeId, ranges })),
        })
      : remove.mutateAsync({
          target,
          domainId: entries[0]?.domainId ?? '',
          nodeIds: entries.map((rule) => rule.nodeId),
        });
  return { write, busy: add.isPending || remove.isPending };
}

export function useBulkFitmentRun(input: {
  adding: boolean;
  target: BulkTarget;
  domains: FitmentDomain[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { adding, target, domains, onClose, onDone } = input;
  const toast = useToast();
  const { write, busy } = useFitmentWrite(adding, target);
  const [entries, setEntries] = useState<ChosenRule[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const what = entriesPhrase(
    entries.map((rule) =>
      ruleTitle(
        rule,
        domains.find((d) => d.id === rule.domainId),
        'mid'
      )
    )
  );

  const submit = async () => {
    setFailure(null);
    try {
      const result = await write(entries);
      const words = adding ? fitmentAddedToast(result, what) : fitmentRemovedToast(result, what);
      onClose();
      if (result.productsChanged > 0) onDone();
      afterPaneChange(() => {
        toast.add({ ...words, type: result.productsChanged > 0 ? 'success' : 'info' });
      });
    } catch (error) {
      setFailure(productErrorMessage(error, 'This is a problem reaching the server.'));
    }
  };

  const gather = (rule: ChosenRule) => {
    setEntries((current) =>
      current.some((entry) => entryKey(entry, adding) === entryKey(rule, adding))
        ? current
        : [...current, rule]
    );
  };
  const drop = (index: number) => setEntries((current) => current.filter((_, i) => i !== index));
  const requestClose = useLeaveGuard(adding, entries.length, busy, onClose);

  return { entries, gather, drop, submit, requestClose, failure, busy };
}
