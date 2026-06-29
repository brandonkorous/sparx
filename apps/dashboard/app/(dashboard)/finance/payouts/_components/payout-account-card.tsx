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
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Stack,
  Text,
  statusLabel,
  statusTone,
  toast,
} from '@sparx/ui';

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
        <Stack
          direction="row"
          align="center"
          gap={3}
          className="rounded-md border border-[var(--color-border-default)] p-3"
          wrap
        >
          <Landmark className="h-5 w-5 shrink-0 text-[var(--color-text-secondary)]" />
          <Stack gap={1} className="min-w-0 flex-1">
            <Stack direction="row" align="center" gap={2} wrap>
              <Text weight="medium">
                {account.bankName ? `${account.bankName} · ` : ''}
                {account.accountType === 'savings' ? 'Savings' : 'Checking'} ••••
                {account.accountLast4 ?? '????'}
              </Text>
              <Badge color={statusTone(account.status)} variant="soft" size="sm">
                {statusLabel(account.status)}
              </Badge>
            </Stack>
            <Text size="xs" variant="muted">
              {account.accountHolderName} · ACH, paid weekly
            </Text>
          </Stack>
          <Button color="module" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
        </Stack>
      ) : (
        <Stack gap={4}>
          <Alert color="warning" variant="soft" icon={<Landmark />} title="Add a bank account">
            You need a bank account on file to receive payouts. Settlements are held until you add
            one — your earnings keep accruing in the meantime.
          </Alert>
          <div>
            <Button color="module" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add bank account
            </Button>
          </div>
        </Stack>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="right" className="w-full max-w-md">
          <DrawerHeader>
            <Stack direction="row" align="center" gap={3}>
              <Landmark className="h-5 w-5 shrink-0 text-[var(--color-text-secondary)]" />
              <Stack gap={1} className="min-w-0 flex-1">
                <DrawerTitle>
                  {account ? 'Replace payout account' : 'Add payout account'}
                </DrawerTitle>
                <DrawerDescription>ACH · sparx.market settles weekly</DrawerDescription>
              </Stack>
              {account ? (
                <Badge color={statusTone(account.status)} variant="soft" size="sm">
                  {statusLabel(account.status)}
                </Badge>
              ) : null}
            </Stack>
          </DrawerHeader>
          <DrawerBody>
            <Stack gap={5}>
              <Text size="sm" variant="muted">
                {account
                  ? `Re-enter your bank details to replace the account ending ••••${account.accountLast4 ?? '????'}. Replacing resets verification to pending.`
                  : 'Where sparx.market sends your weekly marketplace earnings by ACH. We store only the last 4 digits in the clear; the rest is encrypted.'}
              </Text>
              <PayoutAccountForm account={account} onSaved={onSaved} />
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
