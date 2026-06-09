'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import { SourceForm } from './source-form';

interface Source {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  syncIntervalSec: number;
  notes: string | null;
}

export function SourceActions({ source }: { source: Source }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function triggerSync() {
    startTransition(async () => {
      try {
        await api.post(`/v1/inventory/sources/${source.id}/sync`);
        router.refresh();
      } catch {
        // error swallowed — real apps surface a toast
      }
    });
  }

  async function handleDelete() {
    await api.delete(`/v1/inventory/sources/${source.id}`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button color="neutral" variant="ghost" size="sm">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={triggerSync} disabled={isPending}>
            <RefreshCw className="mr-2 size-4" />
            {isPending ? 'Syncing…' : 'Sync now'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-[var(--color-danger)]"
          >
            <Trash2 className="mr-2 size-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={editOpen} onOpenChange={setEditOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Edit source</ModalTitle>
            <ModalDescription>Update this inventory source&apos;s configuration.</ModalDescription>
          </ModalHeader>
          <SourceForm
            source={source}
            onSuccess={() => {
              setEditOpen(false);
              router.refresh();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </ModalContent>
      </Modal>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &quot;{source.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the source and stop future syncs. Existing stock levels are
              retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
              onClick={() => void handleDelete()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
