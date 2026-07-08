'use client';

// Finishes the OAuth round-trip (docs/79 §8.3): posts the provider `code` + signed
// `state` back through the authed Server Action, which exchanges tokens and runs the
// first sync. Pure status UI — a spinner while it completes, then connected / declined
// / failed, each with a way back to scheduling.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card } from 'silicaui-react';
import { CalendarCheck2, CircleAlert, Loader2 } from 'lucide-react';

import { completeCalendarOAuthAction } from '../../../_lib/actions';

type Phase =
  | { kind: 'working' }
  | { kind: 'declined'; reason: string }
  | { kind: 'connected'; provider: string }
  | { kind: 'failed'; reason: string };

export function CalendarConnectedClient({
  code,
  state,
  error,
}: {
  code: string | null;
  state: string | null;
  error: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    error
      ? { kind: 'declined', reason: error }
      : code && state
        ? { kind: 'working' }
        : { kind: 'failed', reason: 'This connect link is missing its authorization code.' }
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || phase.kind !== 'working' || !code || !state) return;
    ran.current = true;
    void completeCalendarOAuthAction({ code, state }).then((r) => {
      if (!r.ok) {
        setPhase({ kind: 'failed', reason: r.error });
      } else if (r.data.sync && !r.data.sync.ok) {
        setPhase({
          kind: 'failed',
          reason: r.data.sync.error ?? 'Connected, but the first sync failed.',
        });
      } else {
        setPhase({ kind: 'connected', provider: r.data.provider });
      }
    });
  }, [code, state, phase.kind]);

  return (
    <Card className="w-full max-w-md">
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        {phase.kind === 'working' ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[var(--module-scheduling)]" />
            <div>
              <p className="text-base font-semibold">Finishing the connection…</p>
              <p className="text-base-content/70 text-sm">
                Exchanging tokens and importing your calendar.
              </p>
            </div>
          </>
        ) : phase.kind === 'connected' ? (
          <>
            <CalendarCheck2 className="h-8 w-8 text-[var(--color-success)]" />
            <div>
              <p className="text-base font-semibold">Calendar connected</p>
              <p className="text-base-content/70 text-sm">
                Your {phase.provider === 'google' ? 'Google' : 'Microsoft'} calendar is syncing.
                Outside events now block this resource&rsquo;s availability.
              </p>
            </div>
            <Link href="/scheduling/resources">
              <Button color="module">Back to scheduling</Button>
            </Link>
          </>
        ) : (
          <>
            <CircleAlert className="h-8 w-8 text-[var(--color-danger)]" />
            <div>
              <p className="text-base font-semibold">
                {phase.kind === 'declined' ? 'Connection cancelled' : 'Could not connect'}
              </p>
              <p className="text-base-content/70 text-sm">{phase.reason}</p>
            </div>
            <Link href="/scheduling/resources">
              <Button variant="outline">Back to scheduling</Button>
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}
