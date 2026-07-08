'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { Button, Label, Textarea } from 'silicaui-react';
import type { PartnerTier } from '@sparx/partner-schemas';

import { TIERS } from '../../_lib/tiers';
import { applyTierAction } from '../actions';

// The "Apply for next tier" control (docs/114 §B.2). An optional note (why you're
// ready) + a submit that queues a staff-review application. On success it refreshes
// so the page reflects the pending state. `requestedTier` is always the tier above
// the partner's current one (never informal, which the server rejects anyway).

export function TierApply({ requestedTier }: { requestedTier: PartnerTier }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const target = TIERS[requestedTier];

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await applyTierAction({ requestedTier, note: note.trim() || null });
      if (!result.ok) {
        setError(result.error ?? 'Could not submit your request.');
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <p className="text-success text-sm" role="status" aria-live="polite">
        Request submitted. We’ll review your {target.label} application within 3 business days.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="tier-note">Why you’re ready (optional)</Label>
        <Textarea
          id="tier-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={`Tell us about the client launches or experience that qualify you for ${target.label}.`}
        />
      </div>
      {error && (
        <p className="text-danger text-sm" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <div>
        <Button
          type="button"
          color="module"
          onClick={submit}
          loading={pending}
          disabled={pending}
          iconEnd={<ArrowUpRight className="h-4 w-4" />}
        >
          Apply for {target.label}
        </Button>
      </div>
    </div>
  );
}
