'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription, Button } from '@wizeworks/silicaui-react';
import type { BlueprintChoice } from '@/lib/furnish';
import { rankLooks } from '@/lib/looks';
import type { TradeOption } from '@/lib/trade-options';
import { completeOnboarding, type OnboardingState } from '@/app/onboarding/actions';
import { AuthShell } from './auth-shell';
import { RailPreview } from './rail-preview';
import { BusinessFields } from './onboarding/business-fields';
import { Choices } from './onboarding/choices';
import { LookPicker } from './onboarding/look-picker';
import { SHOWCASE_KEY, useOnboardingAnswers } from './onboarding/use-answers';

// Onboarding — two questions, a live preview of the answer, and the door in.
//
// This component is the FRAME. The answers live in `onboarding/use-answers.ts`,
// and each question block is its own file (RULE #0.5): `business-fields.tsx`,
// `choices.tsx`, and `look-picker.tsx` over `lib/looks.ts`.
//
// The panel beside this form is a LIVE preview of the rail these checkboxes
// build, so the answer and the picture of it share one piece of state. The page
// cannot hold it — it is a server component reading the tenant — so the client
// component that owns the answers renders the shell too.

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="primary" size="lg" block loading={pending}>
      {pending ? 'Setting things up' : 'Take me in'}
    </Button>
  );
}

export function Onboarding({
  suggestedName,
  blueprints,
  trades,
}: {
  suggestedName: string;
  blueprints: BlueprintChoice[];
  trades: TradeOption[];
}) {
  const [state, action] = useActionState<OnboardingState, FormData>(completeOnboarding, {
    error: null,
  });
  const a = useOnboardingAnswers(suggestedName, state);

  // Setup finished: leave for the console with a REAL navigation. The action
  // used to `redirect('/handoff')`, which made the client router fetch an RSC
  // payload for a route that 303s to another origin — a doomed request, and
  // `/handoff` hit twice. It mints a single-use token, so the second hit found
  // it spent and bounced a brand-new customer back to sign-in.
  useEffect(() => {
    if (state.done) window.location.assign(state.done);
  }, [state.done]);

  // The showcase first, then the templates that actually answer to this trade —
  // by what they are ABOUT, not by which vertical they were filed under. So
  // answering "what kind of business" visibly re-orders the shelf above it.
  const looks = useMemo(() => rankLooks(blueprints, a.trade, SHOWCASE_KEY), [blueprints, a.trade]);

  return (
    <AuthShell
      shape="setup"
      heading="A few quick things."
      lede="Then you are in. Nothing here is a commitment — we set it all up for you and you can change your mind once you are inside."
      panel={<RailPreview picked={a.picked} />}
    >
      <form action={action} className="flex flex-col gap-8">
        {state.error ? (
          <Alert color="danger" variant="soft">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Keyed on the attempt. React resets the form's DOM after every action
            and then writes back only what CHANGED, so a failed attempt leaves
            each field holding the reset's value instead of hers (issue 163). */}
        <BusinessFields
          key={`fields-${a.attempt}`}
          name={a.name}
          onName={a.setName}
          trade={a.trade}
          onTrade={a.setTrade}
          trades={trades}
        />
        <Choices key={`does-${a.attempt}`} picked={a.picked} onToggle={a.toggle} />
        <LookPicker
          key={`look-${a.attempt}`}
          looks={looks}
          selected={a.look}
          onSelect={a.setLook}
        />

        <Submit />
      </form>
    </AuthShell>
  );
}
