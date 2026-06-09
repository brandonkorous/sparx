'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Stack,
} from '@sparx/ui';
import { CheckCircle, XCircle } from 'lucide-react';

interface InvoiceActionsProps {
  invoiceId: string;
}

const PAYMENT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'ach', label: 'ACH / Bank transfer' },
  { value: 'wire', label: 'Wire transfer' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'other', label: 'Other' },
];

export function InvoiceActions({ invoiceId }: InvoiceActionsProps) {
  const router = useRouter();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [paidMethod, setPaidMethod] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleMarkPaid() {
    if (!paidMethod) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/b2b/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidMethod, notes: notes || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        alert(err?.message ?? 'Failed to mark as paid');
        return;
      }
      setMarkPaidOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleWriteOff() {
    setLoading(true);
    try {
      const res = await fetch(`/api/b2b/invoices/${invoiceId}/write-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        alert(err?.message ?? 'Failed to write off');
        return;
      }
      setWriteOffOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {/* Mark Paid */}
      <Modal open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <Button color="success" variant="soft" size="sm" onClick={() => setMarkPaidOpen(true)}>
          <CheckCircle className="mr-1 h-4 w-4" />
          Mark paid
        </Button>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Record payment</ModalTitle>
            <ModalDescription>
              This marks the invoice as paid and releases any associated credit hold.
            </ModalDescription>
          </ModalHeader>
          <Stack gap={4} className="py-2">
            <div>
              <label htmlFor="invoice-paid-method" className="mb-1 block text-sm font-medium">
                Payment method
              </label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger id="invoice-paid-method">
                  <SelectValue placeholder="Select method…" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="invoice-paid-notes" className="mb-1 block text-sm font-medium">
                Notes (optional)
              </label>
              <Textarea
                id="invoice-paid-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reference number, check number, etc."
                rows={2}
              />
            </div>
          </Stack>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setMarkPaidOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button color="success" onClick={handleMarkPaid} disabled={!paidMethod || loading}>
              {loading ? 'Saving…' : 'Confirm payment'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Write Off */}
      <Modal open={writeOffOpen} onOpenChange={setWriteOffOpen}>
        <Button color="danger" variant="ghost" size="sm" onClick={() => setWriteOffOpen(true)}>
          <XCircle className="mr-1 h-4 w-4" />
          Write off
        </Button>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Write off invoice</ModalTitle>
            <ModalDescription>
              This cancels the invoice and releases the credit hold. This action requires admin
              permission and cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <Stack gap={4} className="py-2">
            <div>
              <label htmlFor="invoice-writeoff-reason" className="mb-1 block text-sm font-medium">
                Reason (optional)
              </label>
              <Textarea
                id="invoice-writeoff-reason"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for write-off…"
                rows={3}
              />
            </div>
          </Stack>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setWriteOffOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button color="danger" onClick={handleWriteOff} disabled={loading}>
              {loading ? 'Saving…' : 'Write off invoice'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
