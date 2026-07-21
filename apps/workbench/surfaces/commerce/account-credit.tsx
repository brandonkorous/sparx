'use client';

// Account credit — who holds store credit, and granting more of it.
//
// Store credit is money on a CUSTOMER's account, not an editable record of its
// own, so there is no create/edit pane to open — this one surface holds the whole
// job. It lists the customers who have credit, and lets you pick one (or search
// for anyone) to see their balance and history and add more. Credit is only ever
// ADDED by hand here; it is spent at checkout, never reduced by typing over a
// number, which is why there is no "edit balance" field anywhere on this screen.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  SearchInput,
  Select,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { UserPlus, Wallet, X } from 'lucide-react';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents } from './products-data';
import {
  accountCreditErrorMessage,
  creditReasonMeaning,
  customerName,
  useAccountCreditLedger,
  useAccountCredits,
  useCustomerSearch,
  useGrantAccountCredit,
  type CustomerLite,
} from './account-credit-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function dollarsToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AccountCreditSurface({ ctx: _ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ customer: CustomerLite; currency: string } | null>(
    null
  );
  const [finding, setFinding] = useState(false);

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAccountCredits(search);
  const rows = data?.items ?? [];

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Account credit controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search customers with store credit"
            placeholder="Search customers with credit…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setFinding(true);
            setSelected(null);
          }}
        >
          <UserPlus className="size-4" aria-hidden />
          Grant credit
        </Button>
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {finding ? (
            <CustomerFinder
              onPick={(customer) => {
                setSelected({ customer, currency: 'USD' });
                setFinding(false);
              }}
              onCancel={() => {
                setFinding(false);
              }}
            />
          ) : null}

          {selected ? (
            <CustomerCredit
              customer={selected.customer}
              currency={selected.currency}
              onClose={() => {
                setSelected(null);
              }}
            />
          ) : null}

          <Card>
            <div className="border-base-300 border-b px-4 py-3">
              <Heading level={2} className="text-lg font-semibold">
                Customers with store credit
              </Heading>
            </div>
            {isError ? (
              <EmptyState
                title="Could not load balances"
                description="Something went wrong reaching the server. Try again in a moment."
              />
            ) : isPending ? (
              <p className="p-4 text-sm" role="status">
                Loading…
              </p>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<Wallet className="size-6" aria-hidden />}
                title={search.trim() ? 'Nobody matches that search' : 'No store credit yet'}
                description={
                  search.trim()
                    ? 'Try a different name, or clear the search to see everyone.'
                    : 'Nobody holds store credit right now. Use “Grant credit” to put some on a customer’s account.'
                }
              />
            ) : (
              <ul className="flex flex-col p-1">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-3 py-2 text-left"
                      onClick={() => {
                        if (row.customer) {
                          setSelected({ customer: row.customer, currency: row.currency });
                          setFinding(false);
                        }
                      }}
                    >
                      <span className="min-w-0 flex-1 font-semibold">
                        {customerName(row.customer)}
                      </span>
                      {row.customer?.email ? (
                        <Text as="span" className="hidden min-w-0 truncate text-sm @md:inline">
                          {row.customer.email}
                        </Text>
                      ) : null}
                      <Text as="span" className="shrink-0 font-semibold tabular-nums">
                        {formatCents(row.balanceCents, row.currency)}
                      </Text>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Finding a customer to grant to ─────────────────────────────────────── */

function CustomerFinder({
  onPick,
  onCancel,
}: {
  onPick: (customer: CustomerLite) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data, isFetching } = useCustomerSearch(query);
  const results = data?.items ?? [];

  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex items-center justify-between gap-3 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          Choose a customer
        </Heading>
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          shape="square"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <SearchInput
        size="sm"
        aria-label="Search all customers"
        placeholder="Search by name, email or company…"
        value={query}
        onValueChange={setQuery}
      />
      {query.trim() === '' ? (
        <Text className="text-sm">Start typing to find the customer to give credit to.</Text>
      ) : isFetching && results.length === 0 ? (
        <Text className="text-sm" role="status">
          Searching…
        </Text>
      ) : results.length === 0 ? (
        <Text className="text-sm">No customer matches that. Try a different word.</Text>
      ) : (
        <div className="border-base-300 max-h-72 overflow-y-auto rounded border p-1">
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-2 text-left"
              onClick={() => {
                onPick(customer);
              }}
            >
              <span className="min-w-0 flex-1 font-medium">{customerName(customer)}</span>
              {customer.email ? (
                <Text as="span" className="shrink-0 text-sm">
                  {customer.email}
                </Text>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── One customer's balance, grant form + ledger ────────────────────────── */

function CustomerCredit({
  customer,
  currency,
  onClose,
}: {
  customer: CustomerLite;
  currency: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const grant = useGrantAccountCredit();
  const ledger = useAccountCreditLedger(customer.id, currency);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<'grant' | 'refund' | 'adjust' | 'loyalty_conversion'>(
    'grant'
  );
  const [note, setNote] = useState('');

  const amountCents = dollarsToCents(amount);
  const canGrant = amountCents !== undefined && amountCents > 0;
  const balanceCents = ledger.data?.balanceCents ?? 0;

  const submit = () => {
    if (amountCents === undefined || amountCents <= 0) return;
    grant.mutate(
      {
        customerId: customer.id,
        amountCents,
        currency,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
          afterPaneChange(() => {
            toast.add({ title: 'Store credit added', type: 'success' });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not add credit',
            description: accountCreditErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <section className="card bg-base-100 flex flex-col gap-4 p-4">
      <div className="border-base-300 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="flex flex-col">
          <Heading level={2} className="text-xl font-semibold">
            {customerName(customer)}
          </Heading>
          {customer.email ? <Text className="text-sm">{customer.email}</Text> : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          color="neutral"
          shape="square"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col">
        <Text className="text-sm">Current balance</Text>
        <Text className="text-3xl font-semibold tabular-nums">
          {ledger.isPending ? '—' : formatCents(balanceCents, currency)}
        </Text>
      </div>

      <div className="flex flex-col gap-3">
        <Heading level={3} className="text-base font-semibold">
          Add store credit
        </Heading>
        <div className="grid gap-3 @md:grid-cols-2">
          <Field>
            <FieldLabel>Amount</FieldLabel>
            <FieldControl
              render={
                <div className="flex items-center gap-2">
                  <Text as="span" className="text-lg">
                    $
                  </Text>
                  <Input
                    color="module"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    placeholder="25.00"
                    onChange={(event) => {
                      setAmount(event.target.value);
                    }}
                  />
                </div>
              }
            />
          </Field>
          <Field>
            <FieldLabel>Why</FieldLabel>
            <Select
              color="module"
              aria-label="Why"
              value={reason}
              items={{
                grant: 'A gift or gesture',
                refund: 'A refund kept as credit',
                adjust: 'A correction',
                loyalty_conversion: 'From loyalty points',
              }}
              onValueChange={(next) => {
                setReason(next as typeof reason);
              }}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel>Note (optional)</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={2}
                value={note}
                placeholder="Anything worth remembering about this credit."
                onChange={(event) => {
                  setNote(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>Kept in the history below so you remember why later.</FieldDescription>
        </Field>
        <Button
          size="sm"
          color="module"
          className="self-start"
          disabled={!canGrant}
          loading={grant.isPending}
          onClick={submit}
        >
          <Wallet className="size-4" aria-hidden />
          Add credit
        </Button>
      </div>

      <div className="border-base-300 flex flex-col gap-2 border-t pt-3">
        <Heading level={3} className="text-base font-semibold">
          History
        </Heading>
        {ledger.isError ? (
          <Alert color="error" variant="soft">
            <AlertContent>
              <AlertTitle>Could not load history</AlertTitle>
              <AlertDescription>The balance above may still be right. Try again.</AlertDescription>
            </AlertContent>
          </Alert>
        ) : ledger.isPending ? (
          <Text className="text-sm" role="status">
            Loading…
          </Text>
        ) : (ledger.data?.transactions.length ?? 0) === 0 ? (
          <Text className="text-sm">Nothing recorded yet.</Text>
        ) : (
          <ul className="flex flex-col">
            {ledger.data?.transactions.map((entry) => (
              <li
                key={entry.id}
                className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <Text className="font-medium">{creditReasonMeaning(entry.reason)}</Text>
                  <Text className="text-sm">
                    {formatDate(entry.createdAt)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </Text>
                </div>
                <Badge
                  color={entry.deltaCents >= 0 ? 'success' : 'neutral'}
                  variant="soft"
                  size="sm"
                  className="tabular-nums"
                >
                  {entry.deltaCents >= 0 ? '+' : '−'}
                  {formatCents(Math.abs(entry.deltaCents), currency)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
