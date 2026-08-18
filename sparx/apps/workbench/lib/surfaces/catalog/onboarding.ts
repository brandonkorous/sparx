// Onboarding — the setup flows and the welcome checklist as reopenable surfaces.
//
// At FIRST RUN onboarding is a full-viewport gate (components/workbench-shell +
// surfaces/onboarding/onboarding-gate), not one of these. These entries are the
// SECOND home the flows have: once setup is done, an operator can still reopen the
// welcome checklist, resume the story, or step back through the wizard from ⌘K or
// the nav — so setup is never a one-way door.
//
// Keys are persisted in saved layouts and deep links, so they are stable forever.

import { ListChecks, PenLine, Rocket } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { WelcomeSurface } from '../../../surfaces/onboarding/welcome/welcome-checklist';
import {
  OnboardingStorySurface,
  OnboardingWizardSurface,
} from '../../../surfaces/onboarding/onboarding-surfaces';

export const ONBOARDING_SURFACES: SurfaceDefinition[] = [
  {
    // Sectionless landing, like "Start here": the whole-account "what's next",
    // not one of the settings groups.
    key: 'workbench.welcome',
    title: 'Get set up',
    module: 'platform',
    icon: ListChecks,
    component: WelcomeSurface,
    // One checklist per account — a second copy shows the same derived progress.
    singleton: true,
    order: 3,
    keywords: ['welcome', 'getting started', 'checklist', 'setup', 'onboarding', "what's next"],
  },
  {
    key: 'workbench.onboarding.story',
    title: 'Describe your business',
    module: 'platform',
    icon: PenLine,
    component: OnboardingStorySurface,
    section: 'Set up',
    // One setup at a time — a second copy would be two flows writing the same state.
    singleton: true,
    order: 40,
    keywords: ['onboarding', 'setup', 'story', 'describe', 'get started', 'launch site'],
  },
  {
    key: 'workbench.onboarding',
    title: 'Set up step by step',
    module: 'platform',
    icon: Rocket,
    component: OnboardingWizardSurface,
    section: 'Set up',
    singleton: true,
    order: 41,
    keywords: ['onboarding', 'setup', 'wizard', 'modules', 'template', 'get started'],
  },
];
