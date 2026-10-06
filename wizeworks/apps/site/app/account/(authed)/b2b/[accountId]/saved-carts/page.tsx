'use client';

// Wholesale account: its named saved carts (sparx persona issue 086).
//
// The /b2b page promised "Accounts keep named saved carts". A saved cart is a
// named list kept for the ACCOUNT: anyone on it who can order sees the same
// lists, and can put one into their cart, rename it or delete it. A list keeps
// items and quantities, never prices: Add to cart prices every line today, for
// this account, and says what could not be added and why.
//
// A viewer or an approver sees none of this; the server refuses them too.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Input,
  Label,
} from '@wizeworks/silicaui-react';

import { FillCartButton } from '@/components/account/order-again-button';
import { useCustomer } from '@/components/customer-provider';
import { savedCartSummary } from '@/lib/buying-again-words';
import {
  AccountError,
  addSavedCartToCart,
  deleteSavedCart,
  getB2bSummary,
  getSavedCarts,
  ORDERING_ROLES,
  renameSavedCart,
  type SavedCart,
} from '@/lib/customer-client';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SavedCartsPage() {
  const { tenantSlug } = useCustomer();
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const [carts, setCarts] = useState<SavedCart[] | null>(null);
  const [canOrder, setCanOrder] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    getSavedCarts(tenantSlug, accountId)
      .then(setCarts)
      .catch(() => setError('The saved carts on this account could not be loaded just now.'));
  }

  useEffect(() => {
    let active = true;
    getB2bSummary(tenantSlug, accountId)
      .then((s) => {
        if (!active) return;
        const can = ORDERING_ROLES.has(s.account.role);
        setCanOrder(can);
        if (can) load();
      })
      .catch(() => active && setError('This account could not be loaded just now.'));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, accountId]);

  function failure(err: unknown, fallback: string): string {
    return err instanceof AccountError && err.status < 500 ? err.message : fallback;
  }

  async function handleRename(id: string) {
    const name = newName.trim();
    if (name === '') {
      setRowError({ id, message: 'Give this saved cart a name.' });
      return;
    }
    setBusy(id);
    setRowError(null);
    try {
      await renameSavedCart(tenantSlug, accountId, id, name);
      setRenaming(null);
      load();
    } catch (err) {
      setRowError({ id, message: failure(err, 'The name was not changed. Please try again.') });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    setBusy(id);
    setRowError(null);
    try {
      await deleteSavedCart(tenantSlug, accountId, id);
      load();
    } catch (err) {
      setRowError({ id, message: failure(err, 'It was not deleted. Please try again.') });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Link href={`/account/b2b/${accountId}`} className="link link-primary">
          ← Back to account
        </Link>
        <h1 className="text-base-content text-3xl font-semibold tracking-tight">Saved carts</h1>
      </div>

      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : canOrder === false ? (
        <div className="card border-base-300 items-center border p-8 text-center">
          <p className="text-base-content">
            Saved carts are for the people on this account who can place orders. Ask your primary
            contact if you need to order.
          </p>
        </div>
      ) : carts === null ? (
        <div className="skeleton h-50" />
      ) : carts.length === 0 ? (
        <div className="card border-base-300 items-center gap-4 border p-8 text-center">
          <p className="text-base-content m-0">
            There are no saved carts on this account yet. Fill your cart, then use Save this cart on
            the cart page to keep it here for everyone on the account who orders.
          </p>
          <Button render={<Link href="/products" />} color="primary">
            Browse the catalog
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {carts.map((c) => (
            <div key={c.id} className="card border-base-300 gap-3 border px-4 py-4">
              {renaming === c.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                    <Label htmlFor={`rename-${c.id}`}>New name</Label>
                    <Input
                      id={`rename-${c.id}`}
                      value={newName}
                      maxLength={120}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    color="primary"
                    disabled={busy === c.id}
                    onClick={() => void handleRename(c.id)}
                  >
                    Save name
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy === c.id}
                    onClick={() => setRenaming(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <strong className="text-lg">{c.name}</strong>
                    <div className="text-base-content text-sm">
                      {savedCartSummary(c)} · Saved {formatDate(c.savedAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRowError(null);
                        setNewName(c.name);
                        setRenaming(c.id);
                      }}
                    >
                      Rename
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger>
                        <Button
                          type="button"
                          color="danger"
                          variant="ghost"
                          size="sm"
                          disabled={busy === c.id}
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogTitle>Delete “{c.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This saved cart and its{' '}
                          {c.itemCount === 1 ? '1 item' : `${c.itemCount} items`} are deleted for
                          everyone on your account. Your cart and past orders are not touched. This
                          cannot be undone.
                        </AlertDialogDescription>
                        <div className="mt-4 flex justify-end gap-2">
                          <AlertDialogCancel>
                            <Button type="button" variant="ghost">
                              Keep it
                            </Button>
                          </AlertDialogCancel>
                          <AlertDialogAction color="danger" onClick={() => void handleDelete(c.id)}>
                            Delete “{c.name}”
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}

              {rowError?.id === c.id && (
                <Alert color="danger" role="alert">
                  {rowError.message}
                </Alert>
              )}

              <FillCartButton
                label="Add to cart"
                busyLabel="Adding to your cart…"
                run={(cartId) => addSavedCartToCart(tenantSlug, accountId, c.id, cartId)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
