'use client';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card } from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useAccount, type AccountDetail } from './accounts-data';
import { draftChecks, isDraftDirty } from './account-detail/draft';
import { useAccountForm, useAccountSave } from './account-detail/form-hooks';
import { AccountToolbar } from './account-detail/toolbar';
import { AccountFormSections } from './account-detail/form-sections';
import { AccountLinkedSections } from './account-detail/linked-sections';
import { AccountActivitySections } from './account-detail/activity-sections';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/* ── Surface ────────────────────────────────────────────────────────────── */

export function AccountDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <AccountEditor ctx={ctx} id="new" /> : <AccountLoader ctx={ctx} id={id} />;
}

function AccountLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const accountQuery = useAccount(id);

  if (accountQuery.isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={accountQuery.error}
            noun="customer"
            title="Could not load this customer"
            description="This is a problem reaching the server. The customer itself is unaffected. Nothing has been lost."
            onRetry={() => {
              void accountQuery.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (accountQuery.isPending || !accountQuery.data) {
    return <PaneWaiting />;
  }

  return (
    <AccountEditor
      ctx={ctx}
      id={id}
      account={accountQuery.data}
      isFetching={accountQuery.isFetching}
      updatedAt={accountQuery.dataUpdatedAt}
      onRefresh={() => {
        void accountQuery.refetch();
      }}
    />
  );
}

interface AccountEditorProps {
  ctx: SurfaceContext;
  id: string;
  account?: AccountDetail;
  isFetching?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
}

function AccountEditor({ ctx, id, account, isFetching, updatedAt, onRefresh }: AccountEditorProps) {
  const isNew = id === 'new';
  const form = useAccountForm(ctx, isNew, account);
  const { nameError, discountError, fleetError, blocking } = draftChecks(form.draft);
  const dirty = isDraftDirty(form.draft, form.saved, isNew);
  const { submit, saving, created } = useAccountSave(ctx, id, isNew, form, blocking);

  useDirtySource(
    dirty && !created,
    isNew
      ? 'This customer has not been created yet. Close anyway?'
      : 'This customer has unsaved changes. Close anyway?'
  );

  return (
    <div className={PANE_SHELL}>
      <AccountToolbar
        account={account}
        saving={saving}
        nameError={nameError}
        isNew={isNew}
        dirty={dirty}
        submit={submit}
        isFetching={isFetching}
        updatedAt={updatedAt}
        onRefresh={onRefresh}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <AccountFormSections
            isNew={isNew}
            account={account}
            form={form}
            nameError={nameError}
            discountError={discountError}
          />
          <AccountLinkedSections
            ctx={ctx}
            isNew={isNew}
            account={account}
            form={form}
            fleetError={fleetError}
          />
          <AccountActivitySections ctx={ctx} id={id} account={account} />
        </div>
      </div>
    </div>
  );
}
