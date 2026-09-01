'use client';

// The onboarding flows as REOPENABLE surfaces.
//
// The gate runs onboarding at first run in the full viewport. But an operator may
// want to come back to setup — resume a story they were composing, revisit the
// wizard, redo a step — long after the gate is gone. These wrappers register each
// flow as a normal surface so ⌘K and a deep link can reopen it into a pane. Same
// flow component, same foundation; only the chrome differs (a pane has its own
// toolbar, so there is no gate header here) and "finish"/"switch" close or swap the
// pane instead of falling through to the shell.
//
// Scoped to the Builder hue like the gate, so a reopened flow reads identically to
// the first run.
//
// AND EACH ONE IS GUARDED. In this console there IS no first-run gate, so these
// surfaces are the only way either flow is ever reached — which means every
// person who opens one already has an account, and most already have a business.
// Setup writes over a business rather than reading it, so `<SetupGate>` decides
// whether it is being pointed at one that exists. See setup-gate.tsx.
//
// AND EACH ONE CARRIES THE STORY MODEL, which is the thing the gate used to own.
// Both flows read `useStoryModel()`, and that hook THROWS when no provider is above
// it — so with the gate gone and nothing else mounting one, every open of either
// surface crashed the pane outright (persona issue 361). A provider per surface,
// rather than one in the shell: a switch between the two closes one pane and opens
// the other, which is a mount boundary whatever we do, and the story that has to
// survive it is already persisted server-side — both flows seed from
// `useOnboarding().story`.

import { ModuleScope } from '../../components/module-scope';
import { StoryModelProvider } from '../../lib/onboarding/use-story-model';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { ClassicWizard } from './wizard/wizard';
import { SetupGate } from './setup-gate';
import { StoryFlow } from './story/story-flow';

export function OnboardingWizardSurface({ ctx }: { ctx: SurfaceContext }) {
  return (
    <ModuleScope module="builder" className="flex h-full w-full flex-col overflow-hidden">
      <StoryModelProvider>
        <SetupGate ctx={ctx}>
          <ClassicWizard
            onSwitchToStory={() => {
              ctx.open('workbench.onboarding.story');
              ctx.close();
            }}
            onFinished={() => {
              ctx.close();
            }}
          />
        </SetupGate>
      </StoryModelProvider>
    </ModuleScope>
  );
}

export function OnboardingStorySurface({ ctx }: { ctx: SurfaceContext }) {
  return (
    <ModuleScope module="builder" className="flex h-full w-full flex-col overflow-hidden">
      <StoryModelProvider>
        <SetupGate ctx={ctx}>
          <StoryFlow
            onSwitchToClassic={() => {
              ctx.open('workbench.onboarding');
              ctx.close();
            }}
            onFinished={() => {
              ctx.close();
            }}
          />
        </SetupGate>
      </StoryModelProvider>
    </ModuleScope>
  );
}
