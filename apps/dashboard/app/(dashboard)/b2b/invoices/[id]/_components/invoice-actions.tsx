'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Select,
  Textarea,
} from 'silicaui-react';
import { toast } from '@sparx/ui';
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
        toast.error(err?.message ?? 'Failed to mark as paid');
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
        toast.error(err?.message ?? 'Failed to write off');
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
      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <Button
          color="success"
          variant="soft"
          size="sm"
          iconStart={<CheckCircle className="h-4 w-4" />}
          onClick={() => {
            setPaidMethod('');
            setNotes('');
            setMarkPaidOpen(true);
          }}
        >
          Mark paid
        </Button>
        <DialogContent>
          <div>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              This marks the invoice as paid and releases any associated credit hold.
            </DialogDescription>
          </div>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label htmlFor="invoice-paid-method" className="mb-1 block text-sm font-medium">
                Payment method
              </label>
              <Select
                id="invoice-paid-method"
                value={paidMethod}
                onValueChange={(v) => setPaidMethod(v as string)}
                items={PAYMENT_METHODS}
                placeholder="Select method…"
              />
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMarkPaidOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button color="success" onClick={handleMarkPaid} disabled={!paidMethod || loading}>
              {loading ? 'Saving…' : 'Confirm payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Write Off */}
      <Dialog open={writeOffOpen} onOpenChange={setWriteOffOpen}>
        <Button
          color="danger"
          variant="ghost"
          size="sm"
          iconStart={<XCircle className="h-4 w-4" />}
          onClick={() => {
            setNotes('');
            setWriteOffOpen(true);
          }}
        >
          Write off
        </Button>
        <DialogContent>
          <div>
            <DialogTitle>Write off invoice</DialogTitle>
            <DialogDescription>
              This cancels the invoice and releases the credit hold. This action requires admin
              permission and cannot be undone.
            </DialogDescription>
          </div>
          <div className="flex flex-col gap-4 py-2">
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWriteOffOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button color="danger" onClick={handleWriteOff} disabled={loading}>
              {loading ? 'Saving…' : 'Write off invoice'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
