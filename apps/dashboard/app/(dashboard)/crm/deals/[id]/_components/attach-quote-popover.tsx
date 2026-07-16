'use client';

// Attach-quote popover for the deal detail. Mirrors attach-order-popover.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Plus, Unlink } from 'lucide-react';

import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizeworks/silicaui-react';
import { toast, statusLabel, statusTone } from '@sparx/ui';

import { attachQuoteToDealAction, detachQuoteFromDealAction } from '../../../deal-actions';

interface QuoteOption {
  id: string;
  number: string | null;
  status: string;
  total: string;
  currency: string;
}

interface AttachQuotePopoverProps {
  dealId: string;
  candidates: QuoteOption[];
  attachedIds: string[];
}

export function AttachQuotePopover({ dealId, candidates, attachedIds }: AttachQuotePopoverProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const attached = new Set(attachedIds);
  const filtered = candidates
    .filter((q) => !attached.has(q.id))
    .filter((q) => (q.number ?? '').toLowerCase().includes(query.toLowerCase()))
    .slice(0, 25);

  function attach(documentId: string) {
    startTransition(async () => {
      const result = await attachQuoteToDealAction({ dealId, documentId });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not attach quote');
        return;
      }
      toast.success('Quote attached');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="outline" size="sm" iconStart={<Plus className="h-3.5 w-3.5" />}>
          Attach quote
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-3" align="end">
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Filter by quote number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-base-content py-4 text-center text-sm">No matching quotes.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {filtered.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => attach(q.id)}
                    disabled={pending}
                    className="hover:bg-module/10 flex items-center justify-between rounded-md p-2 text-left disabled:opacity-50"
                  >
                    <div className="flex flex-row items-center gap-2">
                      <Link2 className="text-base-content h-3.5 w-3.5" />
                      <p className="text-sm font-medium">{q.number ?? '—'}</p>
                      <Badge color={statusTone(q.status)} variant="soft" size="sm">
                        {statusLabel(q.status)}
                      </Badge>
                    </div>
                    <p className="text-base-content text-xs tabular-nums">
                      {q.currency} {Number(q.total).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DetachQuoteButton({ dealId, documentId }: { dealId: string; documentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function detach() {
    startTransition(async () => {
      const result = await detachQuoteFromDealAction({ dealId, documentId });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not detach quote');
        return;
      }
      toast.success('Quote detached');
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      shape="square"
      size="sm"
      onClick={detach}
      disabled={pending}
      aria-label="Detach quote"
    >
      <Unlink className="h-3.5 w-3.5" />
    </Button>
  );
}
