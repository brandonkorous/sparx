'use client';

// Document lifecycle actions that don't belong on the stage bar: converting an
// accepted quote into a real commerce Order (fulfillment/shipping/inventory —
// docs/87 §15 convergence), sending a hosted payment link for the outstanding
// balance (docs/94 ADR §8), and deleting a draft document. Each confirms
// before acting; delete and convert are destructive/hard-to-reverse enough to
// warrant it, and a payment link is worth a beat since it emails the customer.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, FileOutput, Trash2 } from 'lucide-react';

import { useConfirm, toast } from '@sparx/ui';
import { Button } from '@wizeworks/silicaui-react';

import {
  convertToOrderAction,
  deleteDocumentAction,
  paymentLinkAction,
} from '../../../document-actions';

interface DocumentActionsBarProps {
  documentId: string;
  /** Null once already converted. */
  canConvertToOrder: boolean;
  convertedOrder: { id: string; orderNumber: string | null } | null;
  canDelete: boolean;
  balance: number;
}

export function DocumentActionsBar({
  documentId,
  canConvertToOrder,
  convertedOrder,
  canDelete,
  balance,
}: DocumentActionsBarProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onConvertToOrder() {
    void (async () => {
      const ok = await confirm({
        title: 'Convert to order?',
        description:
          'This creates a real order from the current lines and totals, for fulfillment, shipping, and inventory. The document stays as-is.',
        tone: 'module',
        confirmLabel: 'Convert to order',
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await convertToOrderAction(documentId);
        if (!res.ok) {
          toast.error("Couldn't convert to order", { description: res.error.message });
          return;
        }
        toast.success(`Order ${res.data.orderNumber ?? ''} created`);
        router.refresh();
      });
    })();
  }

  function onPaymentLink() {
    startTransition(async () => {
      const successUrl = `${window.location.origin}/invoicing/documents/${documentId}`;
      const res = await paymentLinkAction(documentId, successUrl);
      if (!res.ok) {
        toast.error("Couldn't create a payment link", { description: res.error.message });
        return;
      }
      try {
        await navigator.clipboard.writeText(res.data.url);
        toast.success('Payment link copied to clipboard');
      } catch {
        toast.success('Payment link created', { description: res.data.url });
      }
    });
  }

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete this draft?',
        description: 'This permanently removes the document and its lines. It cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Delete draft',
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await deleteDocumentAction(documentId);
        if (!res.ok) {
          toast.error("Couldn't delete document", { description: res.error.message });
          return;
        }
        router.push('/invoicing/documents');
      });
    })();
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {convertedOrder ? (
        <Button
          variant="outline"
          size="sm"
          iconStart={<FileOutput className="h-4 w-4" />}
          render={<Link href={`/crm/orders/${convertedOrder.id}`} />}
        >
          View order {convertedOrder.orderNumber ?? ''}
        </Button>
      ) : canConvertToOrder ? (
        <Button
          variant="outline"
          size="sm"
          color="module"
          iconStart={<FileOutput className="h-4 w-4" />}
          disabled={pending}
          onClick={onConvertToOrder}
        >
          Convert to order
        </Button>
      ) : null}
      {balance > 0 && (
        <Button
          variant="outline"
          size="sm"
          iconStart={<CreditCard className="h-4 w-4" />}
          disabled={pending}
          onClick={onPaymentLink}
        >
          Send payment link
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          color="danger"
          iconStart={<Trash2 className="h-4 w-4" />}
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
    </div>
  );
}
