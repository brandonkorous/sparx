'use client';

// 30-minute revert banner (docs/69 B-3). Shows on the products list while a
// bulk price adjustment is still inside its undo window, with a live countdown
// and an Undo button. On success the route revalidates (server re-fetches the
// now-empty reversible list) and we hide optimistically in the meantime.

import * as React from 'react';
import { Clock, Undo2 } from 'lucide-react';
import { Button, Card, CardBody, Loading } from '@wizeworks/silicaui-react';

import { revertBulkPriceAction } from '../../product-actions';
import type { ReversibleOp } from '../_lib/bulk-price-types';

export function BulkPriceRevertBanner({ op }: { op: ReversibleOp }) {
  const expiresMs = new Date(op.expiresAt).getTime();
  // `remaining` stays null until after mount. Computing `Date.now()` during
  // render diverges between the server (SSR clock) and the client (hydration a
  // few seconds later), which trips React's hydration check — so the live
  // countdown is filled in by the post-mount tick, with a stable "—"
  // placeholder rendered identically on the server and the first client paint.
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresMs - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresMs]);

  if (done || remaining === 0) return null;

  const countdown =
    remaining === null
      ? '—'
      : `${Math.floor(remaining / 60000)}:${Math.floor((remaining % 60000) / 1000)
          .toString()
          .padStart(2, '0')}`;

  async function undo() {
    setBusy(true);
    setError(null);
    const res = await revertBulkPriceAction(op.operationId);
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    setDone(true); // optimistic — the route revalidation will confirm
  }

  return (
    <Card className="bg-module bg-soft">
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-row items-center gap-2">
            <Clock className="text-module h-4 w-4 shrink-0" />
            <p className="min-w-0 text-sm">
              <span className="font-medium">{op.label}</span> — {op.productCount} product
              {op.productCount === 1 ? '' : 's'}, {op.variantCount} variant
              {op.variantCount === 1 ? '' : 's'}.{' '}
              <span className="text-base-content tabular-nums">Undo available for {countdown}</span>
              {error ? <span className="text-danger"> · {error}</span> : null}
            </p>
          </div>
          <Button
            size="sm"
            color="module"
            variant="soft"
            disabled={busy}
            iconStart={busy ? <Loading className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
            onClick={() => void undo()}
          >
            Undo
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
