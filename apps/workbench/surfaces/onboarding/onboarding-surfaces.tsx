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

import { ModuleScope } from '../../components/module-scope';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { ClassicWizard } from './wizard/wizard';
import { StoryFlow } from './story/story-flow';

export function OnboardingWizardSurface({ ctx }: { ctx: SurfaceContext }) {
  return (
    <ModuleScope module="builder" className="flex h-full w-full flex-col overflow-hidden">
      <ClassicWizard
        onSwitchToStory={() => {
          ctx.open('workbench.onboarding.story');
          ctx.close();
        }}
        onFinished={() => {
          ctx.close();
        }}
      />
    </ModuleScope>
  );
}

export function OnboardingStorySurface({ ctx }: { ctx: SurfaceContext }) {
  return (
    <ModuleScope module="builder" className="flex h-full w-full flex-col overflow-hidden">
      <StoryFlow
        onSwitchToClassic={() => {
          ctx.open('workbench.onboarding');
          ctx.close();
        }}
        onFinished={() => {
          ctx.close();
        }}
      />
    </ModuleScope>
  );
}
