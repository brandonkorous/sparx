'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle } from '@sparx/ui';
import { ServiceTypeForm } from './service-type-form';

export function NewServiceTypeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button color="primary" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-4 w-4" />
        New service type
      </Button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>New service type</ModalTitle>
          </ModalHeader>
          <div className="px-6 pb-6">
            <ServiceTypeForm onSuccess={onSuccess} onCancel={() => setOpen(false)} />
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
