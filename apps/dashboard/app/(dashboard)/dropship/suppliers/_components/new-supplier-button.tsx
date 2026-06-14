'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '@sparx/ui';
import { Plus, ArrowLeft } from 'lucide-react';
import { SupplierForm, type Vendor, type SiteOption } from './supplier-form';
import { VendorPicker } from './vendor-picker';

interface Props {
  vendors: Vendor[];
  sites: SiteOption[];
}

export function NewSupplierButton({ vendors, sites }: Props) {
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const router = useRouter();

  function reset() {
    setVendor(null);
  }

  function close() {
    setOpen(false);
    // Defer reset so the modal doesn't flicker between steps while closing.
    setTimeout(reset, 150);
  }

  return (
    <>
      <Button color="module" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Connect supplier
      </Button>

      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!o) close();
          else setOpen(true);
        }}
      >
        <ModalContent className="max-w-lg">
          {vendor ? (
            <>
              <ModalHeader>
                <ModalTitle>
                  <button
                    type="button"
                    onClick={reset}
                    className="mr-2 inline-flex items-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                    aria-label="Back to supplier list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  Connect {vendor.label}
                </ModalTitle>
                <ModalDescription>{vendor.description}</ModalDescription>
              </ModalHeader>
              <SupplierForm
                vendor={vendor}
                sites={sites}
                onSuccess={() => {
                  close();
                  router.refresh();
                }}
                onCancel={close}
              />
            </>
          ) : (
            <>
              <ModalHeader>
                <ModalTitle>Connect a supplier</ModalTitle>
                <ModalDescription>
                  Choose a supplier to source and import products from.
                </ModalDescription>
              </ModalHeader>
              <VendorPicker vendors={vendors} onSelect={setVendor} />
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
