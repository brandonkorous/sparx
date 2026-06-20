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
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
  useConfirm,
} from '@sparx/ui';
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
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Notice</TableHead>
            <TableHead>Late fee</TableHead>
            <TableHead>No-show fee</TableHead>
            <TableHead>Reminders</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {policies.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell>
                {p.depositType === 'none' ? (
                  <span className="text-[var(--color-muted-foreground)]">—</span>
                ) : (
                  <Badge color="module" variant="soft">
                    {depositSummary(p)}
                  </Badge>
                )}
              </TableCell>
              <TableCell>{p.cancellationWindowHours}h</TableCell>
              <TableCell>{feeSummary(p.lateCancelFeeType, p.lateCancelFeeValue)}</TableCell>
              <TableCell>{feeSummary(p.noShowFeeType, p.noShowFeeValue)}</TableCell>
              <TableCell>
                {p.reminderOffsetsMin.length ? `${p.reminderOffsetsMin.join(', ')} min` : '—'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" shape="square" size="sm" aria-label="Policy actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(p)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void remove(p)}
                      className="text-[var(--color-danger)]"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Edit policy</ModalTitle>
          </ModalHeader>
          {editing ? (
            <PolicyForm
              policy={editing}
              onSuccess={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </ModalContent>
      </Modal>
    </>
  );
}
