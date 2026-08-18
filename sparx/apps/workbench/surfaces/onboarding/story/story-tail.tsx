'use client';

import { useState, type ReactNode } from 'react';
import type { StoryState } from '@wizeworks/story-schemas';
import { useOnboardingActions } from '../../../lib/onboarding/api';
import { isSellingSelected } from '../../../lib/onboarding/modules';
import type { WizardBlueprint } from '../../../lib/onboarding/types';
import { SummaryCard } from '../../../lib/onboarding/summary-card';
import { enabledModuleKeys, resolveModules } from '../../../lib/onboarding/story-state';
import { OnboardingLayout, type StepMark } from '../onboarding-layout';
import { StoryGetPaid } from './story-get-paid';
import { StoryGoLive } from './story-go-live';
import { StoryExtras, storyPlanItems, storyTotals } from './story-summary';

// The story onboarding's TAIL. Once the story is committed, the SAME page continues
// IN-PAGE through the "get paid" and "go live" chapters — it never bounces to the
// classic wizard. It rebuilds the plan from the committed story so the summary + savings
// stay consistent, and drives the shared onboarding actions.
//
// Unlike the composer it offers NO switch to the wizard: the setup is already committed.
// And unlike the wizard's own Payments/Launch steps, these chapters are told in the
// STORY's voice + surface (StoryGetPaid / StoryGoLive) — the payment connect and the
// publish are the same actions, but framed as the next lines of the owner's story, not
// a pair of imported setup cards. The tail is just the orchestration around them.

type TailStage = 'payments' | 'launch';

export function StoryTail({
  story,
  blueprints,
  installId,
  blueprintKey,
  initialStage,
  stripeConnected: initialStripe,
  onFinished,
}: {
  story: StoryState;
  blueprints: WizardBlueprint[];
  installId: string | null;
  blueprintKey: string | null;
  initialStage: TailStage;
  stripeConnected: boolean;
  onFinished: () => void;
}): ReactNode {
  const actions = useOnboardingActions();
  const on = resolveModules(story);
  const selling = isSellingSelected(on);

  const [stage, setStage] = useState<TailStage>(selling ? initialStage : 'launch');
  const [stripeConnected, setStripeConnected] = useState(initialStripe);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { total, elsewhere, savings } = storyTotals(story);
  const moduleCount = enabledModuleKeys(story).length;
  const blueprint = blueprints.find((b) => b.key === blueprintKey) ?? null;

  const steps: StepMark[] = [
    { key: 'story', label: 'Your story', status: 'done' },
    ...(selling
      ? [
          {
            key: 'payments',
            label: 'Getting paid',
            status: (stage === 'payments' ? 'current' : 'done') as StepMark['status'],
          },
        ]
      : []),
    { key: 'launch', label: 'Going live', status: stage === 'launch' ? 'current' : 'upcoming' },
  ];

  // ── stage transitions (the reused onboarding actions) ───────────────────────────
  const toLaunch = (): void => {
    if (pending) return;
    setError(null);
    setPending(true);
    void actions
      .completePayments({ paymentsConnected: stripeConnected, next: 'launch' })
      .then(() => {
        setStage('launch');
        setPending(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setPending(false);
      });
  };

  const onLaunch = (): void => {
    if (pending) return;
    setError(null);
    setPending(true);
    const run = installId ? actions.publishAndFinish(installId) : actions.finishOnboarding();
    void run
      .then(() => {
        setPending(false);
        if (installId) setPublished(true);
        else onFinished();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setPending(false);
      });
  };

  const primary =
    stage === 'payments'
      ? {
          label: stripeConnected ? 'Continue' : 'Skip for now',
          onClick: toLaunch,
          loading: pending,
        }
      : published
        ? { label: 'Go to workspace', onClick: onFinished }
        : {
            label: installId ? 'Publish my site' : 'Finish setup',
            onClick: onLaunch,
            loading: pending,
          };

  const back =
    stage === 'launch' && selling && !published
      ? { onClick: () => setStage('payments'), disabled: pending }
      : undefined;

  const work =
    stage === 'payments' ? (
      <StoryGetPaid
        story={story}
        connected={stripeConnected}
        actions={actions}
        onConnected={() => setStripeConnected(true)}
      />
    ) : (
      <StoryGoLive
        story={story}
        installId={installId}
        blueprint={blueprint}
        builderEnabled={Boolean(on.builder)}
        published={published}
        moduleCount={moduleCount}
        monthlyTotal={total}
        monthlyElsewhere={elsewhere}
        actions={actions}
      />
    );

  return (
    <OnboardingLayout
      steps={steps}
      work={work}
      summary={
        <SummaryCard
          plan={{ items: storyPlanItems(story), total, elsewhere, savings }}
          primary={primary}
          back={back}
          error={error}
          extras={<StoryExtras story={story} blueprints={blueprints} />}
        />
      }
    />
  );
}
