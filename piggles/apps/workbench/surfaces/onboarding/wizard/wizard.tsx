'use client';

// The classic wizard — the modules-first guided setup, rebuilt for the workbench.
//
// This file is the BRAIN. It owns every step's state (which step, the module
// selection, the chosen starting point + its install, the workspace fields, the
// pending custom domain, whether Stripe is connected), computes the plan and the
// step sequence (Payments appears only when a selling module is on), and renders the
// shared two-column chrome: a swapping WORK pane on the left and the persistent
// SummaryCard on the right. The card holds the ONE primary CTA every step commits
// through, so the button never moves and the receipt accretes as the owner goes.
//
// It resumes from the persisted onboarding state and seeds the module switchboard
// from the saved flags. Each step's commit calls the matching useOnboardingActions
// method; the final Publish/Finish calls its action then onFinished().

import { useEffect, useMemo, useState } from 'react';
import { Button, Loading, Text } from '@wizeworks/silicaui-react';
import type { StoryState } from '@wizeworks/story-schemas';
import { OnboardingLayout, type StepMark } from '../onboarding-layout';
import { SummaryCard } from '../../../lib/onboarding/summary-card';
import { useBlueprints, useOnboarding, useOnboardingActions } from '../../../lib/onboarding/api';
import { useStoryModel } from '../../../lib/onboarding/use-story-model';
import { useSites, useTenant } from '../../../lib/api/shell-data';
import {
  resolveModules,
  starterStory,
  storyFromPersisted,
} from '../../../lib/onboarding/story-state';
import {
  SWITCHBOARD_MODULES,
  effectiveModuleOn,
  isSellingSelected,
} from '../../../lib/onboarding/modules';
import type {
  OnboardingStepKey,
  PendingDomain,
  WizardBlueprint,
} from '../../../lib/onboarding/types';
import { StoryExtras, storyPlanItems, storyTotals } from '../story/story-summary';
import { StepModules } from './step-modules';
import { StepBlueprint, SCRATCH, GOLDEN_BLUEPRINT_KEY } from './step-blueprint';
import { StepWorkspace, type SlugCheck } from './step-workspace';
import { StepDomain } from './step-domain';
import { StepPayments } from './step-payments';
import { StepLaunch } from './step-launch';
import { productCopy } from '../../../lib/product';

const FULL_ORDER: OnboardingStepKey[] = [
  'modules',
  'template',
  'workspace',
  'domain',
  'payments',
  'launch',
];

const STEP_LABEL: Record<OnboardingStepKey, string> = {
  modules: 'Modules',
  template: 'Starting point',
  workspace: 'Workspace',
  domain: 'Domain',
  payments: 'Payments',
  launch: 'Launch',
};

const HEAD: Partial<Record<OnboardingStepKey, { title: string; supporting: string }>> = {
  modules: {
    title: 'Switch on what you use',
    supporting:
      'Every module is one toggle — flip it and your plan updates the instant you do. You are free for 14 days with no card; this is just what you would pay after. Your picks narrow the starting points next.',
  },
  template: {
    title: 'Pick a starting point',
    supporting:
      'Complete, themed sites — pages, design, products, and copy in place from the first second. Filtered to the modules you chose; pick one to load it into your setup.',
  },
  workspace: {
    title: 'Name your workspace',
    supporting:
      'Your company and its first site. We pre-filled what you told us at signup — change anything. Your free web address goes live the moment you launch.',
  },
  domain: {
    title: 'Make it yours',
    supporting: productCopy(
      'onboarding.domain.pitch',
      'A custom domain builds trust — and it is yours to keep. Grab the perfect one now, or start free on your sparx.zone address and add a domain anytime.'
    ),
  },
  payments: {
    title: 'Get paid',
    supporting:
      'Connect Stripe so your site can take customer payments. You can go live now and connect this whenever you are ready — checkout simply stays off until then.',
  },
};

// The steps where the "tell your story instead" switch is offered — always in the
// summary card, never the heading, so BOTH flows carry the flow-switch in the same
// place (the summary). Excludes payments/launch: by then the setup is committed and
// the story flow's own tail IS these same steps.
const ALT_SWITCH_STEPS: OnboardingStepKey[] = ['modules', 'template', 'workspace', 'domain'];

interface Initial {
  step: OnboardingStepKey;
  blueprintKey: string | null;
  installId: string | null;
  templateDone: boolean;
  paymentsDone: boolean;
  companyName: string;
  slug: string;
  siteName: string;
}

export function ClassicWizard({
  onSwitchToStory,
  onFinished,
}: {
  onSwitchToStory: () => void;
  onFinished: () => void;
}) {
  const onboarding = useOnboarding();
  const tenantQ = useTenant();
  const sitesQ = useSites();
  const blueprintsQ = useBlueprints();

  const loadError =
    onboarding.error || tenantQ.error || sitesQ.error
      ? 'We could not load your setup. Refresh to try again.'
      : null;

  const ready = onboarding.data && tenantQ.data && sitesQ.data;

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Text>{loadError}</Text>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loading size="lg" />
      </div>
    );
  }

  const state = onboarding.data;
  const sites = sitesQ.data;
  const primarySite = sites.find((s) => s.isPrimary) ?? sites[0];

  const initial: Initial = {
    step: state.currentStep ?? 'modules',
    blueprintKey: state.blueprintKey ?? null,
    installId: state.installId ?? null,
    templateDone: Boolean(state.completed?.template),
    paymentsDone: Boolean(state.completed?.payments),
    companyName: tenantQ.data.name ?? '',
    slug: tenantQ.data.slug ?? '',
    siteName: primarySite?.name ?? '',
  };

  return (
    <WizardInner
      initial={initial}
      initialStory={state.story ? storyFromPersisted(state.story) : null}
      blueprints={blueprintsQ.data ?? []}
      blueprintsLoading={blueprintsQ.isLoading}
      onSwitchToStory={onSwitchToStory}
      onFinished={onFinished}
    />
  );
}

function WizardInner({
  initial,
  initialStory,
  blueprints,
  blueprintsLoading,
  onSwitchToStory,
  onFinished,
}: {
  initial: Initial;
  /** A persisted story draft, if any — seeds the shared model over the starter. */
  initialStory: StoryState | null;
  blueprints: WizardBlueprint[];
  blueprintsLoading: boolean;
  onSwitchToStory: () => void;
  onFinished: () => void;
}) {
  const actions = useOnboardingActions();
  const model = useStoryModel();

  // The shared model IS the module selection — the wizard's toggles are one way to
  // populate it, the story sentence the other. Seed the persisted draft, else the same
  // starter example the story opens on (so step-by-step-first and story-first agree),
  // then derive the module set from it — the plan reads `resolveModules` off the same
  // state as the story, so the summary is identical whichever editor is showing.
  const fallback = useMemo(
    () => initialStory ?? starterStory(initial.slug),
    [initialStory, initial.slug]
  );
  useEffect(() => {
    model.seed(fallback, !!initialStory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const story = model.story ?? fallback;
  const modules = resolveModules(story);

  const [step, setStep] = useState<OnboardingStepKey>(initial.step);

  // choice = the SELECTED starting point (a key, the SCRATCH sentinel, or null);
  // installedKey + installId are what is actually provisioned. A fresh tenant defaults
  // to the golden template — a new site IS the golden template unless the user picks
  // another blueprint or starts blank. Anyone resuming keeps their prior choice.
  const [choice, setChoice] = useState<string | null>(
    initial.blueprintKey ?? (initial.templateDone ? SCRATCH : GOLDEN_BLUEPRINT_KEY)
  );
  const [installedKey, setInstalledKey] = useState<string | null>(initial.blueprintKey);
  const [installId, setInstallId] = useState<string | null>(initial.installId);

  const [companyName, setCompanyName] = useState(initial.companyName);
  // The web handle is shared: it's the story's `name`, so the summary address and the
  // story sentence's "Find me at …" are one field across both editors.
  const slug = story.name;
  const setSlug = model.dispatch.setName;
  const [siteName, setSiteName] = useState(initial.siteName);
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({ status: 'idle' });
  const [attemptedWorkspace, setAttemptedWorkspace] = useState(false);

  const [pendingDomain, setPendingDomain] = useState<PendingDomain | null>(null);
  const [paymentsConnected, setPaymentsConnected] = useState(initial.paymentsDone);
  const [published, setPublished] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step sequence ───────────────────────────────────────────────────────────
  const selling = isSellingSelected(modules);
  const order = useMemo(
    () => (selling ? FULL_ORDER : FULL_ORDER.filter((s) => s !== 'payments')),
    [selling]
  );
  const idx = Math.max(0, order.indexOf(step));
  const nextKey = order[Math.min(idx + 1, order.length - 1)] ?? 'launch';
  const prevKey = order[Math.max(idx - 1, 0)] ?? 'modules';

  // ── Plan math (one projection of the shared story — identical to the story flow) ──
  const activeModules = SWITCHBOARD_MODULES.filter((m) => effectiveModuleOn(modules, m.key));
  const { total, elsewhere, savings } = storyTotals(story);
  const planItems = storyPlanItems(story);

  // ── Slug availability (debounced) ─────────────────────────────────────────────
  const normalizedSlug = slug.trim().toLowerCase();
  const unchangedSlug = normalizedSlug === initial.slug.trim().toLowerCase();
  useEffect(() => {
    if (!normalizedSlug || unchangedSlug) {
      setSlugCheck({ status: 'idle' });
      return;
    }
    setSlugCheck({ status: 'checking' });
    const handle = setTimeout(() => {
      void actions
        .checkSlug(normalizedSlug)
        .then((result) => setSlugCheck({ status: 'done', result }))
        .catch(() => setSlugCheck({ status: 'idle' }));
    }, 400);
    return () => clearTimeout(handle);
  }, [normalizedSlug, unchangedSlug, actions]);
  const slugOk =
    unchangedSlug || (slugCheck.status === 'done' && slugCheck.result.available === true);

  // ── Back navigation (persists the step) ───────────────────────────────────────
  function goBack() {
    setError(null);
    setBusy(true);
    void actions
      .goToStep(prevKey)
      .then(() => setStep(prevKey))
      .catch(() => setError('We could not go back. Try again.'))
      .finally(() => setBusy(false));
  }

  // ── Per-step commit (the summary card's primary CTA) ──────────────────────────
  async function commit() {
    setError(null);
    switch (step) {
      case 'modules':
        await actions.saveModules(modules);
        setStep('template');
        return;
      case 'template':
        if (choice === SCRATCH) {
          await actions.startFromScratch();
          setInstalledKey(null);
          setInstallId(null);
        } else if (choice) {
          const res = await actions.selectTemplate(choice);
          setInstalledKey(choice);
          setInstallId(res.installId);
        }
        setStep('workspace');
        return;
      case 'workspace':
        await actions.saveWorkspace({
          companyName: companyName.trim(),
          slug: normalizedSlug,
          siteName: siteName.trim(),
        });
        setStep('domain');
        return;
      case 'domain':
        await actions.completeDomainStep(nextKey);
        setStep(nextKey);
        return;
      case 'payments':
        await actions.completePayments({ paymentsConnected, next: 'launch' });
        setStep('launch');
        return;
      case 'launch':
        if (pendingDomain) await actions.purchaseDomain(pendingDomain);
        if (installId) await actions.publishAndFinish(installId);
        else await actions.finishOnboarding();
        setPublished(true);
        onFinished();
        return;
    }
  }

  function onContinue() {
    if (step === 'workspace' && !canContinue) {
      setAttemptedWorkspace(true);
      return;
    }
    setBusy(true);
    commit()
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      )
      .finally(() => setBusy(false));
  }

  // ── CTA validity + label ──────────────────────────────────────────────────────
  const canContinue = (() => {
    switch (step) {
      case 'modules':
        return activeModules.length > 0;
      case 'template':
        return choice !== null;
      case 'workspace':
        return companyName.trim().length > 0 && siteName.trim().length > 0 && slugOk;
      default:
        return true;
    }
  })();

  const ctaLabel = (() => {
    switch (step) {
      case 'template':
        return choice === SCRATCH ? 'Start from scratch' : 'Use this starting point';
      case 'payments':
        return paymentsConnected ? 'Continue' : 'Skip for now';
      case 'launch':
        if (pendingDomain) return installId ? 'Pay & publish' : 'Pay & finish';
        return installId ? 'Publish my site' : 'Finish setup';
      default:
        return 'Continue';
    }
  })();

  // ── Starting-point the summary shows ──────────────────────────────────────────
  // Before the owner reaches the Template step the summary auto-picks (undefined →
  // StoryExtras chooses), exactly as the story flow does — so the two match. Once they
  // pick, their explicit choice (a blueprint, or scratch → a blank Builder site) wins.
  const startingPoint: WizardBlueprint | null | undefined = installedKey
    ? (blueprints.find((b) => b.key === installedKey) ?? null)
    : choice === SCRATCH
      ? null
      : undefined;

  // ── Work body ──────────────────────────────────────────────────────────────────
  const effectiveSlug = normalizedSlug || initial.slug;
  let body: React.ReactNode = null;
  switch (step) {
    case 'modules':
      body = <StepModules value={modules} onToggle={(key) => model.toggleModule(key)} />;
      break;
    case 'template':
      body = (
        <StepBlueprint
          blueprints={blueprints}
          selectedKey={choice}
          onSelect={setChoice}
          loading={blueprintsLoading}
        />
      );
      break;
    case 'workspace':
      body = (
        <StepWorkspace
          companyName={companyName}
          slug={slug}
          siteName={siteName}
          onCompany={setCompanyName}
          onSlug={setSlug}
          onSite={setSiteName}
          check={slugCheck}
          unchangedSlug={unchangedSlug}
          showErrors={attemptedWorkspace}
        />
      );
      break;
    case 'domain':
      body = (
        <StepDomain
          slug={effectiveSlug}
          defaultQuery={companyName.replace(/[^a-z0-9]+/gi, '').toLowerCase()}
          actions={actions}
          selected={pendingDomain}
          onSelect={setPendingDomain}
          onClear={() => setPendingDomain(null)}
        />
      );
      break;
    case 'payments':
      body = (
        <StepPayments
          connected={paymentsConnected}
          actions={actions}
          onConnected={() => setPaymentsConnected(true)}
        />
      );
      break;
    case 'launch':
      body = (
        <StepLaunch
          slug={effectiveSlug}
          installId={installId}
          blueprint={blueprints.find((b) => b.key === installedKey) ?? null}
          builderEnabled={effectiveModuleOn(modules, 'builder')}
          published={published}
          moduleCount={activeModules.length}
          monthlyTotal={total}
          monthlyElsewhere={elsewhere}
          pendingDomain={pendingDomain}
          actions={actions}
        />
      );
      break;
  }

  // ── Chrome ──────────────────────────────────────────────────────────────────────
  const steps: StepMark[] = order.map((key, i) => ({
    key,
    label: STEP_LABEL[key],
    status: i < idx ? 'done' : i === idx ? 'current' : 'upcoming',
  }));

  const head = HEAD[step];
  const heading = head ? (
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight">{head.title}</h2>
      <Text className="max-w-prose">{head.supporting}</Text>
    </div>
  ) : null;

  const summary = (
    <SummaryCard
      plan={{ items: planItems, total, elsewhere, savings }}
      primary={{
        label: ctaLabel,
        onClick: onContinue,
        disabled: !canContinue || busy,
        loading: busy,
      }}
      back={idx > 0 ? { onClick: goBack, disabled: busy } : undefined}
      extras={
        <StoryExtras story={story} blueprints={blueprints} blueprintOverride={startingPoint} />
      }
      altAction={
        ALT_SWITCH_STEPS.includes(step) ? (
          <Button variant="link" color="module" size="sm" onClick={onSwitchToStory}>
            Prefer to describe it in a sentence?
          </Button>
        ) : undefined
      }
      error={error}
    />
  );

  return <OnboardingLayout work={body} summary={summary} steps={steps} heading={heading} />;
}
