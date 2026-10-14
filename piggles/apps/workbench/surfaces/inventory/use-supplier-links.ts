'use client';

// The state behind "what you buy from this supplier": the item being added,
// what it costs, and adding or removing one link. Each link saves on its own.

import { useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { moneyCents } from '../../components/money-input';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { VariantChoice } from '../commerce/bundles-data';
import {
  buyingErrorMessage,
  useRemoveSupplierVariant,
  useUpsertSupplierVariant,
  type SupplierVariant,
} from './suppliers-data';

type Toast = ReturnType<typeof useToast>;

/** Nothing typed reads as nothing set; anything else goes through `moneyCents`,
 *  which reads "8,50", "$8.00" and "1,250.00" as written (issues 086 and 486). */
function inputToCents(value: string): number | null {
  return value.trim() === '' ? null : moneyCents(value);
}

function useLinkDraft() {
  const [adding, setAdding] = useState(false);
  // Chosen from the catalog by name or code: an owner with 693 parts does not
  // carry their codes in his head (sparx persona issue 071).
  const [picked, setPicked] = useState<VariantChoice | null>(null);
  const [cost, setCost] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [preferred, setPreferred] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setPicked(null);
    setCost('');
    setSupplierSku('');
    setPreferred(false);
    setError(null);
    setAdding(false);
  };
  const fields = { adding, setAdding, picked, setPicked, cost, setCost };
  return {
    ...fields,
    supplierSku,
    setSupplierSku,
    preferred,
    setPreferred,
    error,
    setError,
    resetForm,
  };
}

type LinkDraft = ReturnType<typeof useLinkDraft>;

function addLink(
  draft: LinkDraft,
  upsert: ReturnType<typeof useUpsertSupplierVariant>,
  toast: Toast
) {
  const { picked, cost, supplierSku, preferred, setError, resetForm } = draft;
  setError(null);
  if (!picked) return;
  const costCents = inputToCents(cost);
  upsert.mutate(
    {
      variantId: picked.id,
      ...(costCents !== null ? { unitCostCents: costCents } : {}),
      ...(supplierSku.trim() ? { supplierSku: supplierSku.trim() } : {}),
      isPreferred: preferred,
    },
    {
      onSuccess: () => {
        const title = picked.productTitle;
        resetForm();
        afterPaneChange(() => {
          toast.add({ title: `${title} added to what you buy here`, type: 'success' });
        });
      },
      onError: (err) => {
        setError(buyingErrorMessage(err, 'Could not save that item.'));
      },
    }
  );
}

interface RemoveDeps {
  confirm: ReturnType<typeof useConfirm>;
  remove: ReturnType<typeof useRemoveSupplierVariant>;
  toast: Toast;
}

async function removeLink(link: SupplierVariant, { confirm, remove, toast }: RemoveDeps) {
  const label = link.productTitle ?? link.variantSku ?? 'this item';
  const ok = await confirm({
    title: `Stop buying ${label} from this supplier?`,
    description:
      'This only removes the record that you source it here. Your stock, your product and any past orders are untouched. You can add it back at any time.',
    confirmLabel: 'Remove it',
    cancelLabel: 'Keep it',
    color: 'danger',
  });
  if (!ok) return;
  remove.mutate(link.variantId, {
    onSuccess: () => {
      afterPaneChange(() => {
        toast.add({ title: `${label} removed`, type: 'success' });
      });
    },
    onError: (err) => {
      toast.add({
        title: 'Could not remove that item',
        description: buyingErrorMessage(err, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}

export function useSupplierLinks(supplierId: string) {
  const toast = useToast();
  const confirm = useConfirm();
  const upsert = useUpsertSupplierVariant(supplierId);
  const remove = useRemoveSupplierVariant(supplierId);
  const draft = useLinkDraft();
  return {
    ...draft,
    saving: upsert.isPending,
    addLink: () => {
      addLink(draft, upsert, toast);
    },
    removeLink: (link: SupplierVariant) => removeLink(link, { confirm, remove, toast }),
  };
}

export type SupplierLinks = ReturnType<typeof useSupplierLinks>;
