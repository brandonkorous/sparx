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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
  useConfirm,
} from '@sparx/ui';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { SchedulingService } from '../../_lib/types';
import { BOOKING_TYPE_LABEL, duration, money } from '../../_lib/format';
import { deleteServiceAction } from '../../_lib/actions';
import { ServiceForm } from './service-form';

export function ServicesList({ services }: { services: SchedulingService[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<SchedulingService | null>(null);

  async function remove(svc: SchedulingService) {
    const ok = await confirm({
      title: `Delete "${svc.name}"?`,
      description:
        'The service is archived — existing bookings keep their reference, but it can no longer be booked.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteServiceAction(svc.id);
    if (result.ok) {
      toast.success('Service deleted');
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
            <TableHead>Type</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => (
            <TableRow key={svc.id}>
              <TableCell className="font-medium">{svc.name}</TableCell>
              <TableCell>{BOOKING_TYPE_LABEL[svc.bookingType]}</TableCell>
              <TableCell>{duration(svc.durationMinutes)}</TableCell>
              <TableCell>
                {svc.priceCents > 0 ? money(svc.priceCents, svc.currency) : '—'}
              </TableCell>
              <TableCell>{svc.capacity}</TableCell>
              <TableCell>
                <Badge color={svc.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
                  {svc.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" shape="square" size="sm" aria-label="Service actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(svc)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void remove(svc)}
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

      {editing ? (
        <ServiceForm
          presentation="modal"
          service={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
    </>
  );
}
