'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Stack } from '@sparx/ui';
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

  async function handle(action: 'accept' | 'decline') {
    setActing(action);
    try {
      await quoteLifecycleAction(quoteId, action);
      startTransition(() => router.refresh());
    } finally {
      setActing(null);
    }
  }

  if (!canAccept && !canDecline) return null;

  return (
    <Stack direction="row" gap={2}>
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
    </Stack>
  );
}
