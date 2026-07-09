'use client';

// Client-side lifecycle action bar for the quote detail page. Each button
// triggers a Server Action and updates the URL on success so the page
// re-fetches the new status.

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ArrowRight, Check, X, Clock, Send } from 'lucide-react';

import { Button } from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';

import {
  acceptQuoteAction,
  convertQuoteAction,
  declineQuoteAction,
  expireQuoteAction,
  submitQuoteAction,
} from '../../../quote-actions';

interface QuoteLifecycleActionsProps {
  quoteId: string;
  status: string;
}

export function QuoteLifecycleActions({ quoteId, status }: QuoteLifecycleActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error?.message ?? `Could not ${label}`);
        return;
      }
      toast.success(`Quote ${label}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-row flex-wrap gap-2">
      {status === 'draft' && (
        <Button
          color="module"
          iconStart={<Send className="h-4 w-4" />}
          disabled={isPending}
          onClick={() => run('submitted', () => submitQuoteAction({ quoteId }))}
        >
          Submit
        </Button>
      )}
      {status === 'submitted' && (
        <>
          <Button
            color="module"
            iconStart={<Check className="h-4 w-4" />}
            disabled={isPending}
            onClick={() => run('accepted', () => acceptQuoteAction({ quoteId }))}
          >
            Accept
          </Button>
          <Button
            variant="outline"
            iconStart={<X className="h-4 w-4" />}
            disabled={isPending}
            onClick={() => run('declined', () => declineQuoteAction({ quoteId }))}
          >
            Decline
          </Button>
        </>
      )}
      {(status === 'submitted' || status === 'draft') && (
        <Button
          variant="ghost"
          iconStart={<Clock className="h-4 w-4" />}
          disabled={isPending}
          onClick={() => run('expired', () => expireQuoteAction({ quoteId }))}
        >
          Expire
        </Button>
      )}
      {status === 'accepted' && (
        <Button
          color="module"
          iconEnd={<ArrowRight className="h-4 w-4" />}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await convertQuoteAction({ quoteId });
              if (!result.ok) {
                toast.error(result.error.message ?? 'Could not convert quote');
                return;
              }
              toast.success(`Converted to order ${result.data.orderNumber}`);
              router.push(`/crm/orders/${result.data.orderId}`);
            })
          }
        >
          Convert to order
        </Button>
      )}
    </div>
  );
}
