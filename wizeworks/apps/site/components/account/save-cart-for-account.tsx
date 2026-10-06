'use client';

// "Save this cart" on the cart page (sparx persona issue 086).
//
// The /b2b page promised "Accounts keep named saved carts". This keeps what is
// in the cart as a named list on the wholesale ACCOUNT, so anyone on the account
// who can order can put it back in their cart later from Saved carts. It keeps
// the items and quantities, never the prices: loading it prices every line on
// that day. The cart itself is left as it is.
//
// Shown only to a signed-in contact who can order on a wholesale account.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, Button, Input, Label, NativeSelect } from '@wizeworks/silicaui-react';

import { useCart } from '@/components/cart-provider';
import { useCustomer } from '@/components/customer-provider';
import { AccountError, saveCartForAccount } from '@/lib/customer-client';
import { useOrderingAccounts } from './ordering-accounts';

export function SaveCartForAccount() {
  const { tenantSlug } = useCustomer();
  const { cartId, lines } = useCart();
  const { accounts } = useOrderingAccounts();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ name: string; accountId: string; company: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountId === null && accounts[0]) setAccountId(accounts[0].accountId);
  }, [accounts, accountId]);

  if (accounts.length === 0 || !cartId || lines.length === 0) return null;
  const account = accounts.find((a) => a.accountId === accountId) ?? accounts[0];
  if (!account) return null;

  async function handleSave() {
    if (!cartId || !account) return;
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Give this saved cart a name, so you can find it again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await saveCartForAccount(tenantSlug, account.accountId, cartId, trimmed);
      setSaved({ name: created.name, accountId: account.accountId, company: account.companyName });
      setOpen(false);
      setName('');
    } catch (err) {
      setError(
        err instanceof AccountError && err.status < 500
          ? err.message
          : 'The cart was not saved. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-base-300 rounded-box flex flex-col gap-3 border p-4">
      {saved && (
        <Alert color="success" role="status">
          <span>
            Saved as “{saved.name}” for {saved.company}. Your cart is unchanged.{' '}
            <Link href={`/account/b2b/${saved.accountId}/saved-carts`} className="link">
              See saved carts
            </Link>
          </span>
        </Alert>
      )}
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base-content m-0">
            Buy this again often? Save it for {account.companyName} and put it back in your cart in
            one step.
          </p>
          <Button
            type="button"
            color="primary"
            variant="outline"
            onClick={() => {
              setSaved(null);
              setOpen(true);
            }}
          >
            Save this cart
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="saved-cart-name">Name it</Label>
            <Input
              id="saved-cart-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example, Monthly shop restock"
            />
          </div>
          {accounts.length > 1 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="saved-cart-account">Save it for</Label>
              <NativeSelect
                id="saved-cart-account"
                value={account.accountId}
                onChange={(e) => setAccountId(e.currentTarget.value)}
              >
                {accounts.map((a) => (
                  <option key={a.accountId} value={a.accountId}>
                    {a.companyName}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {error && (
            <Alert color="danger" role="alert">
              {error}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" color="primary" disabled={busy} onClick={() => void handleSave()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
