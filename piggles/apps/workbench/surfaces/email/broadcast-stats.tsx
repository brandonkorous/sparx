'use client';

// How a broadcast did, once it has gone out.
//
// The rules that decide what each tile SAYS live next door in
// `broadcast-stats-words`, where they can be tested. This file is the drawing.

import { Text } from '@wizeworks/silicaui-react';
import type { BroadcastStats } from './broadcasts-data';
import { achievedTone, deliveredTile, shareOfLabel, type Tone } from './broadcast-stats-words';

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

export function StatsGrid({
  stats,
  recipients,
  sentAt,
}: {
  stats: BroadcastStats;
  recipients: number;
  /** When it went out. The Delivered tile needs it: "confirmations arrive over
   *  the next few minutes" is only true for the next few minutes. */
  sentAt: string | null;
}) {
  // Opens and clicks are shares of what actually landed; the rest are counts on
  // their own. Fall back through delivered → accepted → recipients so an early
  // send with sparse events still reads sensibly.
  const base = stats.delivered || stats.accepted || recipients || 0;
  const pct = (part: number) => (base > 0 ? `${String(Math.round((part / base) * 100))}%` : '—');
  const delivered = deliveredTile(stats, sentAt);
  const shareOf = shareOfLabel(stats.delivered);

  return (
    <div className="grid gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
      <StatBlock
        label="Delivered"
        value={delivered.value.toLocaleString()}
        hint={delivered.hint}
        tone={delivered.tone}
      />
      <StatBlock
        label="Opened"
        value={stats.opened.toLocaleString()}
        hint={`${pct(stats.opened)} ${shareOf}`}
        tone={achievedTone(stats.opened)}
      />
      <StatBlock
        label="Clicked"
        value={stats.clicked.toLocaleString()}
        hint={`${pct(stats.clicked)} ${shareOf}`}
        tone={achievedTone(stats.clicked)}
      />
      <StatBlock
        label="Bounced"
        value={stats.bounced.toLocaleString()}
        hint="Couldn’t be delivered"
        tone={stats.bounced > 0 ? 'warning' : 'plain'}
      />
      <StatBlock
        label="Unsubscribed"
        value={stats.unsubscribed.toLocaleString()}
        hint="Opted out from this"
        tone={stats.unsubscribed > 0 ? 'warning' : 'plain'}
      />
      <StatBlock
        label="Spam complaints"
        value={stats.complained.toLocaleString()}
        hint="Marked as spam"
        tone={stats.complained > 0 ? 'error' : 'plain'}
      />
    </div>
  );
}

const TONE_INK: Record<Tone, string> = {
  plain: '',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

function StatBlock({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: Tone;
}) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-lg border p-3">
      <Text className="text-sm">{label}</Text>
      <Text className={`text-2xl font-semibold tabular-nums ${TONE_INK[tone]}`}>{value}</Text>
      {hint ? <Text className="text-sm">{hint}</Text> : null}
    </div>
  );
}
