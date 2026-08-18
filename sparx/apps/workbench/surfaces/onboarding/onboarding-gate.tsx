'use client';

// The onboarding gate — the full-viewport takeover a tenant sees at first run,
// before the dock ever mounts.
//
// The workbench has no routes, so onboarding cannot be a page the way it is in the
// dashboard. Instead the shell asks this gate whether setup is done; while it is
// not, the gate owns the whole viewport and runs the flow the tenant is in. Once
// the flow stamps `finishedAt`, the onboarding query invalidates, the shell
// re-reads it, and the workbench proper takes over — no reload, no redirect.
//
// The gate decides which of the two interchangeable front ends to show (see
// ./onboarding-layout for the chrome, ../../lib/onboarding/entry for the rule) and
// owns the switch between them: flipping records the explicit choice so it sticks
// across visits, then swaps the flow in place.
//
// The whole thing is scoped to the Builder hue — the module every site starts on —
// so the primary actions and rail accents read as one identity; the story flow
// still tints each module in its live plan via nested scopes.
//
// The canvas is the workbench's recessed base-200 with the tiled spark watermark —
// the SAME surface the auth screen the tenant just came from uses — so signing up
// and setting up read as one continuous space. The header and each flow's panels are
// base-100 surfaces lifted onto it, separated by edge and color, never a shadow.

import { useState } from 'react';
import { ModuleScope } from '../../components/module-scope';
import { SparkField } from '../../components/spark-field';
import { StoryModelProvider } from '../../lib/onboarding/use-story-model';
import { useOnboarding, useOnboardingActions } from '../../lib/onboarding/api';
import { resolveOnboardingFlow, type OnboardingFlow } from '../../lib/onboarding/entry';
import { OnboardingHeader } from './onboarding-layout';
import { ClassicWizard } from './wizard/wizard';
import { StoryFlow } from './story/story-flow';

export function OnboardingGate({ onFinished }: { onFinished?: () => void }) {
  const { data: state } = useOnboarding();
  const actions = useOnboardingActions();
  // Seed the flow from the persisted state once; the switch drives it from there.
  const [flow, setFlow] = useState<OnboardingFlow>(() => resolveOnboardingFlow(state));

  function switchTo(next: OnboardingFlow): void {
    setFlow(next);
    // Best-effort: record the explicit choice so a reload resumes the same front
    // end. A failed write only means the default rule decides next time.
    void actions.switchFlow(next);
  }

  return (
    <ModuleScope
      module="builder"
      className="bg-base-200 relative flex h-dvh w-full flex-col overflow-hidden"
    >
      <SparkField />
      {/* The header + flow ride above the watermark; the opaque base-100 surfaces
          within them occlude it wherever they sit. The StoryModelProvider wraps BOTH
          editors so the ONE shared story survives switching between them in place. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <OnboardingHeader />
        <StoryModelProvider>
          {flow === 'story' ? (
            <StoryFlow
              onSwitchToClassic={() => {
                switchTo('classic');
              }}
              onFinished={() => onFinished?.()}
            />
          ) : (
            <ClassicWizard
              onSwitchToStory={() => {
                switchTo('story');
              }}
              onFinished={() => onFinished?.()}
            />
          )}
        </StoryModelProvider>
      </div>
    </ModuleScope>
  );
}
