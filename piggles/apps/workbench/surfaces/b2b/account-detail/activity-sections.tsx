'use client';

import { Button, Text } from '@wizeworks/silicaui-react';
import {
  faCartShopping,
  faFileText,
  faHandshake,
  faReceipt,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../../components/form-section';
import { useModuleStates } from '../../../lib/api/shell-data';
import type { OpenTarget, SurfaceContext } from '../../../lib/surfaces/registry';
import { type AccountDetail } from '../accounts-data';
import type { useDeleteAccount } from '../accounts/account-writes';
import { AccountStatementSection } from '../account-statement';
import { useRemoveAccount } from './form-hooks';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function AccountActivitySections({
  ctx,
  id,
  account,
}: {
  ctx: SurfaceContext;
  id: string;
  account: AccountDetail | undefined;
}) {
  const { remove, onDelete } = useRemoveAccount(ctx, id, account);
  const modules = useModuleStates();
  const crmOn = (modules.data ?? []).some((m) => m.slug === 'crm' && m.enabled);
  const openList = (surface: string, event: { shiftKey: boolean; altKey: boolean }) => {
    if (!account) return;
    ctx.open(
      surface,
      { accountId: account.id, accountName: account.companyName },
      { target: targetFor(event) }
    );
  };

  return (
    <>
      {/* Trade activity cross-links */}
      {account ? (
        <TradeActivitySection
          openList={openList}
          openCompany={
            crmOn
              ? (event) => {
                  ctx.open('crm.account.detail', { id: account.id }, { target: targetFor(event) });
                }
              : null
          }
        />
      ) : null}

      {/* Statement: opening, every invoice and payment with their PO
              numbers, closing and aging, to print or email to them. */}
      {account ? (
        <AccountStatementSection accountId={account.id} companyName={account.companyName} />
      ) : null}

      {/* Delete — a plain row after the work, under a divider */}
      {account ? <RemoveAccountRow remove={remove} onDelete={onDelete} /> : null}
    </>
  );
}

type OpenList = (surface: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function TradeActivitySection({
  openList,
  openCompany,
}: {
  openList: OpenList;
  /** Null when the CRM is off: there is no company page to open. */
  openCompany: ((event: { shiftKey: boolean; altKey: boolean }) => void) | null;
}) {
  return (
    <FormSection
      title="Their trade activity"
      description="Everything this customer has going on with you, filtered to just them."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="soft"
          color="module"
          onClick={(event) => {
            openList('b2b.orders.list', event);
          }}
        >
          <Icon glyph={faCartShopping} className="size-4" aria-hidden />
          Their orders
        </Button>
        <Button
          size="sm"
          variant="soft"
          color="module"
          onClick={(event) => {
            openList('b2b.quotes.list', event);
          }}
        >
          <Icon glyph={faFileText} className="size-4" aria-hidden />
          Their quotes
        </Button>
        <Button
          size="sm"
          variant="soft"
          color="module"
          onClick={(event) => {
            openList('b2b.invoices.list', event);
          }}
        >
          <Icon glyph={faReceipt} className="size-4" aria-hidden />
          Their invoices
        </Button>
        {/* The same business as a CRM company: its deals, requests, notes and
            every order and invoice in one place. The two pages never linked
            (sparx persona issue 112). */}
        {openCompany ? (
          <Button size="sm" variant="soft" color="module-crm" onClick={openCompany}>
            <Icon glyph={faHandshake} className="size-4" aria-hidden />
            Their deals and requests
          </Button>
        ) : null}
      </div>
    </FormSection>
  );
}

function RemoveAccountRow({
  remove,
  onDelete,
}: {
  remove: ReturnType<typeof useDeleteAccount>;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <Text className="text-sm">
        Remove this customer and their agreed prices. Orders and invoices already placed are kept.
      </Text>
      <Button
        size="sm"
        variant="outline"
        color="danger"
        loading={remove.isPending}
        onClick={() => {
          void onDelete();
        }}
      >
        <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        Remove this customer
      </Button>
    </div>
  );
}
