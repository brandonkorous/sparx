'use client';

// Attach-order popover for the deal detail. Pulls the most recent orders
// for the tenant, filters to ones not already attached, and calls
// attachOrderToDealAction on click. Detach reuses the same data path.

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

import { attachOrderToDealAction, detachOrderFromDealAction } from '../../../deal-actions';

interface OrderOption {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  currency: string;
}

interface AttachOrderPopoverProps {
  dealId: string;
  candidates: OrderOption[];
  attachedIds: string[];
}

export function AttachOrderPopover({ dealId, candidates, attachedIds }: AttachOrderPopoverProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const attached = new Set(attachedIds);
  const filtered = candidates
    .filter((o) => !attached.has(o.id))
    .filter((o) => o.orderNumber.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 25);

  function attach(orderId: string) {
    startTransition(async () => {
      const result = await attachOrderToDealAction({ dealId, orderId });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not attach order');
        return;
      }
      toast.success('Order attached');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="outline" size="sm" iconStart={<Plus className="h-3.5 w-3.5" />}>
          Attach order
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-3" align="end">
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Filter by order number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-base-content/70 py-4 text-center text-sm">No matching orders.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => attach(o.id)}
                    disabled={pending}
                    className="hover:bg-module/10 flex items-center justify-between rounded-md p-2 text-left disabled:opacity-50"
                  >
                    <div className="flex flex-row items-center gap-2">
                      <Link2 className="text-base-content/50 h-3.5 w-3.5" />
                      <p className="text-sm font-medium">{o.orderNumber}</p>
                      <Badge color={statusTone(o.status)} variant="soft" size="sm">
                        {statusLabel(o.status)}
                      </Badge>
                    </div>
                    <p className="text-base-content/70 text-xs tabular-nums">
                      {o.currency} {Number(o.total).toLocaleString()}
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

export function DetachOrderButton({ dealId, orderId }: { dealId: string; orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function detach() {
    startTransition(async () => {
      const result = await detachOrderFromDealAction({ dealId, orderId });
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not detach order');
        return;
      }
      toast.success('Order detached');
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
      aria-label="Detach order"
    >
      <Unlink className="h-3.5 w-3.5" />
    </Button>
  );
}
