'use client';

import * as React from 'react';
import { WizardFrame, type WizardStepDef } from '@sparx/ui';
import { goToStepAction } from '../_lib/actions';
import { isSellingSelected } from '../_lib/modules';
import type { OnboardingStepKey, WizardInitialState } from '../_lib/types';
import { StepModules } from './step-modules';
import { StepTemplate } from './step-template';
import { StepWorkspace } from './step-workspace';
import { StepDomain } from './step-domain';
import { StepPayments } from './step-payments';
import { StepLaunch } from './step-launch';
import { RailFooter } from './rail-footer';

// The orchestrator for the modules-first guided setup (docs/15 v2). It owns the
// step machine + the live module selection, renders the persistent WizardFrame
// (the flat-indigo rail + journey), and swaps the working pane per step. Payments
// is conditional — it's only in the journey when a selling module is on.

/** Each step's navigation contract. */
export interface StepNav {
  /** Advance to the next step (client-only — the completing action already
   *  persisted `currentStep`). */
  onNext: () => void;
  /** Skip this step without completing it (persists + advances). */
  onSkip: () => void;
  /** Go back one step (persists + advances). */
  onBack: () => void;
  /** True while a persist-and-navigate transition is in flight. */
  navPending: boolean;
  /** The resolved next step — passed to completing actions whose successor is
   *  conditional (after Domain, Payments only exists when selling). */
  nextKey: OnboardingStepKey;
}

const STEP_DEFS: Record<OnboardingStepKey, WizardStepDef> = {
  modules: { key: 'modules', label: 'Modules', sublabel: 'What you need' },
  template: { key: 'template', label: 'Template', sublabel: 'A starting point' },
  workspace: { key: 'workspace', label: 'Workspace', sublabel: 'Name your site' },
  domain: { key: 'domain', label: 'Domain', sublabel: 'Make it yours' },
  payments: { key: 'payments', label: 'Payments', sublabel: 'Get paid' },
  launch: { key: 'launch', label: 'Launch', sublabel: 'Go live' },
};

interface RailCopy {
  title: string;
  blurb: string;
  context: string;
}

const RAIL: Record<OnboardingStepKey, RailCopy> = {
  modules: {
    title: 'Switch on what you use.',
    blurb: 'One toggle per module. Free for 14 days.',
    context:
      'Switch on only what you need — the bill updates live and your picks narrow the templates that fit. Free for 14 days, no card today.',
  },
  template: {
    title: 'Pick a starting point.',
    blurb: 'A complete, themed site — not a blank page.',
    context:
      'Every template installs a whole site — pages, design, products, copy. Filtered to your modules; search to widen it.',
  },
  workspace: {
    title: 'Name your workspace.',
    blurb: 'Your company and its first site.',
    context:
      'Pre-filled from signup — tweak anything. Set your free .sparx.zone address here; it locks once you launch.',
  },
  domain: {
    title: 'Make it yours.',
    blurb: 'Claim a custom domain — or start free.',
    context:
      'A custom domain builds trust and is yours to keep. Skip it and your free .sparx.zone address works instantly.',
  },
  payments: {
    title: 'Get paid.',
    blurb: 'Connect Stripe to accept customer payments.',
    context:
      'This connects the account that RECEIVES money from your customers — separate from your Sparx subscription. Skippable.',
  },
  launch: {
    title: 'Ready to launch.',
    blurb: "Your site is built. One tap and it's live.",
    context:
      'Publishing makes your draft live at your address. Keep editing in the Builder afterward — anytime.',
  },
};

const FULL_ORDER: OnboardingStepKey[] = [
  'modules',
  'template',
  'workspace',
  'domain',
  'payments',
  'launch',
];

export function OnboardingWizard({ initial }: { initial: WizardInitialState }) {
  const [step, setStep] = React.useState<OnboardingStepKey>(initial.step);
  const [modules, setModules] = React.useState<Record<string, boolean>>(initial.modules);
  // Template selection can change mid-session, so track it here (not from the
  // page-load snapshot) — Launch publishes whatever was installed this session.
  const [blueprintKey, setBlueprintKey] = React.useState<string | null>(initial.blueprintKey);
  const [installId, setInstallId] = React.useState<string | null>(initial.installId);
  const [navPending, startNav] = React.useTransition();

  // Payments drops out of the journey when nothing sells.
  const order = React.useMemo(
    () => (isSellingSelected(modules) ? FULL_ORDER : FULL_ORDER.filter((s) => s !== 'payments')),
    [modules]
  );

  const idx = Math.max(0, order.indexOf(step));
  const nextKey = order[Math.min(idx + 1, order.length - 1)] ?? 'launch';
  const prevKey = order[Math.max(idx - 1, 0)] ?? 'modules';

  const goPersist = React.useCallback(
    (target: OnboardingStepKey) => {
      startNav(async () => {
        await goToStepAction(target);
        setStep(target);
      });
    },
    [startNav]
  );

  const nav: StepNav = {
    onNext: () => setStep(nextKey),
    onSkip: () => goPersist(nextKey),
    onBack: () => goPersist(prevKey),
    navPending,
    nextKey,
  };

  const steps = order.map((k) => STEP_DEFS[k]);

  // Only jump to a step the tenant has already visited (no skipping ahead).
  const onStepSelect = (_key: string, index: number) => {
    if (index < idx) goPersist(order[index]!);
  };

  let body: React.ReactNode;
  switch (step) {
    case 'modules':
      body = <StepModules value={modules} onChange={setModules} nav={nav} />;
      break;
    case 'template':
      body = (
        <StepTemplate
          blueprints={initial.blueprints}
          preselectKey={initial.preselectKey}
          selectedModules={modules}
          onInstalled={(key, id) => {
            setBlueprintKey(key);
            setInstallId(id);
          }}
          nav={nav}
        />
      );
      break;
    case 'workspace':
      body = (
        <StepWorkspace
          initial={{
            companyName: initial.companyName,
            slug: initial.slug,
            siteName: initial.siteName,
          }}
          nav={nav}
        />
      );
      break;
    case 'domain':
      body = (
        <StepDomain
          slug={initial.slug}
          defaultQuery={initial.companyName.replace(/[^a-z0-9]+/gi, '').toLowerCase()}
          nav={nav}
        />
      );
      break;
    case 'payments':
      body = <StepPayments nav={nav} />;
      break;
    case 'launch': {
      const chosen = initial.blueprints.find((b) => b.key === blueprintKey) ?? null;
      body = (
        <StepLaunch
          slug={initial.slug}
          installId={installId}
          blueprint={chosen}
          siteOrigin={initial.siteOrigin}
          useTenantParam={initial.useTenantParam}
          onDifferentTemplate={() => goPersist('template')}
        />
      );
      break;
    }
  }

  return (
    <WizardFrame
      variant="page"
      lede={{ title: RAIL[step].title, blurb: RAIL[step].blurb }}
      context={RAIL[step].context}
      steps={steps}
      current={idx}
      onStepSelect={onStepSelect}
      footer={<RailFooter />}
    >
      {body}
    </WizardFrame>
  );
}
