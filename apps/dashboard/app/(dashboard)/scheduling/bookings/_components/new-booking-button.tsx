'use client';

import { useState } from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '@sparx/ui';
import { Plus } from 'lucide-react';

import type { SchedulingService } from '../../_lib/types';
import { BookingForm } from './booking-form';

export function NewBookingButton({ services }: { services: SchedulingService[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button color="module" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        New booking
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>New booking</ModalTitle>
            <ModalDescription>
              Pick a service and a time — only open slots that respect availability and buffers are
              shown.
            </ModalDescription>
          </ModalHeader>
          <BookingForm
            services={services}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </ModalContent>
      </Modal>
    </>
  );
}
