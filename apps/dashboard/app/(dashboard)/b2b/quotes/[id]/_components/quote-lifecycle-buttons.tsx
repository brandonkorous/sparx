'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'silicaui-react';
import { quoteLifecycleAction } from '../../_lib/actions';

interface Props {
  quoteId: string;
  canAccept: boolean;
  canDecline: boolean;
}

export function QuoteLifecycleButtons({ quoteId, canAccept, canDecline }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handle(action: 'accept' | 'decline') {
    setActing(action);
    setActionError(null);
    try {
      const { error } = await quoteLifecycleAction(quoteId, action);
      if (error) {
        setActionError(error);
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setActing(null);
    }
  }

  if (!canAccept && !canDecline) return null;

  return (
    <div className="flex flex-col gap-2">
      {actionError && <p className="text-sm text-[var(--color-danger)]">{actionError}</p>}
      <div className="flex flex-row gap-2">
        {canDecline && (
          <Button
            color="danger"
            variant="outline"
            size="sm"
            disabled={acting !== null}
            onClick={() => void handle('decline')}
          >
            {acting === 'decline' ? 'Declining…' : 'Decline'}
          </Button>
        )}
        {canAccept && (
          <Button
            color="success"
            size="sm"
            disabled={acting !== null}
            onClick={() => void handle('accept')}
          >
            {acting === 'accept' ? 'Accepting…' : 'Accept'}
          </Button>
        )}
      </div>
    </div>
  );
}
