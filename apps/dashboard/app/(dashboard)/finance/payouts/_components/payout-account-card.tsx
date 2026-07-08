'use client';

// Marketplace payout account — the masked summary + an Edit/Add affordance that
// opens the ACH capture form in a drawer (mirrors Finance → Payments' gateway
// drawer). The page shows the account at a glance; capture/replace happens in a
// focused drawer rather than an always-open form. The server only ever returns the
// masked view (last4 + status); the raw numbers live write-only in the form.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Landmark, Pencil, Plus } from 'lucide-react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from 'silicaui-react';
import { statusLabel, statusTone, toast } from '@sparx/ui';

import type { MarketPayoutAccount } from '../_types';
import { PayoutAccountForm } from './payout-account-form';

export function PayoutAccountCard({ account }: { account: MarketPayoutAccount | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  function onSaved() {
    setOpen(false);
    toast.success(account ? 'Payout account replaced' : 'Payout account added');
    router.refresh();
  }

  return (
    <>
      {account ? (
        <div className="rounded-box border-base-300 flex flex-wrap items-center gap-3 border p-3">
          <Landmark className="text-base-content/70 h-5 w-5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">
                {account.bankName ? `${account.bankName} · ` : ''}
                {account.accountType === 'savings' ? 'Savings' : 'Checking'} ••••
                {account.accountLast4 ?? '????'}
              </p>
              <Badge color={statusTone(account.status)} variant="soft" size="sm">
                {statusLabel(account.status)}
              </Badge>
            </div>
            <p className="text-base-content/70 text-xs">
              {account.accountHolderName} · ACH, paid weekly
            </p>
          </div>
          <Button
            color="module"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            iconStart={<Pencil className="h-4 w-4" />}
          >
            Edit
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Alert color="warning" variant="soft">
            <Landmark />
            <AlertContent>
              <AlertTitle>Add a bank account</AlertTitle>
              <AlertDescription>
                You need a bank account on file to receive payouts. Settlements are held until you
                add one — your earnings keep accruing in the meantime.
              </AlertDescription>
            </AlertContent>
          </Alert>
          <div>
            <Button
              color="module"
              onClick={() => setOpen(true)}
              iconStart={<Plus className="h-4 w-4" />}
            >
              Add bank account
            </Button>
          </div>
        </div>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <Landmark className="text-base-content/70 h-5 w-5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DrawerTitle>{account ? 'Replace payout account' : 'Add payout account'}</DrawerTitle>
              <DrawerDescription>ACH · sparx.market settles weekly</DrawerDescription>
            </div>
            {account ? (
              <Badge color={statusTone(account.status)} variant="soft" size="sm">
                {statusLabel(account.status)}
              </Badge>
            ) : null}
          </div>
          <div className="mt-5 flex flex-col gap-5">
            <p className="text-base-content/70 text-sm">
              {account
                ? `Re-enter your bank details to replace the account ending ••••${account.accountLast4 ?? '????'}. Replacing resets verification to pending.`
                : 'Where sparx.market sends your weekly marketplace earnings by ACH. We store only the last 4 digits in the clear; the rest is encrypted.'}
            </p>
            <PayoutAccountForm account={account} onSaved={onSaved} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
