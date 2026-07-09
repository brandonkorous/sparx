'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardBody, Checkbox, Label } from '@wizeworks/silicaui-react';

import { clearRecallAction, initiateRecallAction } from '../../../_lib/lot-actions';

// Recall lifecycle for a lot (docs/100 P4d). When there's no open recall, "Recall
// lot" opens an inline reason + notify panel (initiating a recall flips the lot's
// unsold serials and surfaces who to notify). When a recall is open, "Clear recall"
// closes it — both change traceability state, so they confirm before applying.

export function LotActionsBar({ id, recallStatus }: { id: string; recallStatus: string | null }) {
  const router = useRouter();
  const [busy, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [recalling, setRecalling] = React.useState(false);
  const [armedClear, setArmedClear] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [notify, setNotify] = React.useState(true);

  const open = recallStatus === 'active' || recallStatus === 'pending';

  function recall() {
    if (reason.trim().length === 0) {
      setError('Enter a recall reason.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await initiateRecallAction(id, reason.trim(), notify);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setRecalling(false);
      setReason('');
      router.refresh();
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      const result = await clearRecallAction(id);
      if (!result.ok) {
        setError(result.error.message);
        setArmedClear(false);
        return;
      }
      setArmedClear(false);
      router.refresh();
    });
  }

  if (open) {
    return (
      <div className="flex flex-col items-end gap-2">
        {armedClear ? (
          <div className="flex flex-row items-center gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setArmedClear(false)}>
              Keep
            </Button>
            <Button color="warning" size="sm" disabled={busy} onClick={clear}>
              {busy ? 'Clearing…' : 'Confirm clear'}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setArmedClear(true)}>
            Clear recall
          </Button>
        )}
        {error && <p className="text-danger text-xs">{error}</p>}
      </div>
    );
  }

  if (!recalling) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Button color="danger" size="sm" onClick={() => setRecalling(true)}>
          Recall lot
        </Button>
        {error && <p className="text-danger text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardBody>
        <div className="flex flex-col gap-3">
          <h4 className="text-lg font-semibold">Recall this lot</h4>
          <div className="flex flex-col gap-1">
            <Label htmlFor="recall-reason">Reason</Label>
            <textarea
              id="recall-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border-base-300 bg-base-100 rounded border px-3 py-2 text-sm"
              placeholder="What's wrong with this batch?"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              color="module"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
            />
            Flag affected customers to notify
          </label>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex flex-row justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRecalling(false)}>
              Cancel
            </Button>
            <Button color="danger" size="sm" disabled={busy} onClick={recall}>
              {busy ? 'Recalling…' : 'Recall lot'}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
