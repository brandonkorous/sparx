'use client';

// "Email this to me" — the one capture step on every free-tool page (docs/152 A3).
//
// WHY IT EXISTS
//
// Seventeen tools rank, get used, and produce nothing for the business. Someone
// who finishes the margin calculator has told us what they sell and what worries
// them, through an ACTION rather than a form, and then leaves. This asks for an
// address at the single moment it is worth giving one: after the thing they came
// for already exists on the screen.
//
// SO IT NEVER ASKS FIRST. The tool is not gated, nothing is held back, and the
// card only offers to send what the visitor can already see. A tool that made
// people pay before it worked would be a worse tool and a worse advert.
//
// WHAT IT SENDS
//
// Only what the tool COMPUTED, read from the result channel. Never a file the
// visitor supplied and never bytes derived from one — several of these pages
// promise the visitor's own file never leaves their browser, and that promise
// stays true because neither this card, the channel, nor the API can carry one.

import * as React from 'react';
import { useActionState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Text,
} from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@wizeworks/forms';
import { sendToolResult, type ToolDeliveryState } from '@/app/tools/actions';
import { Panel } from './ui-kit';
import { useToolResult } from './tool-result-context';

const INITIAL: ToolDeliveryState = { status: 'idle' };

export function ToolEmailCapture({ toolSlug, toolName }: { toolSlug: string; toolName: string }) {
  const result = useToolResult();
  const [state, action, pending] = useActionState(sendToolResult, INITIAL);
  const [email, setEmail] = React.useState('');

  const v = useFieldValidation(
    { email },
    { email: rules(rule.required('Enter your email.'), rule.email()) }
  );

  if (state.status === 'success') {
    return (
      <Panel title="On its way">
        <Text>
          We sent your {toolName.toLowerCase()} results to <strong>{state.email}</strong>. That is
          the only thing we will send unless you tell us otherwise.
        </Text>
      </Panel>
    );
  }

  // Two genuinely different empty states. "Nothing computed yet" is not the same
  // as "we could not send it", and one message for both would tell someone their
  // details failed when they have not entered any.
  const ready = result !== null && result.lines.length > 0;

  function clientAction(formData: FormData) {
    if (!v.validate()) return;
    action(formData);
  }

  return (
    <Panel title="Email this to yourself">
      <form action={clientAction} className="flex flex-col gap-4" noValidate>
        <Text>
          {ready
            ? 'Send your results so you still have them tomorrow. Nothing is saved on our side beyond the email.'
            : `Fill in the ${toolName.toLowerCase()} above and we will send you the results.`}
        </Text>

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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field {...v.field('email')} className="min-w-0 flex-1">
            <FieldLabel required className="text-sm font-medium">
              Your email
            </FieldLabel>
            <FieldControl
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!ready}
            />
            <FieldStatus />
          </Field>

          {/* The action this card exists for, so it is solid and it wears the
              module's hue — the same one the tool's own controls already use. */}
          <Button type="submit" color="module" size="lg" disabled={!ready || pending}>
            {pending ? 'Sending…' : 'Email it to me'}
          </Button>
        </div>

        {state.status === 'error' && state.message ? (
          <Text className="text-danger">{state.message}</Text>
        ) : null}
      </form>
    </Panel>
  );
}
