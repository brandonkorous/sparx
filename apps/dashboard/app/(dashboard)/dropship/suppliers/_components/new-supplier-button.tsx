'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '@sparx/ui';
import { Plus } from 'lucide-react';
import { SupplierForm } from './supplier-form';

export function NewSupplierButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button color="primary" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Connect supplier
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>Connect a supplier</ModalTitle>
            <ModalDescription>
              Add a dropship supplier. The connection is validated immediately.
            </ModalDescription>
          </ModalHeader>
          <SupplierForm
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </ModalContent>
      </Modal>
    </>
  );
}
