'use client';

// "Send it to me" — the one place a tool page asks for anything (docs/152 A3).
//
// ── IT ASKS LAST, NEVER FIRST ───────────────────────────────────────────────
//
// Seventeen tools get found, get used, and produce nothing for the business.
// This asks for an address at the one moment it is worth giving one: after the
// thing somebody came for already exists on the screen. Nothing is gated — the
// tool works before this card and works if the card is ignored.
//
// That is also why `ToolShell`'s assurance no longer says "no email address".
// The offer made the flat claim untrue, and an untrue reassurance is worse than
// none; it now says the address is taken only if you ask.
//
// ── WHAT IT SENDS ───────────────────────────────────────────────────────────
//
// Only what the tool WORKED OUT, read from the result channel. Never a file
// somebody picked off their own machine and never bytes derived from one —
// neither this card, the channel, nor the API can carry one.

import * as React from 'react';
import { useActionState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { PigglesMascot } from '@piggles/mascot/react';
import { sendToolResult, type ToolDeliveryState } from '@/app/tools/actions';
import { Panel, TextField, Problem } from './ui-kit';
import { useToolResult } from './tool-result-context';

const INITIAL: ToolDeliveryState = { status: 'idle' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ToolEmailCapture({ toolSlug, toolName }: { toolSlug: string; toolName: string }) {
  const result = useToolResult();
  const [state, action, pending] = useActionState(sendToolResult, INITIAL);
  const [email, setEmail] = React.useState('');
  const [localError, setLocalError] = React.useState<string | null>(null);

  const lower = toolName.toLowerCase();

  if (state.status === 'success') {
    return (
      <Panel title="Sent">
        <div className="flex items-start gap-5">
          <PigglesMascot intent="success" size="sm" />
          <p className="text-base">
            Your {lower} is on its way to <strong>{state.email}</strong>. That is the only thing we
            will send you unless you tell us otherwise.
          </p>
        </div>
      </Panel>
    );
  }

  // Two genuinely different quiet states. "Nothing worked out yet" is not the
  // same as "we could not send it", and one message for both would tell somebody
  // their details failed when they have not entered any.
  const ready = result !== null && result.lines.length > 0;

  function clientAction(formData: FormData) {
    if (!EMAIL_RE.test(email.trim())) {
      setLocalError('That does not look like an email address. Have a look?');
      return;
    }
    setLocalError(null);
    action(formData);
  }

  const problem = localError ?? (state.status === 'error' ? state.message : null);

  return (
    <Panel
      title="Send it to yourself"
      description={
        ready
          ? 'So you still have it tomorrow. We keep nothing on our side beyond the email itself.'
          : `Fill in the ${lower} above and we will send you what it makes.`
      }
    >
      <form action={clientAction} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="toolSlug" value={toolSlug} />
        <input type="hidden" name="lines" value={JSON.stringify(result?.lines ?? [])} />
        {result?.note ? <input type="hidden" name="note" value={result.note} /> : null}
        {/* Honeypot — hidden from people, irresistible to bots. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <TextField
              label="Your email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              maxLength={255}
              value={email}
              onChange={setEmail}
              disabled={!ready}
            />
          </div>

          {/* The thing this card exists for, so it is solid and it wears the
              page's own app color — the same one every control above it uses. */}
          <Button type="submit" color="module" size="lg" disabled={!ready || pending}>
            {pending ? 'Sending…' : 'Send it'}
          </Button>
        </div>

        {problem ? <Problem>{problem}</Problem> : null}
      </form>
    </Panel>
  );
}
