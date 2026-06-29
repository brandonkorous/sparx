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
  toast,
  useConfirm,
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
  const router = useRouter();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [syncing, startSync] = useTransition();
  const [syncError, setSyncError] = useState<string | null>(null);

  function handleSync() {
    setSyncError(null);
    startSync(async () => {
      const { error } = await syncSupplier(supplier.id);
      if (error) {
        setSyncError(error);
        toast.error('Catalog refresh failed', { description: error });
      } else {
        // The sync runs async on a worker — confirm it's queued rather than imply
        // the catalog already updated. Already-imported products are refreshed
        // individually via Re-sync on Dropship → Products.
        toast.success('Catalog refresh queued', {
          description:
            'Fetching the latest products from this supplier — refresh shortly to see them.',
        });
        router.refresh();
      }
    });
  }

  function onDisconnect() {
    void (async () => {
      const ok = await confirm({
        title: `Disconnect ${supplier.name}?`,
        description:
          'The supplier and its unimported catalog entries will be removed. Products you already imported into your catalog are not affected.',
        confirmLabel: 'Disconnect',
        tone: 'danger',
      });
      if (!ok) return;
      const { error } = await deleteSupplier(supplier.id);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success('Supplier disconnected');
      router.refresh();
    })();
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
              {syncing ? 'Queuing refresh…' : 'Refresh catalog'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDisconnect} className="text-[var(--color-danger)]">
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {syncError && (
          <Text size="xs" variant="danger" className="max-w-[200px] text-right">
            {syncError}
          </Text>
        )}
      </div>

      {editOpen ? (
        <SupplierForm
          presentation="modal"
          supplier={supplier}
          vendor={vendor}
          sites={sites}
          open
          onOpenChange={(o) => !o && setEditOpen(false)}
        />
      ) : null}
    </>
  );
}
