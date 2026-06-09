'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Text,
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sparx/ui';
import { syncSource, deleteSource } from '../_lib/actions';
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
  const [syncing, startSync] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function triggerSync() {
    setSyncError(null);
    startSync(async () => {
      const { error } = await syncSource(source.id);
      if (error) {
        setSyncError(error);
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const { error } = await deleteSource(source.id);
      if (error) {
        setDeleteError(error);
      } else {
        setDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button color="neutral" variant="ghost" size="sm">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={triggerSync} disabled={syncing}>
              <RefreshCw className="mr-2 size-4" />
              {syncing ? 'Syncing…' : 'Sync now'}
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
        {syncError && (
          <Text size="xs" className="max-w-[200px] text-right text-[var(--color-danger)]">
            {syncError}
          </Text>
        )}
      </div>

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

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteError(null);
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &quot;{source.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect the source and stop future syncs. Existing stock levels are
              retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Text size="sm" className="px-6 text-[var(--color-danger)]">
              {deleteError}
            </Text>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button color="danger" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
