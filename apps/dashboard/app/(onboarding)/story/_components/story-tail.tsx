'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Heading, SurfaceFrame, Text, type SurfaceStepDef } from '@sparx/ui';
import { MODULE_BY_KEY } from '@/lib/modules';
import { SummaryCard } from '../../onboarding/_components/summary-card';
import { RailFooter } from '../../onboarding/_components/rail-footer';
import { StepPayments } from '../../onboarding/_components/step-payments';
import { StepLaunch } from '../../onboarding/_components/step-launch';
import type { OnboardingModule } from '../../onboarding/_lib/modules';
import type { WizardBlueprint } from '../../onboarding/_lib/types';
import {
  enabledModuleKeys,
  handleSlug,
  resolveModules,
  type StoryState,
} from '../_lib/story-state';
import {
  completePaymentsAction,
  finishOnboardingAction,
  publishAndFinishAction,
  startStripeConnectStoryAction,
} from '../_lib/actions';
import { storyPlanItems, storyTotals, StoryExtras } from './story-summary';

const SELLING = ['commerce', 'b2b', 'dropship'];

type TailStage = 'payments' | 'launch';

const STEP_PAYMENTS: SurfaceStepDef = {
  key: 'payments',
  label: 'Get paid',
  sublabel: 'Connect Stripe',
};
const STEP_LAUNCH: SurfaceStepDef = { key: 'launch', label: 'Go live', sublabel: 'Publish' };
const STEP_STORY_DONE: SurfaceStepDef = { key: 'story', label: 'Your story', sublabel: 'Composed' };

// A failed Stripe Connect round-trip comes back as `?stripe_error=<code>` (the OAuth
// callback can't render its own UI). Humanize the few known codes; everything else gets
// a calm, recoverable message — connecting is always skippable.
function stripeErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === 'access_denied')
    return 'Stripe connection was cancelled. Try again, or skip for now.';
  if (code === 'missing_params')
    return 'Stripe sign-in didn’t complete. Please try connecting again.';
  return 'Couldn’t connect Stripe. Try again, or skip for now.';
}

const LEDE: Record<TailStage, { title: string; blurb: string; context: string }> = {
  payments: {
    title: 'Get paid.',
    blurb: 'Connect Stripe to accept customer payments.',
    context:
      'This connects the account that RECEIVES money from your customers — separate from your sparx subscription. Skippable.',
  },
  launch: {
    title: 'Ready to launch.',
    blurb: "Your site is built. One tap and it's live.",
    context:
      'Publishing makes your draft live at your address. Keep editing in the Builder afterward — anytime.',
  },
};

// The standalone tail of the story onboarding: once the story is committed, the
// SAME page continues IN-PAGE through the reused Payments + Launch steps — it never
// bounces to the classic wizard. It rebuilds the plan from the committed story so the
// summary rail + savings stay consistent, and drives the proven onboarding actions.
// The page renders this directly when resuming after the Stripe OAuth reload; the
// composer renders it in place the instant a story is built.
export function StoryTail({
  story,
  blueprints,
  installId,
  blueprintKey,
  initialStage,
  stripeConnected: initialStripe,
  stripeError,
  siteOrigin,
  useTenantParam,
}: {
  story: StoryState;
  blueprints: WizardBlueprint[];
  installId: string | null;
  blueprintKey: string | null;
  initialStage: TailStage;
  stripeConnected: boolean;
  /** A failed Stripe Connect round-trip's `?stripe_error` code, surfaced on resume. */
  stripeError?: string | null;
  siteOrigin: string;
  useTenantParam: boolean;
}): ReactNode {
  const router = useRouter();
  const on = resolveModules(story);
  const selling = SELLING.some((k) => on[k]);
  const [stage, setStage] = useState<TailStage>(selling ? initialStage : 'launch');
  // Stripe-connected is fixed per page load — it only flips via the OAuth round-trip,
  // which reloads the page and re-reads this prop.
  const stripeConnected = initialStripe;
  const [published, setPublished] = useState(false);
  // Seed the error from a failed Stripe round-trip (we land here at the payments stage);
  // it clears the moment the owner retries or skips.
  const [error, setError] = useState<string | null>(stripeErrorMessage(stripeError));
  const [pending, startTransition] = useTransition();

  const { total, elsewhere } = storyTotals(story);
  const activeModules: OnboardingModule[] = enabledModuleKeys(story).flatMap((k) => {
    const m = MODULE_BY_KEY[k];
    return m ? [m] : [];
  });
  const slug = handleSlug(story.name);

  const steps: SurfaceStepDef[] = selling
    ? [STEP_STORY_DONE, STEP_PAYMENTS, STEP_LAUNCH]
    : [STEP_STORY_DONE, STEP_LAUNCH];
  const current = steps.findIndex((s) => s.key === stage);

  // ── stage transitions (the reused onboarding actions) ──────────────────────────
  const toLaunch = (): void => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await completePaymentsAction({
        paymentsConnected: stripeConnected,
        next: 'launch',
      });
      if (res.ok) setStage('launch');
      else setError(res.error);
    });
  };

  const onLaunch = (): void => {
    if (pending) return;
    if (published) {
      router.push('/');
      return;
    }
    setError(null);
    startTransition(async () => {
      if (installId) {
        const res = await publishAndFinishAction(installId);
        if (res.ok) setPublished(true);
        else setError(res.error);
      } else {
        const res = await finishOnboardingAction();
        if (res.ok) router.push('/builder/studio');
        else setError(res.error);
      }
    });
  };

  // ── per-stage CTA + body ────────────────────────────────────────────────────────
  const cta =
    stage === 'payments'
      ? {
          label: stripeConnected ? 'Continue' : 'Skip for now',
          onClick: toLaunch,
          loading: pending,
        }
      : {
          label: published ? 'Go to dashboard' : installId ? 'Publish my site' : 'Finish setup',
          onClick: onLaunch,
          loading: pending,
        };

  const onBack =
    stage === 'launch' && selling && !published ? () => setStage('payments') : undefined;

  const body =
    stage === 'payments' ? (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <Heading level={2}>Get paid</Heading>
          <Text variant="muted" className="max-w-[58ch]">
            Connect your Stripe account so your site can take customer payments. Your site can go
            live now — checkout just stays off until you connect.
          </Text>
        </div>
        <StepPayments
          stripeConnected={stripeConnected}
          connectAction={startStripeConnectStoryAction}
        />
      </div>
    ) : (
      <StepLaunch
        slug={slug}
        installId={installId}
        blueprint={blueprints.find((b) => b.key === blueprintKey) ?? null}
        siteOrigin={siteOrigin}
        useTenantParam={useTenantParam}
        published={published}
        modules={activeModules}
        monthlyTotal={total}
        monthlyElsewhere={elsewhere}
        pendingDomain={null}
      />
    );

  return (
    <SurfaceFrame
      variant="page"
      lede={{ title: LEDE[stage].title, blurb: LEDE[stage].blurb }}
      context={LEDE[stage].context}
      steps={steps}
      current={Math.max(0, current)}
      footer={<RailFooter />}
    >
      <div className="mx-auto w-full max-w-[1120px] px-12 py-12 max-[940px]:px-5 max-[940px]:py-8">
        <div className="grid grid-cols-[1fr_340px] items-start gap-8 max-[1040px]:grid-cols-1">
          <div className="min-w-0">{body}</div>
          <SummaryCard
            plan={{ total, elsewhere, items: storyPlanItems(story) }}
            entries={[]}
            cta={cta}
            onBack={onBack}
            error={error}
            extras={<StoryExtras story={story} blueprints={blueprints} />}
            collapsibleModules
          />
        </div>
      </div>
    </SurfaceFrame>
  );
}
