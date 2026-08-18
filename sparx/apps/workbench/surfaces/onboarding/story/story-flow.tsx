'use client';

import { type ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { storyFromPersisted } from '../../../lib/onboarding/story-state';
import { useBlueprints, useOnboarding } from '../../../lib/onboarding/api';
import { useTenant } from '../../../lib/api/shell-data';
import { StoryComposer } from './story-composer';
import { StoryTail } from './story-tail';

// The natural-language "story" onboarding — the PRIMARY front end, an alternative to
// the classic step wizard. The owner narrates their business in a sentence or two;
// each phrase switches on a module and the plan beside it fills in live.
//
// This root loads the blueprint catalog + saved state once (client-side react-query,
// the workbench idiom), then either starts the COMPOSE phase or resumes the TAIL
// (payments/launch) when a story is already committed — e.g. after a page reload
// mid-tail. The gate owns the surrounding chrome + the switch to the classic wizard;
// this owns only the story.
export function StoryFlow({
  onSwitchToClassic,
  onFinished,
}: {
  onSwitchToClassic: () => void;
  onFinished: () => void;
}): ReactNode {
  const onboarding = useOnboarding();
  const blueprintsQuery = useBlueprints();
  const tenant = useTenant();

  const loading = onboarding.isLoading || blueprintsQuery.isLoading || tenant.isLoading;
  const failed = onboarding.isError || blueprintsQuery.isError || tenant.isError;

  if (failed) {
    return (
      <Centered>
        <Heading level={2} className="text-xl font-semibold">
          We couldn’t load your setup
        </Heading>
        <Text className="max-w-md text-center">
          Something went wrong reaching your account. Check your connection and try again — nothing
          you’ve entered is lost.
        </Text>
        <Button
          color="module"
          onClick={() => {
            void onboarding.refetch();
            void blueprintsQuery.refetch();
            void tenant.refetch();
          }}
        >
          Try again
        </Button>
      </Centered>
    );
  }

  if (loading || !onboarding.data || !blueprintsQuery.data || !tenant.data) {
    return <LoadingSkeleton />;
  }

  const state = onboarding.data;
  const blueprints = blueprintsQuery.data;
  const initialName = tenant.data.slug ?? '';

  // Resume the tail when a story is already committed (e.g. a mid-tail reload). The
  // narrative is persisted, so we rebuild the editable state to repaint the plan.
  const inTail =
    !!state.story && (state.currentStep === 'payments' || state.currentStep === 'launch');
  if (inTail && state.story) {
    return (
      <StoryTail
        story={storyFromPersisted(state.story)}
        blueprints={blueprints}
        installId={state.installId ?? null}
        blueprintKey={state.blueprintKey ?? null}
        initialStage={state.currentStep === 'payments' ? 'payments' : 'launch'}
        stripeConnected={Boolean(state.completed?.payments)}
        onFinished={onFinished}
      />
    );
  }

  // A saved-but-not-yet-committed narrative → resume the COMPOSE phase with the owner's
  // story (they composed, then refreshed before building). Otherwise start fresh on
  // the curated examples.
  const draft = state.story ? storyFromPersisted(state.story) : null;

  return (
    <StoryComposer
      blueprints={blueprints}
      initialName={initialName}
      initialStory={draft}
      onSwitchToClassic={onSwitchToClassic}
      onFinished={onFinished}
    />
  );
}

function Centered({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4">{children}</div>
    </div>
  );
}

/** The two-column loading placeholder — mirrors the compose layout so the switch to
 *  real content doesn't shift the frame. The pulse blocks sit INSIDE base-100 cards
 *  (as the real panels do) so they stay visible against the recessed base-200 canvas. */
function LoadingSkeleton(): ReactNode {
  return (
    <div className="@container min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 @[48rem]:px-6 @[64rem]:gap-8 @[64rem]:py-10">
        {/* Full-width rail placeholder, matching the real step breadcrumb above the cards. */}
        <div className="bg-base-200 h-5 w-64 animate-pulse rounded" />
        <div className="grid gap-6 @[64rem]:grid-cols-[minmax(0,1fr)_22rem] @[64rem]:gap-8">
          <div className="bg-base-100 border-base-300 flex min-w-0 flex-col gap-6 rounded-xl border p-6 @[48rem]:p-8">
            <div className="bg-base-200 h-8 w-2/3 animate-pulse rounded-lg" />
            <div className="bg-base-200 h-4 w-full animate-pulse rounded" />
            <div className="bg-base-200 h-64 w-full animate-pulse rounded-xl" />
          </div>
          <div className="bg-base-100 border-base-300 rounded-xl border p-5">
            <div className="bg-base-200 h-72 w-full animate-pulse rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
