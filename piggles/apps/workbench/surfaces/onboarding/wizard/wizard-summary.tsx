'use client';

// The persistent right-hand column: the step rail, the heading, and the summary
// card that holds the ONE primary CTA every step commits through.

import { Button, Text } from '@wizeworks/silicaui-react';
import type { StoryState } from '@wizeworks/story-schemas';
import type { StepMark } from '../onboarding-layout';
import { SummaryCard } from '../../../lib/onboarding/summary-card';
import { StoryExtras, storyPlanItems } from '../story/story-summary';
import { ALT_SWITCH_STEPS, HEAD, STEP_LABEL } from './wizard-steps';
import type { OnboardingStepKey, WizardBlueprint } from '../../../lib/onboarding/types';

export function stepMarks(order: OnboardingStepKey[], idx: number): StepMark[] {
  return order.map((key, i) => ({
    key,
    label: STEP_LABEL[key],
    status: i < idx ? 'done' : i === idx ? 'current' : 'upcoming',
  }));
}

export function WizardHeading({ step }: { step: OnboardingStepKey }) {
  const head = HEAD[step];
  if (!head) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">{head.title}</h2>
      <Text className="max-w-prose">{head.supporting}</Text>
    </div>
  );
}

export interface WizardSummaryProps {
  step: OnboardingStepKey;
  story: StoryState;
  blueprints: WizardBlueprint[];
  /** The starting point the receipt shows: a blueprint, null for a blank site,
   *  or undefined to let the story's own match choose. */
  startingPoint: WizardBlueprint | null | undefined;
  ctaLabel: string;
  canContinue: boolean;
  busy: boolean;
  showBack: boolean;
  error: string | null;
  onContinue: () => void;
  onBack: () => void;
  onSwitchToStory: () => void;
}

export function WizardSummary(props: WizardSummaryProps) {
  return (
    <SummaryCard
      plan={{ items: storyPlanItems(props.story) }}
      primary={{
        label: props.ctaLabel,
        onClick: props.onContinue,
        disabled: !props.canContinue || props.busy,
        loading: props.busy,
      }}
      back={props.showBack ? { onClick: props.onBack, disabled: props.busy } : undefined}
      extras={
        <StoryExtras
          story={props.story}
          blueprints={props.blueprints}
          blueprintOverride={props.startingPoint}
        />
      }
      altAction={
        ALT_SWITCH_STEPS.includes(props.step) ? (
          <Button variant="link" color="module" size="sm" onClick={props.onSwitchToStory}>
            Prefer to describe it in a sentence?
          </Button>
        ) : undefined
      }
      error={props.error}
    />
  );
}
