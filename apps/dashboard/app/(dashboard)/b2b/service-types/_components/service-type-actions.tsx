'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Power, Trash2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'silicaui-react';
import { useConfirm } from '@sparx/ui';
import { updateServiceType, deleteServiceType } from '../_lib/actions';
import { ServiceTypeForm } from './service-type-form';

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  color: string | null;
  isActive: boolean;
  requiresVehicle: boolean;
  notes: string | null;
}

interface Props {
  type: ServiceType;
}

export function ServiceTypeActions({ type }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function toggleActive() {
    setSubmitting(true);
    try {
      const { error: err } = await updateServiceType(type.id, { isActive: !type.isActive });
      if (err) throw new Error(err);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${type.name}"?`,
        description:
          'This will remove the service type. Existing appointments using this type will not be affected, but new bookings will no longer be possible.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      setSubmitting(true);
      try {
        const { error: err } = await deleteServiceType(type.id);
        if (err) throw new Error(err);
        refresh();
      } finally {
        setSubmitting(false);
      }
    })();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button size="sm" variant="ghost" disabled={isPending || submitting}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void toggleActive()}>
            <Power className="mr-2 h-4 w-4" />
            {type.isActive ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete()} className="text-[var(--color-danger)]">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? (
        <ServiceTypeForm
          presentation="modal"
          type={type}
          open
          onOpenChange={(o) => !o && setEditOpen(false)}
        />
      ) : null}
    </>
  );
}
