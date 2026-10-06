'use client';

// The two moves on the core charge choices screen, "Change this one" and "Change
// all", each behind a confirm naming what stops being sold (issue 057).

import { useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { apiErrorMessage } from '../../lib/api-error';
import {
  useConvertCoreChoices,
  type CoreChoiceCandidate,
  type CoreChoiceConversion,
} from './core-choices-data';
import {
  changeAllWords,
  changedWords,
  changeFor,
  stuckWords,
  plural,
  whatHappens,
  type ChoiceDraft,
  type CoreChoiceChange,
} from './core-choice-words';

/** The most one request may carry; a longer run goes in several. */
const BATCH = 500;

type Toast = ReturnType<typeof useToast>;

function reportOutcome(toast: Toast, outcome: CoreChoiceConversion[]) {
  const changed = outcome.filter((result) => result.problem === null).length;
  const stuck = outcome.length - changed;
  toast.add({
    title:
      changed > 0 ? `Changed ${plural(changed, 'product', 'products')}` : 'Nothing was changed',
    description: stuck > 0 ? stuckWords(stuck) : changedWords(changed),
    type: stuck > 0 ? 'warning' : 'success',
  });
}

/** Sends the changes in batches the server takes; returns whatever came back. */
function useRun(onDone: (outcome: CoreChoiceConversion[]) => void) {
  const toast = useToast();
  const convert = useConvertCoreChoices();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const run = async (changes: CoreChoiceChange[]) => {
    setBusy(new Set(changes.map((change) => change.productId)));
    const outcome: CoreChoiceConversion[] = [];
    try {
      for (let start = 0; start < changes.length; start += BATCH) {
        outcome.push(...(await convert.mutateAsync(changes.slice(start, start + BATCH))));
      }
    } catch (error) {
      const fallback =
        outcome.length > 0
          ? `${plural(outcome.length, 'product was', 'products were')} dealt with before this stopped. They are listed below.`
          : 'Nothing was changed. You can try again.';
      toast.add({
        title: 'Could not change them',
        description: apiErrorMessage(error, fallback),
        type: 'error',
      });
    } finally {
      setBusy(new Set());
    }
    if (outcome.length === 0) return;
    onDone(outcome);
    reportOutcome(toast, outcome);
  };
  return { run, busy };
}

export function useCoreChoiceActions(
  draftOf: (candidate: CoreChoiceCandidate) => ChoiceDraft,
  onDone: (outcome: CoreChoiceConversion[]) => void
) {
  const confirm = useConfirm();
  const { run, busy } = useRun(onDone);

  const changeOne = async (candidate: CoreChoiceCandidate) => {
    const draft = draftOf(candidate);
    const ok = await confirm({
      title: `Change ${candidate.title}?`,
      description: whatHappens(candidate, draft),
      confirmLabel: 'Change it',
      cancelLabel: 'Leave it as it is',
      color: 'danger',
    });
    if (ok) await run([changeFor(candidate, draft)]);
  };

  const changeAll = async (ready: CoreChoiceCandidate[]) => {
    if (ready.length === 0) return;
    const offering = ready.filter((candidate) => draftOf(candidate).offerFirst).length;
    const count = plural(ready.length, 'product', 'products');
    const ok = await confirm({
      title: `Change all ${count}?`,
      description: changeAllWords(ready.length, offering),
      confirmLabel: `Change ${count}`,
      cancelLabel: 'Leave them as they are',
      color: 'danger',
    });
    if (ok) await run(ready.map((candidate) => changeFor(candidate, draftOf(candidate))));
  };

  return { changeOne, changeAll, busy };
}
