'use client';

// MERGE THIS CUSTOMER WITH ANOTHER ONE, BY HAND.
//
// The duplicates screen only shows pairs its rules can see: one email, one phone,
// or one surname at one employer. A person who moved and came back with a new
// email AND a new phone matches none of them, and was two customers forever:
// the merge existed, but no screen offered it for a pair the rules missed
// (sparx persona issue 109, Brynn O'Hara-Løvdal). The owner knows they are one
// person; this lets them say so from either record.

import { useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  SearchInput,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Check, CopyCheck } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { PaneScope } from '../../lib/dock/window-boundary';
import { useViewer } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { customerName, formatMoney, useCustomers, type Customer } from './customers-data';
import {
  mergeConfirmWords,
  mergeDropsWords,
  mergeErrorMessage,
  useMergeCustomers,
} from './duplicates-data';

/** The row on the customer page that opens the merge, above Remove. */
export function CustomerMergeRow({ ctx, customer }: { ctx: SurfaceContext; customer: Customer }) {
  const { data: viewer } = useViewer();
  // Merge cannot be undone, and the server allows it to owners and admins only.
  const canMerge = viewer?.role === 'admin' || viewer?.role === 'owner';
  const [open, setOpen] = useState(false);

  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <Text className="text-sm">
        {canMerge
          ? 'Is this the same person as another customer? Merge them so their orders and history are in one place.'
          : 'Is this the same person as another customer? The owner or an admin can merge them.'}
      </Text>
      {canMerge ? (
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={() => {
            setOpen(true);
          }}
        >
          <CopyCheck className="size-4" aria-hidden />
          Merge with another customer
        </Button>
      ) : null}
      {open ? (
        <MergeDialog
          ctx={ctx}
          customer={customer}
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MergeDialog({
  ctx,
  customer,
  onClose,
}: {
  ctx: SurfaceContext;
  customer: Customer;
  onClose: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const merge = useMergeCustomers();
  const [search, setSearch] = useState('');
  const [other, setOther] = useState<Customer | null>(null);
  const [keepId, setKeepId] = useState(customer.id);

  const term = search.trim();
  const results = useCustomers({ q: term.length >= 2 ? term : undefined });
  // One site is one business: the server refuses to merge across sites, so a
  // customer of the other business is never offered.
  const choices =
    term.length >= 2
      ? (results.data?.items ?? []).filter(
          (c) => c.id !== customer.id && c.propertyId === customer.propertyId
        )
      : [];

  const keep = other?.id === keepId && other ? other : customer;
  const retire = other?.id === keepId ? customer : other;

  const onMerge = async () => {
    if (!other || !retire) return;
    const keepName = customerName(keep);
    const words = mergeConfirmWords(side(keep), side(retire));
    const ok = await confirm({
      title: words.title,
      description: words.description,
      confirmLabel: 'Merge them',
      cancelLabel: 'Leave them separate',
      color: 'danger',
    });
    if (!ok) return;
    merge.mutate(
      { primaryCustomerId: keep.id, duplicateCustomerIds: [retire.id] },
      {
        onSuccess: () => {
          onClose();
          toast.add({
            title: `Merged into ${keepName}`,
            description: 'The other record was retired and its history moved across.',
            type: 'success',
          });
          // This page's record was the one retired: show the one that is left.
          if (retire.id === customer.id) {
            ctx.close();
            afterPaneChange(() => {
              ctx.open('crm.customer.detail', { id: keep.id });
            });
          }
        },
        onError: (error) => {
          toast.add({
            title: 'Could not merge these customers',
            description: mergeErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <PaneScope>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent className="flex max-h-[calc(100%-2rem)] max-w-xl flex-col overflow-hidden">
          <DialogTitle>Merge {customerName(customer)} with another customer</DialogTitle>
          <DialogDescription>
            {other
              ? 'Choose which record to keep. Everything from the other one moves onto it.'
              : 'Find the other record of this person by name, email or phone.'}
          </DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2 [&>*]:shrink-0">
            {other && retire ? (
              <>
                <ul className="border-base-300 divide-base-300 rounded-box divide-y border">
                  {[customer, other].map((c) => (
                    <MergeCandidate
                      key={c.id}
                      customer={c}
                      keeping={c.id === keep.id}
                      onKeep={() => {
                        setKeepId(c.id);
                      }}
                    />
                  ))}
                </ul>
                {mergeDropsWords(keep, retire).map((line) => (
                  <Text key={line} className="text-sm">
                    {line}
                  </Text>
                ))}
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOther(null);
                      setKeepId(customer.id);
                    }}
                  >
                    Choose a different customer
                  </Button>
                </div>
              </>
            ) : (
              <>
                <SearchInput
                  size="sm"
                  aria-label="Find the other customer"
                  placeholder="Name, email or phone"
                  value={search}
                  onValueChange={setSearch}
                />
                {term.length < 2 ? (
                  <Text className="text-sm">Type at least two letters.</Text>
                ) : results.isPending ? (
                  <Text className="text-sm" role="status">
                    Looking…
                  </Text>
                ) : results.isError ? (
                  <Text className="text-sm" role="alert">
                    Could not look up customers. Try again in a moment.
                  </Text>
                ) : choices.length === 0 ? (
                  <Text className="text-sm" role="status">
                    No other customer matches “{term}”.
                  </Text>
                ) : (
                  <ul className="border-base-300 divide-base-300 rounded-box divide-y border">
                    {choices.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="hover:bg-base-200 flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                          onClick={() => {
                            setOther(c);
                          }}
                        >
                          <span className="font-medium">{customerName(c)}</span>
                          <span className="text-sm">{contactLine(c)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <DialogClose>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            {other ? (
              <Button
                color="danger"
                size="sm"
                loading={merge.isPending}
                onClick={() => {
                  void onMerge();
                }}
              >
                <CopyCheck className="size-4" aria-hidden />
                {retire ? mergeConfirmWords(side(keep), side(retire)).action : null}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneScope>
  );
}

function side(c: Customer): { name: string; email: string | null; phone: string | null } {
  return { name: customerName(c), email: c.email, phone: c.phone };
}

function contactLine(c: Customer): string {
  const orders =
    c.orderCount === 0
      ? 'no orders'
      : `${String(c.orderCount)} ${c.orderCount === 1 ? 'order' : 'orders'}, ${formatMoney(c.totalOrdered)}`;
  return [c.email, c.phone, orders].filter(Boolean).join(' · ');
}

function MergeCandidate({
  customer,
  keeping,
  onKeep,
}: {
  customer: Customer;
  keeping: boolean;
  onKeep: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <Button
        size="sm"
        variant={keeping ? 'soft' : 'outline'}
        {...(keeping ? { color: 'success' } : {})}
        className="shrink-0"
        aria-pressed={keeping}
        onClick={onKeep}
      >
        {keeping ? <Check className="size-4" aria-hidden /> : null}
        {keeping ? 'Keeping' : 'Keep this one'}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {customerName(customer)}
          {keeping ? null : (
            <Badge color="danger" variant="soft" size="sm">
              Retired after the merge
            </Badge>
          )}
        </span>
        <span className="text-sm">{contactLine(customer)}</span>
      </div>
    </li>
  );
}
