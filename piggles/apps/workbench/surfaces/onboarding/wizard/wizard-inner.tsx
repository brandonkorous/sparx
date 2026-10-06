'use client';

// The classic wizard's BRAIN: every step's state, and the commit its one CTA
// runs. The work pane is wizard-body, the right-hand column wizard-summary.

import { useEffect, useMemo, useState } from 'react';
import type { StoryState } from '@wizeworks/story-schemas';
import { OnboardingLayout } from '../onboarding-layout';
import { useOnboardingActions } from '../../../lib/onboarding/api';
import { useStoryModel } from '../../../lib/onboarding/use-story-model';
import { resolveModules, starterStory } from '../../../lib/onboarding/story-state';
import { SWITCHBOARD_MODULES } from '../../../lib/onboarding/modules';
import { effectiveModuleOn, isSellingSelected } from '../../../lib/onboarding/module-graph';
import type {
  OnboardingStepKey,
  PendingDomain,
  WizardBlueprint,
} from '../../../lib/onboarding/types';
import { SCRATCH } from './step-blueprint';
import { useSlugCheck } from './use-slug-check';
import { useStartingPoint } from './use-starting-point';
import { ctaLabelFor, stepOrder, type Initial } from './wizard-steps';
import { WizardBody } from './wizard-body';
import { WizardHeading, WizardSummary, stepMarks } from './wizard-summary';
import { apiErrorMessage } from '../../../lib/api-error';
import { useStoryDraftSave } from '../../../lib/onboarding/use-story-draft';

export function WizardInner({
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

  // The shared model IS the module selection — the toggles populate it one way,
  // the story sentence the other, so both editors show the same summary.
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
  // A switch flipped here changes the story, so save it here too (sparx persona issue 009).
  useStoryDraftSave(model, actions.saveStoryDraft, { initialStory: initialStory ?? null });

  const [step, setStep] = useState<OnboardingStepKey>(initial.step);

  // selected = what the gallery marks, the summary names and Continue installs. The
  // fallback default is this BRAND's, resolved server-side (issue 091).
  const sp = useStartingPoint(initial, story, modules, blueprints);
  const { selected, setChoice, recommendedKey, installedKey, installId, startingPoint } = sp;
  const [sampleData, setSampleData] = useState(initial.sampleData);

  const [companyName, setCompanyName] = useState(initial.companyName);
  // The web handle is shared: it's the story's `name`, so the summary address and
  // the story sentence's "Find me at …" are one field across both editors.
  const slug = story.name;
  const setSlug = model.dispatch.setName;
  const [siteName, setSiteName] = useState(initial.siteName);
  const [attemptedWorkspace, setAttemptedWorkspace] = useState(false);

  const [pendingDomain, setPendingDomain] = useState<PendingDomain | null>(null);
  const [paymentsConnected, setPaymentsConnected] = useState(initial.paymentsDone);
  const [published, setPublished] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step sequence ───────────────────────────────────────────────────────────
  const selling = isSellingSelected(modules);
  const order = useMemo(() => stepOrder(selling), [selling]);
  const idx = Math.max(0, order.indexOf(step));
  const nextKey = order[Math.min(idx + 1, order.length - 1)] ?? 'launch';
  const prevKey = order[Math.max(idx - 1, 0)] ?? 'modules';
  const activeModules = SWITCHBOARD_MODULES.filter((m) => effectiveModuleOn(modules, m.key));

  const slugState = useSlugCheck(slug, initial.slug, actions);

  // ── Per-step commit (the summary card's primary CTA) ────────────────────────
  async function commit() {
    setError(null);
    switch (step) {
      case 'modules':
        await actions.saveModules(modules);
        setStep('template');
        return;
      case 'template':
        if (selected === SCRATCH) {
          await actions.startFromScratch();
          sp.installed(null, null);
        } else if (selected) {
          const res = await actions.selectTemplate({ key: selected, sampleData });
          sp.installed(selected, res.installId);
        }
        setStep('workspace');
        return;
      case 'workspace':
        await actions.saveWorkspace({
          companyName: companyName.trim(),
          slug: slugState.normalized,
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

  function goBack() {
    setError(null);
    setBusy(true);
    void actions
      .goToStep(prevKey)
      .then(() => setStep(prevKey))
      .catch(() => setError('We could not go back. Try again.'))
      .finally(() => setBusy(false));
  }

  function onContinue() {
    if (step === 'workspace' && !canContinue) {
      setAttemptedWorkspace(true);
      return;
    }
    setBusy(true);
    commit()
      .catch((e: unknown) =>
        setError(
          apiErrorMessage(
            e,
            'We could not save this step just now. Nothing you chose is lost. Press Continue again in a moment.'
          )
        )
      )
      .finally(() => setBusy(false));
  }

  const canContinue =
    step === 'modules'
      ? activeModules.length > 0
      : step === 'template'
        ? selected !== null
        : step === 'workspace'
          ? companyName.trim().length > 0 && siteName.trim().length > 0 && slugState.ok
          : true;

  const ctaLabel = ctaLabelFor(step, {
    startingFromScratch: selected === SCRATCH,
    paymentsConnected,
    buyingDomain: pendingDomain !== null,
    hasInstall: installId !== null,
  });

  return (
    <OnboardingLayout
      work={
        <WizardBody
          step={step}
          actions={actions}
          blueprints={blueprints}
          blueprintsLoading={blueprintsLoading}
          modules={modules}
          onToggleModule={(key) => {
            model.toggleModule(key);
          }}
          activeModuleCount={activeModules.length}
          choice={selected}
          recommendedKey={recommendedKey}
          onChoice={setChoice}
          sampleData={sampleData}
          onSampleData={setSampleData}
          companyName={companyName}
          slug={slug}
          effectiveSlug={slugState.normalized || initial.slug}
          siteName={siteName}
          onCompanyName={setCompanyName}
          onSlug={setSlug}
          onSiteName={setSiteName}
          slugCheck={slugState.check}
          unchangedSlug={slugState.unchanged}
          attemptedWorkspace={attemptedWorkspace}
          pendingDomain={pendingDomain}
          onPendingDomain={setPendingDomain}
          paymentsConnected={paymentsConnected}
          onPaymentsConnected={() => {
            setPaymentsConnected(true);
          }}
          installId={installId}
          installedBlueprint={blueprints.find((b) => b.key === installedKey) ?? null}
          published={published}
        />
      }
      summary={
        <WizardSummary
          step={step}
          story={story}
          blueprints={blueprints}
          startingPoint={startingPoint}
          ctaLabel={ctaLabel}
          canContinue={canContinue}
          busy={busy}
          showBack={idx > 0}
          error={error}
          onContinue={onContinue}
          onBack={goBack}
          onSwitchToStory={onSwitchToStory}
        />
      }
      steps={stepMarks(order, idx)}
      heading={<WizardHeading step={step} />}
    />
  );
}
