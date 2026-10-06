'use client';

// "Add to quote request" on a product page (sparx persona issue 086).
//
// The /b2b page promised "From the catalog, the buyer builds a request
// (quantities, delivery needs, notes) and submits it." This is the catalog end:
// the item and quantity chosen above go onto the account's open request, kept
// on the server (not in the cart, and not on this device). The Quotes page is
// where the buyer adds delivery needs, a PO number and notes, and sends it.
//
// Shown only to a signed-in contact who can order on a wholesale account. A
// contact on two accounts chooses which one the request is for.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert, Button, Label, NativeSelect } from '@wizeworks/silicaui-react';

import { useCustomer } from '@/components/customer-provider';
import { AccountError, addToQuoteRequest } from '@/lib/customer-client';
import { useOrderingAccounts } from './ordering-accounts';

export function AddToQuoteRequest({
  variantId,
  quantity,
}: {
  /** Null until the options name one item. */
  variantId: string | null;
  quantity: number;
}) {
  const { tenantSlug } = useCustomer();
  const { accounts } = useOrderingAccounts();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ accountId: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountId === null && accounts[0]) setAccountId(accounts[0].accountId);
  }, [accounts, accountId]);

  // A different item or quantity is a new question; the old answer no longer
  // describes what the button would do.
  useEffect(() => {
    setAdded(null);
    setError(null);
  }, [variantId, quantity]);

  if (accounts.length === 0 || accountId === null) return null;
  const account = accounts.find((a) => a.accountId === accountId) ?? accounts[0];
  if (!account) return null;

  async function handleAdd() {
    if (!variantId || !account) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const request = await addToQuoteRequest(tenantSlug, account.accountId, variantId, quantity);
      setAdded({ accountId: account.accountId, count: request.lines.length });
    } catch (err) {
      setError(
        err instanceof AccountError && err.status < 500
          ? err.message
          : 'It was not added to your quote request. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <p className="text-base-content m-0">
        Buying in quantity? Add this to {account.companyName}’s quote request and ask for a price.
      </p>
      {accounts.length > 1 && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="quote-request-account">Request it for</Label>
          <NativeSelect
            id="quote-request-account"
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
      <div>
        <Button
          type="button"
          color="primary"
          variant="outline"
          disabled={!variantId || busy}
          onClick={() => void handleAdd()}
        >
          {busy ? 'Adding…' : `Add ${quantity} to quote request`}
        </Button>
      </div>
      {added && (
        <Alert color="success" role="status">
          <span>
            Added. Your request has {added.count === 1 ? '1 item' : `${added.count} items`} and has
            not been sent yet.{' '}
            <Link href={`/account/b2b/${added.accountId}/quotes`} className="link">
              Review and send it
            </Link>
          </span>
        </Alert>
      )}
      {error && (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      )}
    </div>
  );
}
