'use client';

// The onboarding data layer's HANDLE: one object of writes the flows drive in
// sequence, each bound to the query client so the cache refreshes after it lands.
//
// Built fresh for the workbench (docs: sparx/apps/workbench/CLAUDE.md "build it, don't
// port it"): the dashboard drives these same endpoints through server actions; here
// they are react-query hooks and imperative actions in the browser.
//
// The reads live in ./reads, the writes in ./steps-setup and ./steps-launch; this
// file wires them and re-exports so callers import one name. A call resolves or
// throws — there is no {ok,error} wrapper. Callers own the pending/error state.

import { useMemo } from 'react';
import { useQueryClient, type QueryClient } from '@wizeworks/query';
import { SWITCHBOARD_MODULES } from './modules';
import type { OnboardingStepKey } from './types';
import type { StoryPayload } from './story-state';
import { ONBOARDING_KEY, ONBOARDING_MODULES_KEY, ONBOARDING_PROGRESS_KEY } from './reads';
import * as setup from './steps-setup';
import * as launch from './steps-launch';

export * from './reads';
export type { TemplateChoice } from './steps-setup';

/** Invalidate everything a write can move — the state, the derived checklist, and
 *  the module flags (the modules step writes those too). */
function invalidateOnboarding(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ONBOARDING_KEY });
  void qc.invalidateQueries({ queryKey: ONBOARDING_PROGRESS_KEY });
  void qc.invalidateQueries({ queryKey: ONBOARDING_MODULES_KEY });
}

export interface CommitStoryInput {
  modules: Record<string, boolean>;
  /** Industry slug → `settings.category`. */
  industry: string;
  /** Matched starting blueprint, or null to start from a blank Builder site. */
  blueprintKey: string | null;
  /** Whether that blueprint's examples come with it (issue 098). */
  sampleData: boolean;
  /** Selling modules gate the payments step. */
  selling: boolean;
  story: StoryPayload;
}

export interface CommitStoryResult {
  next: Extract<OnboardingStepKey, 'payments' | 'launch'>;
  installId: string | null;
  blueprintKey: string | null;
}

/**
 * Every write the flows make. The wizard orchestrator awaits these in sequence;
 * the story commit composes the same pipeline the wizard steps use, one call.
 */
export function useOnboardingActions() {
  const qc = useQueryClient();

  return useMemo(() => {
    const done = (): void => {
      invalidateOnboarding(qc);
    };

    // The workspace step renames the tenant and its primary site, so it moves two
    // caches nothing else touches.
    const saveWorkspace = async (input: setup.WorkspaceInput): Promise<void> => {
      await setup.saveWorkspace(input, done);
      void qc.invalidateQueries({ queryKey: ['tenant'] });
      void qc.invalidateQueries({ queryKey: ['properties'] });
    };

    // Commit the story through the SAME pipeline as the wizard (modules →
    // blueprint → workspace), record the whole narrative + industry, and set the
    // in-page tail step (payments when selling, else launch).
    const commitStory = async (input: CommitStoryInput): Promise<CommitStoryResult> => {
      const slug = handleSlugLocal(input.story.name);
      if (slug.length < 3) throw new Error('Pick a web address of at least 3 letters.');
      const companyName = titleCase(slug);

      await setup.saveModules(input.modules, done);

      let installId: string | null = null;
      if (input.blueprintKey) {
        const res = await setup.selectTemplate(
          { key: input.blueprintKey, sampleData: input.sampleData },
          done
        );
        installId = res.installId;
      } else {
        await setup.startFromScratch(done);
      }

      await saveWorkspace({ companyName, slug, siteName: companyName });

      const next: 'payments' | 'launch' = input.selling ? 'payments' : 'launch';
      await setup.patchOnboarding({
        story: { ...input.story, composedAt: new Date().toISOString() },
        completed: { domain: true },
        currentStep: next,
      });
      done();
      return { next, installId, blueprintKey: input.blueprintKey };
    };

    return {
      saveModules: (modules: Record<string, boolean>) => setup.saveModules(modules, done),
      selectTemplate: (choice: setup.TemplateChoice) => setup.selectTemplate(choice, done),
      startFromScratch: () => setup.startFromScratch(done),
      checkSlug: setup.checkSlug,
      saveWorkspace,
      completeDomainStep: (next: OnboardingStepKey) => launch.completeDomainStep(next, done),
      getPrimaryProperty: launch.getPrimaryProperty,
      purchaseDomain: launch.purchaseDomain,
      startPaymentsOnboarding: launch.startPaymentsOnboarding,
      refreshPaymentsStatus: () => launch.refreshPaymentsStatus(done),
      completePayments: (input: { paymentsConnected?: boolean; next: OnboardingStepKey }) =>
        launch.completePayments(input, done),
      getPreviewToken: launch.getPreviewToken,
      publishAndFinish: (installId: string) => launch.publishAndFinish(installId, done),
      finishOnboarding: () => launch.finishOnboarding(done),
      goToStep: (step: OnboardingStepKey) => launch.goToStep(step, done),
      saveStoryDraft: launch.saveStoryDraft,
      commitStory,
      switchFlow: (flow: 'story' | 'classic') => launch.switchFlow(flow, done),
      markStarted: () => launch.markStarted(done),
      dismiss: () => launch.dismiss(done),
    };
  }, [qc]);
}

export type OnboardingActions = ReturnType<typeof useOnboardingActions>;

/* ── Small helpers used by the commit pipeline ───────────────────────────────── */

function handleSlugLocal(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ''
  );
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The module selection a fresh tenant starts from: NOTHING pre-enabled. The tenant
 *  turns on — and pays for — exactly the modules they want; that is the platform's
 *  premise, so onboarding never defaults a module ON. A blank slate simply surfaces
 *  every switchboard module as OFF; anyone with saved flags keeps theirs. */
export function initialModuleSelection(
  saved: { slug: string; enabled: boolean }[],
  modulesStepDone: boolean
): Record<string, boolean> {
  const stored = Object.fromEntries(saved.map((m) => [m.slug, m.enabled]));
  const anyOn = saved.some((m) => m.enabled);
  if (!modulesStepDone && !anyOn) {
    const withDefaults = { ...stored };
    for (const m of SWITCHBOARD_MODULES) withDefaults[m.key] ??= false;
    return withDefaults;
  }
  return stored;
}
