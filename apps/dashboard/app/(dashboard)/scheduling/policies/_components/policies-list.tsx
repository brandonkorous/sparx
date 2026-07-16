'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@wizeworks/silicaui-react';
import {
  SelectionList,
  toast,
  useConfirm,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { BookingPolicy, FeeType } from '../../_lib/types';
import { money } from '../../_lib/format';
import { deleteBookingPolicyAction } from '../../_lib/actions';
import { PolicyForm } from './policy-form';

// Policies index list — rendered through the shared `SelectionList` dual-view
// substrate (docs/34 §7) so it gains the Table/Cards toggle. Read-only
// selection: each row's actions (edit / delete) live in a dropdown.

const DEPOSIT_LABEL: Record<string, string> = {
  none: 'None',
  card_hold: 'Card hold',
  deposit: 'Deposit',
  prepay: 'Prepay',
};

function depositSummary(p: BookingPolicy): string {
  if (p.depositType === 'none') return '—';
  const label = DEPOSIT_LABEL[p.depositType] ?? p.depositType;
  if (p.depositType === 'prepay') return `${label} (full price)`;
  if (p.depositAmountCents) return `${label} · ${money(p.depositAmountCents, 'usd')}`;
  if (p.depositPercent) return `${label} · ${p.depositPercent}%`;
  return label;
}

function feeSummary(type: FeeType | null, value: number | null): string {
  if (!type || value == null) return '—';
  return type === 'fixed' ? money(value, 'usd') : `${value}%`;
}

interface PoliciesListProps {
  policies: BookingPolicy[];
  view: 'table' | 'card';
}

export function PoliciesList({ policies, view }: PoliciesListProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<BookingPolicy | null>(null);

  async function remove(p: BookingPolicy) {
    const ok = await confirm({
      title: `Delete "${p.name}"?`,
      description:
        'Services and bookings using this policy are detached (they keep their existing booking terms); this cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteBookingPolicyAction(p.id);
    if (result.ok) {
      toast.success('Policy deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const depositBadge = (p: BookingPolicy) =>
    p.depositType === 'none' ? (
      <span className="text-base-content">—</span>
    ) : (
      <Badge color="module" variant="soft" size="sm">
        {depositSummary(p)}
      </Badge>
    );

  const actionsMenu = (p: BookingPolicy) => (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" shape="square" size="sm" aria-label="Policy actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setEditing(p)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void remove(p)} className="text-danger">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: SelectionColumn<BookingPolicy>[] = [
    { header: 'Name', cell: (p) => <span className="font-medium">{p.name}</span> },
    { header: 'Deposit', cell: depositBadge },
    { header: 'Notice', cell: (p) => `${p.cancellationWindowHours}h` },
    { header: 'Late fee', cell: (p) => feeSummary(p.lateCancelFeeType, p.lateCancelFeeValue) },
    { header: 'No-show fee', cell: (p) => feeSummary(p.noShowFeeType, p.noShowFeeValue) },
    {
      header: 'Reminders',
      cell: (p) => (p.reminderOffsetsMin.length ? `${p.reminderOffsetsMin.join(', ')} min` : '—'),
    },
    { header: '', align: 'right', cell: actionsMenu },
  ];

  const card: SelectionCard<BookingPolicy> = {
    title: (p) => <p className="font-medium">{p.name}</p>,
    subtitle: (p) => (
      <p className="text-base-content text-xs">{p.cancellationWindowHours}h notice</p>
    ),
    badge: depositBadge,
    body: (p) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content text-sm">
          Late {feeSummary(p.lateCancelFeeType, p.lateCancelFeeValue)} · No-show{' '}
          {feeSummary(p.noShowFeeType, p.noShowFeeValue)}
        </p>
        {actionsMenu(p)}
      </div>
    ),
  };

  return (
    <>
      <SelectionList
        items={policies}
        view={view}
        getId={(p) => p.id}
        getRowLabel={(p) => p.name}
        entityLabelPlural="policies"
        selectable={false}
        columns={columns}
        card={card}
      />

      {editing ? (
        <PolicyForm
          presentation="modal"
          policy={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
    </>
  );
}
