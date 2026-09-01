'use client';

// The work pane: whichever step's editor is showing. One switch, so wizard.tsx
// keeps the state and the commits and this keeps the rendering.

import { StepModules } from './step-modules';
import { StepBlueprint } from './step-blueprint';
import { StepWorkspace, type SlugCheck } from './step-workspace';
import { StepDomain } from './step-domain';
import { StepPayments } from './step-payments';
import { StepLaunch } from './step-launch';
import { effectiveModuleOn } from '../../../lib/onboarding/module-graph';
import type { OnboardingActions } from '../../../lib/onboarding/api';
import type {
  OnboardingStepKey,
  PendingDomain,
  WizardBlueprint,
} from '../../../lib/onboarding/types';

export interface WizardBodyProps {
  step: OnboardingStepKey;
  actions: OnboardingActions;
  blueprints: WizardBlueprint[];
  blueprintsLoading: boolean;

  modules: Record<string, boolean>;
  onToggleModule: (key: string) => void;
  activeModuleCount: number;

  /** The selected starting point, the SCRATCH sentinel, or null. */
  choice: string | null;
  onChoice: (key: string) => void;
  /** Whether the chosen design brings its examples (issue 098). */
  sampleData: boolean;
  onSampleData: (next: boolean) => void;

  companyName: string;
  slug: string;
  effectiveSlug: string;
  siteName: string;
  onCompanyName: (value: string) => void;
  onSlug: (value: string) => void;
  onSiteName: (value: string) => void;
  slugCheck: SlugCheck;
  unchangedSlug: boolean;
  attemptedWorkspace: boolean;

  pendingDomain: PendingDomain | null;
  onPendingDomain: (next: PendingDomain | null) => void;

  paymentsConnected: boolean;
  onPaymentsConnected: () => void;

  installId: string | null;
  installedBlueprint: WizardBlueprint | null;
  published: boolean;
}

export function WizardBody(props: WizardBodyProps) {
  switch (props.step) {
    case 'modules':
      return <StepModules value={props.modules} onToggle={props.onToggleModule} />;
    case 'template':
      return (
        <StepBlueprint
          blueprints={props.blueprints}
          selectedKey={props.choice}
          onSelect={props.onChoice}
          sampleData={props.sampleData}
          onSampleData={props.onSampleData}
          loading={props.blueprintsLoading}
        />
      );
    case 'workspace':
      return (
        <StepWorkspace
          companyName={props.companyName}
          slug={props.slug}
          siteName={props.siteName}
          onCompany={props.onCompanyName}
          onSlug={props.onSlug}
          onSite={props.onSiteName}
          check={props.slugCheck}
          unchangedSlug={props.unchangedSlug}
          showErrors={props.attemptedWorkspace}
        />
      );
    case 'domain':
      return (
        <StepDomain
          slug={props.effectiveSlug}
          defaultQuery={props.companyName.replace(/[^a-z0-9]+/gi, '').toLowerCase()}
          actions={props.actions}
          selected={props.pendingDomain}
          onSelect={props.onPendingDomain}
          onClear={() => {
            props.onPendingDomain(null);
          }}
        />
      );
    case 'payments':
      return (
        <StepPayments
          connected={props.paymentsConnected}
          actions={props.actions}
          onConnected={props.onPaymentsConnected}
        />
      );
    case 'launch':
      return (
        <StepLaunch
          slug={props.effectiveSlug}
          installId={props.installId}
          blueprint={props.installedBlueprint}
          builderEnabled={effectiveModuleOn(props.modules, 'builder')}
          published={props.published}
          moduleCount={props.activeModuleCount}
          pendingDomain={props.pendingDomain}
          actions={props.actions}
        />
      );
    default:
      return null;
  }
}
