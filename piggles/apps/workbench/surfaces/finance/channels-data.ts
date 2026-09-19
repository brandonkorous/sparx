'use client';

// Channels data — takings split by where the sale happened, over a date window.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';

export interface ChannelRow {
  key: string;
  channel: string | null;
  source: string | null;
  orders: number;
  /** Order value placed through this channel. */
  gross: number;
  /** Money actually received. */
  net: number;
  refunds: number;
  /** Sold, not refunded, and nobody has paid for it yet. Completes the
   *  arithmetic: gross − refunds − owed = net. Without it the three figures on
   *  screen do not reconcile and the gap is unexplained. */
  owed: number;
}

export interface ChannelsReport {
  from: string;
  to: string;
  currency: string;
  channels: ChannelRow[];
  totals: { orders: number; gross: number; net: number; refunds: number; owed: number };
}

/** `days` picks the trailing window; the server defaults to 90 when omitted. */
export function useChannels(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return useQuery({
    queryKey: ['finance', 'channels', days],
    queryFn: () =>
      api.get<ChannelsReport>('/v1/finance/channels', {
        from: from.toISOString(),
        to: to.toISOString(),
      }),
  });
}
