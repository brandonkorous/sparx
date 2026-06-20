'use client';

import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '@sparx/ui';
import { Plus } from 'lucide-react';

import { ResourceForm } from './resource-form';

export function NewResourceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button color="module" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New resource
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle>New resource</ModalTitle>
            <ModalDescription>
              Staff, assets, tables, spaces, or equipment a booking consumes.
            </ModalDescription>
          </ModalHeader>
          <ResourceForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </ModalContent>
      </Modal>
    </>
  );
}
