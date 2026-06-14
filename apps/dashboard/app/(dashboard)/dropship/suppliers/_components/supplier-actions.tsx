'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Text,
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
} from '@sparx/ui';
import { MoreHorizontal, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { syncSupplier, deleteSupplier } from '../_lib/actions';
import {
  SupplierForm,
  type SiteOption,
  type Vendor,
  type VendorCredentialField,
} from './supplier-form';

interface Supplier {
  id: string;
  name: string;
  type: string;
  // Credential spec + "token on file?" flag from the API. Secrets themselves are
  // never sent to the browser.
  credentialFields?: VendorCredentialField[];
  credentialsSet?: boolean;
  pricingRule: {
    type: string;
    value: number;
    roundTo?: string;
    maxMsrp?: string;
  } | null;
  notes: string | null;
  siteScope?: string[];
}

interface Props {
  supplier: Supplier;
  sites: SiteOption[];
  vendors: Vendor[];
}

export function SupplierActions({ supplier, sites, vendors }: Props) {
  // Resolve the vendor spec so the edit form renders the right credential fields
  // (secrets are write-only, so they can't be derived from the API response).
  const vendor = vendors.find((v) => v.slug === supplier.type);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  function handleSync() {
    setSyncError(null);
    startSync(async () => {
      const { error } = await syncSupplier(supplier.id);
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
      const { error } = await deleteSupplier(supplier.id);
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
        {syncError && (
          <Text size="xs" className="max-w-[200px] text-right text-[var(--color-danger)]">
            {syncError}
          </Text>
        )}
      </div>

      <Modal open={editOpen} onOpenChange={setEditOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>Edit supplier</ModalTitle>
            <ModalDescription>Update connection settings and pricing rule.</ModalDescription>
          </ModalHeader>
          <SupplierForm
            vendor={vendor}
            supplier={supplier}
            sites={sites}
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
            <AlertDialogTitle>Disconnect {supplier.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The supplier and its unimported catalog entries will be removed. Products you already
              imported into your catalog are not affected.
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
              {deleting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
