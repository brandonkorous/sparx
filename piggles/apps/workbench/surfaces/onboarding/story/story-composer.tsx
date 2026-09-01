'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { EMPTY_STORY, STORY_EXAMPLES, industryOf, type StoryState } from '@wizeworks/story-schemas';
import {
  handleSlug,
  pickBlueprint,
  resolveModules,
  toPersistPayload,
} from '../../../lib/onboarding/story-state';
import { isSellingSelected } from '../../../lib/onboarding/module-graph';
import { useOnboarding, useOnboardingActions } from '../../../lib/onboarding/api';
import { useConfirm } from '../../../lib/confirm';
import { useStoryModel } from '../../../lib/onboarding/use-story-model';
import type { WizardBlueprint } from '../../../lib/onboarding/types';
import { SummaryCard } from '../../../lib/onboarding/summary-card';
import { OnboardingLayout, type StepMark } from '../onboarding-layout';
import { StoryComposeStage } from './story-compose-stage';
import { StoryHelp } from './story-help';
import { StoryTail } from './story-tail';
import { StoryExtras, storyPlanItems } from './story-summary';

// The COMPOSE phase orchestrator. The owner narrates their business (or seeds from an
// example); each edit updates the live plan beside it. On "Build" it commits through
// the reused onboarding pipeline and hands off IN-PAGE to <StoryTail> (payments +
// launch) — it never bounces to the classic wizard. The summary card carries the one
// owner-initiated switch to the wizard, which is lossless: the draft keeps saving here,
// so switching back resumes this story.

/** What a successful commit hands to the in-page tail — no navigation, no reload. */
interface Committed {
  story: StoryState;
  installId: string | null;
  blueprintKey: string | null;
  stage: 'payments' | 'launch';
}

function cloneStory(s: StoryState): StoryState {
  return { ...s, cust: [...s.cust], lines: s.lines.map((l) => [...l]), slots: { ...s.slots } };
}

export function StoryComposer({
  blueprints,
  initialName,
  initialStory,
  onSwitchToClassic,
  onFinished,
}: {
  blueprints: WizardBlueprint[];
  initialName: string;
  /** A saved-but-not-committed draft to resume composing (null → start on examples). */
  initialStory?: StoryState | null;
  onSwitchToClassic: () => void;
  onFinished: () => void;
}): ReactNode {
  const actions = useOnboardingActions();
  // This BRAND's starting point, resolved server-side from the tenant's own
  // platformBrand. Was a literal `'sparx'` here, which put another company's
  // merchandise on a Piggles homepage (issue 091).
  const goldenKey = useOnboarding().data?.goldenKey ?? null;
  const confirm = useConfirm();
  const model = useStoryModel();

  const [exampleIdx, setExampleIdx] = useState(0);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // The shared model is seeded ONCE — from the persisted draft, else the first starter
  // template. If the step-by-step editor already mounted and seeded (the owner switched
  // in), `seed` is a no-op and we keep that. Rendering falls back to the same computed
  // seed for the one frame before the effect lands, so there's no flash.
  //
  // `started` = the owner has made a template THEIR OWN (edited it, chose blank, or
  // toggled a module in step-by-step). Until then they're browsing a pristine template.
  const fallback = useMemo(
    () => initialStory ?? cloneStory({ ...STORY_EXAMPLES[0]!.story, name: initialName }),
    [initialStory, initialName]
  );
  useEffect(() => {
    model.seed(fallback, !!initialStory);
    // Seed on mount only; the model owns its lifetime thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const story = model.story ?? fallback;
  const started = model.story ? model.started : !!initialStory;
  const dispatch = model.dispatch;

  // Persist the in-progress narrative as the owner composes, so a refresh or a trip
  // away resumes the story instead of losing it. Debounced (~600ms) to coalesce rapid
  // edits; only runs once the owner is actually composing (`started`) and before the
  // in-page hand-off (`committed`). Best-effort — a failed save never blocks composing.
  const savedDraft = useRef<string>(
    initialStory ? JSON.stringify(toPersistPayload(initialStory)) : ''
  );
  useEffect(() => {
    if (!model.story || !started || committed) return;
    const payload = toPersistPayload(model.story);
    const serial = JSON.stringify(payload);
    if (serial === savedDraft.current) return;
    const timer = setTimeout(() => {
      savedDraft.current = serial;
      void actions.saveStoryDraft(payload).catch(() => undefined);
    }, 600);
    return () => clearTimeout(timer);
  }, [model.story, started, committed, actions]);

  // Once built, the same page continues through the tail — no wizard redirect.
  if (committed) {
    return (
      <StoryTail
        story={committed.story}
        blueprints={blueprints}
        installId={committed.installId}
        blueprintKey={committed.blueprintKey}
        initialStage={committed.stage}
        stripeConnected={false}
        onFinished={onFinished}
      />
    );
  }

  // The canvas is always the live, editable story, so the plan always mirrors it.
  const on = resolveModules(story);
  const selling = isSellingSelected(on);
  const canBuild = !!story.industry && !!story.audience && handleSlug(story.name).length >= 3;
  const buildLabel = story.industry
    ? industryOf(story.industry).noun.replace(/^an? /, '')
    : 'workspace';

  const steps: StepMark[] = [
    { key: 'story', label: 'Your story', status: 'current' },
    ...(selling ? [{ key: 'payments', label: 'Getting paid', status: 'upcoming' as const }] : []),
    { key: 'launch', label: 'Going live', status: 'upcoming' },
  ];

  // A pristine copy of a template, keyed to the tenant's own web handle.
  const seedTemplate = (i: number): StoryState =>
    cloneStory({ ...STORY_EXAMPLES[i]!.story, name: initialName });

  // The starting-point picker stays visible the whole time, so choosing one can wipe an
  // in-progress story — confirm first once the owner has started, through the workbench's
  // own alert dialog (silicaui `useConfirm`, provided at the root layout), never a native
  // browser prompt. While still browsing a pristine template, there's nothing to lose, so
  // it swaps freely.
  const confirmReplace = async (): Promise<boolean> =>
    !started ||
    (await confirm({
      title: 'Start over?',
      description:
        'This clears the story you have so far and begins again from a fresh starting point. Your plan on the right resets to match.',
      confirmLabel: 'Start over',
      cancelLabel: 'Keep my story',
      color: 'danger',
    }));

  const onSelectTemplate = (i: number): void => {
    void (async () => {
      if (!(await confirmReplace())) return;
      setExampleIdx(i);
      model.replace(seedTemplate(i), false);
    })();
  };

  const onStartBlank = (): void => {
    void (async () => {
      if (!(await confirmReplace())) return;
      model.replace(cloneStory({ ...EMPTY_STORY, name: initialName }), true);
    })();
  };

  const onBuild = (): void => {
    if (!story.industry || !story.audience || pending) return;
    setError(null);
    setPending(true);
    const blueprint = pickBlueprint(industryOf(story.industry), on, blueprints);
    const snapshot = cloneStory(story);
    void actions
      .commitStory({
        modules: on,
        industry: story.industry,
        // Fall back to this brand's own starting point when the story matches no
        // more-specific blueprint. Null when the server did not say, which the
        // pipeline reads as "start from scratch" — an empty site is a better
        // answer than another company's demo business.
        blueprintKey: blueprint?.key ?? goldenKey,
        // The story flow is the guided path: somebody describing their business
        // in a sentence wants the screens to have something on them. The choice
        // to take the structure alone lives in the wizard and in Designs.
        sampleData: true,
        selling,
        story: toPersistPayload(story),
      })
      .then((res) => {
        setCommitted({
          story: snapshot,
          installId: res.installId,
          blueprintKey: res.blueprintKey,
          stage: res.next,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setPending(false);
      });
  };

  return (
    <OnboardingLayout
      steps={steps}
      work={
        <StoryComposeStage
          started={started}
          story={story}
          examples={STORY_EXAMPLES}
          activeIdx={exampleIdx}
          dispatch={dispatch}
          onSelectTemplate={onSelectTemplate}
          onStartBlank={onStartBlank}
        />
      }
      belowWork={<StoryHelp />}
      summary={
        <SummaryCard
          plan={{ items: storyPlanItems(story) }}
          primary={{
            label: `Build my ${buildLabel}`,
            onClick: onBuild,
            disabled: !canBuild,
            loading: pending,
          }}
          error={error}
          extras={
            story.industry ? <StoryExtras story={story} blueprints={blueprints} /> : undefined
          }
          altAction={
            <Button variant="link" color="neutral" size="sm" onClick={onSwitchToClassic}>
              Prefer step-by-step?
            </Button>
          }
        />
      }
    />
  );
}
