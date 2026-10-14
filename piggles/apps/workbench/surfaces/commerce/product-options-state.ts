'use client';

// The Options tab's draft: the choices as typed, what committing them would do,
// and the commit itself. The endpoint REPLACES the whole lattice, so it is one draft.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import {
  LatticeRebindError,
  productErrorMessage,
  useProductOptions,
  useProductVariants,
  useSaveProductLattice,
  type Product,
} from './products-data';
import {
  cleanDraft,
  fingerprint,
  problemWith,
  toDraft,
  type OptionDraft,
} from './product-options-draft';
import { consequenceOf, planOf, type Consequence } from './product-options-plan';
import { committedToast, consequenceLines, rebindToast } from './product-options-words';

/** Asks first, then replaces the lattice; a rebind refusal is still a commit. */
function useCommit(product: Product, onDone: () => void) {
  const toast = useToast();
  const confirm = useConfirm();
  const commitLattice = useSaveProductLattice(product.id);
  const commit = async (draft: OptionDraft[], consequence: Consequence) => {
    const ok = await confirm({
      title: `Change how ${product.title} is sold?`,
      description: consequenceLines(consequence).join(' '),
      confirmLabel: 'Change how it is sold',
      cancelLabel: 'Go back',
      color: consequence.retire.length > 0 ? 'danger' : 'warning',
    });
    if (!ok) return;
    commitLattice.mutate(planOf(draft, consequence), {
      onSuccess: () => {
        onDone();
        toast.add(committedToast(consequence));
      },
      onError: (error) => {
        if (error instanceof LatticeRebindError) {
          onDone();
          toast.add(rebindToast(error.variantIds.length));
          return;
        }
        toast.add({
          title: 'Could not change how this is sold',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };
  return { commit, busy: commitLattice.isPending };
}

/** The typed choices, following the server's copy until the first edit. */
function useTrackedDraft(saved: OptionDraft[]) {
  const [draft, setDraft] = useState<OptionDraft[]>(saved);
  const [touched, setTouched] = useState(false);
  // Track the server's copy while CLEAN; a dirty form is never overwritten by a refetch.
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);
  const edit = (next: OptionDraft[]) => {
    setTouched(true);
    setDraft(next);
  };
  const discard = () => {
    setTouched(false);
    setDraft(saved);
  };
  return { draft, setTouched, edit, discard };
}

export function useOptionsDraft(product: Product) {
  const options = useProductOptions(product.id);
  // Retired versions too, or a choice being put back would read as blank
  // combinations and send somebody to recreate versions that exist (issue 305).
  const variants = useProductVariants(product.id, true);
  const saved = useMemo(() => toDraft(options.data ?? []), [options.data]);
  const { draft, setTouched, edit, discard } = useTrackedDraft(saved);
  // NOT `useTabSave`: the leave-guard and the dirty dot only.
  const dirty = fingerprint(draft) !== fingerprint(saved);
  useDirtySource(
    dirty,
    'The choices on this product have unsaved changes on the Options tab. Close anyway?'
  );
  const consequence = useMemo(
    () => consequenceOf(draft, options.data ?? [], variants.data ?? []),
    [draft, options.data, variants.data]
  );
  const problem = problemWith(draft);
  const { commit, busy } = useCommit(product, () => {
    setTouched(false);
  });
  // "0 combinations can be sold" is untrue of a form still being filled in.
  const showConsequences = cleanDraft(draft).length > 0 || (options.data ?? []).length > 0;
  const commitDraft = async () => {
    if (problem) return;
    await commit(draft, consequence);
  };
  return {
    options,
    variants,
    draft,
    dirty,
    consequence,
    problem,
    showConsequences,
    busy,
    edit,
    discard,
    commitDraft,
  };
}
