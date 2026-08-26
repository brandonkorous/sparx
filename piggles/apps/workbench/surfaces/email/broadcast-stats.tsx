'use client';

// How a broadcast did, once it has gone out.
//
// The honest part of this file is the Delivered tile. A delivery is CONFIRMED by
// the mail provider minutes to hours after a send, so "delivered: 0" a minute
// after pressing Send does not mean nobody got it — it means nothing has been
// confirmed yet. Rendering that raw told an owner her whole newsletter had
// failed, so the tile says which of the two it is, in words AND in color.

import { Text } from '@wizeworks/silicaui-react';
import type { BroadcastStats } from './broadcasts-data';

/** `plain` is the colorless case, for a number that carries no verdict. */
type Tone = 'plain' | 'info' | 'success' | 'warning' | 'error';

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

/** The Delivered tile's number, sentence and color. Three states, because
 *  "handed over, not yet confirmed" is neither "delivered" nor "failed". */
function deliveredTile(stats: BroadcastStats): { value: number; hint: string; tone: Tone } {
  if (stats.delivered > 0) {
    return {
      value: stats.delivered,
      hint: 'Confirmed by the receiving mail server',
      tone: 'success',
    };
  }
  if (stats.accepted > 0) {
    return {
      value: stats.accepted,
      hint: 'On their way. Confirmations arrive over the next few minutes.',
      tone: 'info',
    };
  }
  return { value: 0, hint: 'Nothing has gone out yet', tone: 'plain' };
}

/** Good news only once there is some. A zero in success green says the opposite
 *  of the sentence under it. */
function achievedTone(count: number): Tone {
  return count > 0 ? 'success' : 'plain';
}

export function StatsGrid({ stats, recipients }: { stats: BroadcastStats; recipients: number }) {
  // Opens and clicks are shares of what actually landed; the rest are counts on
  // their own. Fall back through delivered → accepted → recipients so an early
  // send with sparse events still reads sensibly.
  const base = stats.delivered || stats.accepted || recipients || 0;
  const pct = (part: number) => (base > 0 ? `${String(Math.round((part / base) * 100))}%` : '—');
  const delivered = deliveredTile(stats);
  // "of delivered" is a lie while nothing is confirmed — the share is of what
  // actually went out.
  const shareOf = stats.delivered > 0 ? 'of delivered' : 'of those sent';

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
