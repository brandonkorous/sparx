'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '@sparx/ui';
import { SourceForm } from './source-form';

export function NewSourceButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button color="primary" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Connect source
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Connect inventory source</ModalTitle>
            <ModalDescription>
              Configure a CSV feed or API connection for stock-level sync.
            </ModalDescription>
          </ModalHeader>
          <SourceForm
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
