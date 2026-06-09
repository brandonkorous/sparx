'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@sparx/ui';
import { MoreHorizontal, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { syncSupplier, deleteSupplier } from '../_lib/actions';
import { SupplierForm } from './supplier-form';

interface Supplier {
  id: string;
  name: string;
  type: string;
  credentials: Record<string, string>;
  pricingRule: {
    type: string;
    value: number;
    roundTo?: string;
    maxMsrp?: string;
  } | null;
  notes: string | null;
}

interface Props {
  supplier: Supplier;
}

export function SupplierActions({ supplier }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const router = useRouter();

  function handleSync() {
    startSync(async () => {
      await syncSupplier(supplier.id);
      router.refresh();
    });
  }

  async function handleDelete() {
    await deleteSupplier(supplier.id);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button color="neutral" variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleSync} disabled={syncing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {syncing ? 'Queuing sync…' : 'Sync catalog'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-[var(--color-danger)]"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={editOpen} onOpenChange={setEditOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>Edit supplier</ModalTitle>
            <ModalDescription>Update connection settings and pricing rule.</ModalDescription>
          </ModalHeader>
          <SupplierForm
            supplier={supplier}
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
            <AlertDialogTitle>Disconnect {supplier.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The supplier and its unimported catalog entries will be removed. Products you already
              imported into your catalog are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--color-danger)] text-white"
              onClick={() => void handleDelete()}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
