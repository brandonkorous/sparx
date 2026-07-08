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
  Table,
} from 'silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { BookingPolicy, FeeType } from '../../_lib/types';
import { money } from '../../_lib/format';
import { deleteBookingPolicyAction } from '../../_lib/actions';
import { PolicyForm } from './policy-form';

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

export function PoliciesList({ policies }: { policies: BookingPolicy[] }) {
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

  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Deposit</th>
            <th>Notice</th>
            <th>Late fee</th>
            <th>No-show fee</th>
            <th>Reminders</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td>
              <td>
                {p.depositType === 'none' ? (
                  <span className="text-[var(--color-muted-foreground)]">—</span>
                ) : (
                  <Badge color="module" variant="soft" size="sm">
                    {depositSummary(p)}
                  </Badge>
                )}
              </td>
              <td>{p.cancellationWindowHours}h</td>
              <td>{feeSummary(p.lateCancelFeeType, p.lateCancelFeeValue)}</td>
              <td>{feeSummary(p.noShowFeeType, p.noShowFeeValue)}</td>
              <td>
                {p.reminderOffsetsMin.length ? `${p.reminderOffsetsMin.join(', ')} min` : '—'}
              </td>
              <td>
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
                    <DropdownMenuItem
                      onClick={() => void remove(p)}
                      className="text-[var(--color-danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

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
