'use client';

// Merge candidates UI — pick a primary from the group, mark the others as
// duplicates, fire the mergeCustomersAction. Refresh after success.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { statusLabel } from '@sparx/ui';
import { Badge, Button } from 'silicaui-react';

import { mergeCustomersAction } from '../../actions';

// Customer shape comes serialized from /v1/crm/customers/duplicates — dates
// arrive as ISO strings, decimals as strings.
export interface DuplicateCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  type: string;
  orderCount: number;
  totalSpent: string | number;
  updatedAt: string;
}

interface Props {
  customers: DuplicateCustomer[];
}

export function MergeCandidatesGroup({ customers }: Props) {
  const router = useRouter();
  const [primaryId, setPrimaryId] = useState<string>(customers[0]?.id ?? '');
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(
    () => new Set(customers.slice(1).map((c) => c.id))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function selectPrimary(id: string) {
    setPrimaryId(id);
    const nextDups = new Set(duplicateIds);
    nextDups.delete(id);
    // If only one duplicate would remain after promoting, restore the
    // previous primary as a duplicate so the merge still has something to do.
    if (nextDups.size === 0) {
      for (const c of customers) {
        if (c.id !== id) nextDups.add(c.id);
      }
    }
    setDuplicateIds(nextDups);
  }

  function toggleDuplicate(id: string) {
    if (id === primaryId) return;
    const next = new Set(duplicateIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDuplicateIds(next);
  }

  function onMerge() {
    setError(null);
    if (!primaryId || duplicateIds.size === 0) {
      setError('Pick a primary and at least one duplicate.');
      return;
    }
    startTransition(async () => {
      const result = await mergeCustomersAction({
        primaryCustomerId: primaryId,
        duplicateCustomerIds: [...duplicateIds],
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {customers.map((c) => {
          const isPrimary = c.id === primaryId;
          const isDup = duplicateIds.has(c.id);
          return (
            <div
              key={c.id}
              className={`flex flex-row items-center justify-between rounded-md border p-3 ${
                isPrimary
                  ? 'border-[var(--module-active)] bg-[var(--module-active-subtle,transparent)]'
                  : 'border-[var(--color-border-default)]'
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-row flex-wrap items-center gap-2">
                  <Link
                    href={`/crm/customers/${c.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {customerDisplayName(c)}
                  </Link>
                  <Badge color="neutral" variant="soft" size="sm">
                    {statusLabel(c.type)}
                  </Badge>
                  {c.email && <p className="text-base-content/70 text-xs">{c.email}</p>}
                  {c.orderCount > 0 && (
                    <Badge color="success" variant="soft" size="sm">
                      {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                <p className="text-base-content/70 text-xs">
                  Updated {new Date(c.updatedAt).toLocaleString()} · Total spent $
                  {Number(c.totalSpent).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-row gap-2">
                <Button
                  size="sm"
                  color={isPrimary ? 'module' : 'neutral'}
                  variant={isPrimary ? 'solid' : 'outline'}
                  onClick={() => selectPrimary(c.id)}
                  disabled={pending}
                >
                  {isPrimary ? 'Primary' : 'Make primary'}
                </Button>
                <Button
                  size="sm"
                  color={isDup ? 'danger' : 'neutral'}
                  variant={isDup ? 'solid' : 'outline'}
                  onClick={() => toggleDuplicate(c.id)}
                  disabled={pending || isPrimary}
                >
                  {isDup ? 'Will merge' : 'Skip'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex flex-row gap-2">
        <Button onClick={onMerge} color="module" disabled={pending}>
          {pending ? 'Merging…' : `Merge ${duplicateIds.size} into primary`}
        </Button>
        <p className="text-base-content/70 text-xs">
          Activities, deals, tasks, and addresses on the duplicates reattach to the primary. The
          duplicates are soft-deleted with a pointer to the primary.
        </p>
      </div>
    </div>
  );
}

function customerDisplayName(c: DuplicateCustomer): string {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (c.company) return c.company;
  if (c.email) return c.email;
  return 'Unnamed customer';
}
