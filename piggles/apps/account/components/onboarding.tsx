'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription, Button } from '@wizeworks/silicaui-react';
import type { BlueprintChoice } from '@/lib/furnish';
import { rankLooks } from '@/lib/looks';
import { clearOnboardingDraft } from '@/lib/onboarding-draft';
import type { TradeOption } from '@/lib/trade-options';
import { completeOnboarding, type OnboardingState } from '@/app/onboarding/actions';
import { AuthShell } from './auth-shell';
import { RailPreview } from './rail-preview';
import { BusinessFields } from './onboarding/business-fields';
import { Choices } from './onboarding/choices';
import { HeardAboutField } from './onboarding/heard-about';
import { LookPicker } from './onboarding/look-picker';
import { SHOWCASE_KEY, useOnboardingAnswers, type Answers } from './onboarding/use-answers';

// Onboarding: a few questions, a live preview of the rail they build, the door in.
// This is the FRAME; the answers live in `onboarding/use-answers.ts`.

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="primary" size="lg" block loading={pending}>
      {pending ? 'Setting things up' : 'Take me in'}
    </Button>
  );
}

/** The questions. Keyed on the attempt, so a failed attempt keeps her answers (issue 163). */
function Questions({
  a,
  state,
  looks,
  trades,
}: {
  a: Answers;
  state: OnboardingState;
  looks: BlueprintChoice[];
  trades: TradeOption[];
}) {
  return (
    <>
      <BusinessFields
        key={`fields-${a.attempt}`}
        name={a.name}
        onName={a.setName}
        address={a.address}
        onAddress={a.setAddress}
        addressError={state.field === 'webAddress' ? state.error : null}
        trade={a.trade}
        onTrade={a.setTrade}
        trades={trades}
      />
      <Choices key={`does-${a.attempt}`} picked={a.picked} onToggle={a.toggle} />
      <LookPicker key={`look-${a.attempt}`} looks={looks} selected={a.look} onSelect={a.setLook} />
      <HeardAboutField key={`heard-${a.attempt}`} value={a.heard} onChange={a.setHeard} />
    </>
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

  // A REAL navigation: `/handoff` 303s cross-origin with a single-use token, and a
  // router fetch would hit it twice and spend it. The draft has done its job.
  useEffect(() => {
    if (!state.done) return;
    clearOnboardingDraft();
    window.location.assign(state.done);
  }, [state.done]);

  // The showcase first, then the templates that answer to this trade by what they
  // are ABOUT, so picking a trade visibly re-orders the shelf.
  const looks = useMemo(() => rankLooks(blueprints, a.trade, SHOWCASE_KEY), [blueprints, a.trade]);

  return (
    <AuthShell
      shape="setup"
      heading="A few quick things."
      lede="Then you are in. Nothing here is a commitment. We set it all up for you and you can change your mind once you are inside."
      panel={<RailPreview picked={a.picked} />}
    >
      <form action={action} className="flex flex-col gap-8">
        {/* A field's own error shows on that field only: two copies read as two problems. */}
        {state.error && !state.field ? (
          <Alert color="danger" variant="soft">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Questions a={a} state={state} looks={looks} trades={trades} />
        <Submit />
      </form>
    </AuthShell>
  );
}
