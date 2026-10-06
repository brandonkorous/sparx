'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../../lib/confirm';
import { afterPaneChange } from '../../../lib/defer';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { accountErrorMessage, useTierChoices, type AccountDetail } from '../accounts-data';
import { tierChoiceItems } from '../tier-choices';
import {
  useCreateAccount,
  useDeleteAccount,
  useSaveAccount,
  useSetAccountTier,
} from '../accounts/account-writes';
import { type Draft, emptyDraft, toDraft, identityFrom, type Identity } from './draft';

// The draft, seeded from the saved account until the first edit.
export function useAccountForm(
  ctx: SurfaceContext,
  isNew: boolean,
  account: AccountDetail | undefined
) {
  const saved = useMemo(() => (account ? toDraft(account) : emptyDraft()), [account]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New wholesale customer' : (account?.companyName ?? 'Wholesale customer'));
  }, [ctx, isNew, account]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  return { saved, draft, touched, setTouched, failure, setFailure, set };
}

export type AccountForm = ReturnType<typeof useAccountForm>;

// One Save: a new customer is created (then given its group), an existing one saved.
export function useAccountSave(
  ctx: SurfaceContext,
  id: string,
  isNew: boolean,
  form: AccountForm,
  blocking: string | null
) {
  const { draft, setFailure, setTouched } = form;
  const { create, setTier, createNew } = useCreateFlow(ctx, draft, setFailure);
  const { save, saveExisting } = useSaveFlow(id, draft, setFailure, setTouched);
  const saving = create.isPending || save.isPending || setTier.isPending;

  const submit = () => {
    if (blocking) return;
    setFailure(null);

    const identity = identityFrom(draft);
    if (isNew) {
      createNew(identity);
      return;
    }
    saveExisting(identity);
  };
  return { submit, saving, created: create.isSuccess };
}

function useCreateFlow(
  ctx: SurfaceContext,
  draft: Draft,
  setFailure: (message: string | null) => void
) {
  const toast = useToast();
  const create = useCreateAccount();
  const setTier = useSetAccountTier();
  const createNew = (identity: Identity) => {
    create.mutate(identity, {
      onSuccess: (created) => {
        const land = () => {
          ctx.open('b2b.account.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${identity.companyName} added`, type: 'success' });
          });
        };
        if (draft.tierId !== '') {
          setTier.mutate({ id: created.id, pricingTierId: draft.tierId }, { onSettled: land });
        } else {
          land();
        }
      },
      onError: (error) => {
        setFailure(accountErrorMessage(error, 'Could not add this customer.'));
      },
    });
  };
  return { create, setTier, createNew };
}

function useSaveFlow(
  id: string,
  draft: Draft,
  setFailure: (message: string | null) => void,
  setTouched: (touched: boolean) => void
) {
  const toast = useToast();
  const save = useSaveAccount(id);
  const saveExisting = (identity: Identity) => {
    save.mutate(
      {
        identity: {
          companyName: identity.companyName,
          taxId: identity.taxId,
          website: identity.website,
        },
        trade: {
          pricingTierId: draft.tierId === '' ? null : draft.tierId,
          creditLimitCents: Math.round(draft.creditLimit * 100),
          paymentTerms: identity.paymentTerms,
          discountPercent: draft.discountPercent,
          status: draft.status,
          internalNotes: identity.notes,
          fleetSize: draft.fleetSize === '' ? null : Number(draft.fleetSize),
          customProperties: draft.customProperties,
        },
      },
      {
        onSuccess: () => {
          setTouched(false);
          toast.add({ title: 'Customer saved', type: 'success' });
        },
        onError: (error) => {
          setFailure(
            accountErrorMessage(error, 'Could not save this customer. Nothing was changed.')
          );
        },
      }
    );
  };
  return { save, saveExisting };
}

export function useRemoveAccount(
  ctx: SurfaceContext,
  id: string,
  account: AccountDetail | undefined
) {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useDeleteAccount(id);

  const onDelete = async () => {
    if (!account) return;
    const ok = await confirm({
      title: `Remove ${account.companyName}?`,
      description:
        'This customer, their agreed prices and their list of contacts are removed. Orders and invoices already placed are kept. This cannot be undone.',
      confirmLabel: 'Remove this customer',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${account.companyName} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this customer',
          description: accountErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };
  return { remove, onDelete };
}

export function useTierItems(account: AccountDetail | undefined) {
  const tiersQuery = useTierChoices();
  return useMemo(
    () =>
      tierChoiceItems(tiersQuery.data?.items, 'No group: normal prices', {
        id: account?.pricingTierId ?? null,
        name: account?.pricingTierName ?? account?.removedTierName ?? null,
        removed: Boolean(account?.removedTierName),
      }),
    [tiersQuery.data, account?.pricingTierId, account?.pricingTierName, account?.removedTierName]
  );
}
