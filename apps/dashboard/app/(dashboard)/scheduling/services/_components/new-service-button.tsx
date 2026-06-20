'use client';

import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '@sparx/ui';
import { Plus } from 'lucide-react';

import { ServiceForm } from './service-form';

export function NewServiceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button color="module" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New service
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>New service</ModalTitle>
            <ModalDescription>Define something bookable and how it gets staffed.</ModalDescription>
          </ModalHeader>
          <ServiceForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </ModalContent>
      </Modal>
    </>
  );
}
