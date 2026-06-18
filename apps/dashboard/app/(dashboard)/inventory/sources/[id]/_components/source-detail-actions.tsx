'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Pencil, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
} from '@sparx/ui';

import { syncSource, deleteSource } from '../../_lib/actions';
import { SourceForm } from '../../_components/source-form';
import type { SourceSummary } from './types';

// Header actions for a source's connection detail page: trigger a sync now, edit
// the connection config, or remove it. Remove navigates back to the sources list;
// sync/edit refresh in place. Reuses the shared source actions + SourceForm.

export function SourceDetailActions({ source }: { source: SourceSummary }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [syncing, startSync] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function triggerSync() {
    setError(null);
    startSync(async () => {
      const { error: err } = await syncSource(source.id);
      if (err) setError(err);
      else router.refresh();
    });
  }

  function handleDelete() {
    setError(null);
    startDelete(async () => {
      const { error: err } = await deleteSource(source.id);
      if (err) {
        setError(err);
        return;
      }
      setDeleteOpen(false);
      router.push('/inventory/sources');
      router.refresh();
    });
  }

  const editSource = {
    id: source.id,
    name: source.name,
    type: source.type,
    config: (source.config ?? {}) as Record<string, string>,
    syncIntervalSec: source.syncIntervalSec,
    notes: source.notes,
  };

  return (
    <>
      <Stack direction="row" gap={2} align="center" wrap>
        {error ? (
          <Text size="xs" className="text-[var(--color-danger)]">
            {error}
          </Text>
        ) : null}
        <Button
          color="module"
          onClick={triggerSync}
          disabled={syncing}
          leftIcon={<RefreshCw className="size-4" />}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
        <Button
          color="neutral"
          variant="soft"
          onClick={() => setEditOpen(true)}
          leftIcon={<Pencil className="size-4" />}
        >
          Edit
        </Button>
        <Button
          color="danger"
          variant="ghost"
          onClick={() => setDeleteOpen(true)}
          leftIcon={<Trash2 className="size-4" />}
        >
          Remove
        </Button>
      </Stack>

      <Modal open={editOpen} onOpenChange={setEditOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Edit source</ModalTitle>
            <ModalDescription>Update this inventory source&apos;s configuration.</ModalDescription>
          </ModalHeader>
          <SourceForm
            source={editSource}
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
          if (!open) setError(null);
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &quot;{source.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This disconnects the source and stops future syncs. Existing stock levels and mappings
              are retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button color="danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
