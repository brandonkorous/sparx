'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { SurfaceFrame, type SurfaceStepDef } from '@sparx/ui';
import { SummaryCard } from '../../onboarding/_components/summary-card';
import { RailFooter } from '../../onboarding/_components/rail-footer';
import { industryOf } from '../_lib/clauses';
import {
  EMPTY_STORY,
  addCust,
  addNewLine,
  addToLine,
  enabledModuleKeys,
  handleSlug,
  pickBlueprint,
  removeClause,
  resolveModules,
  swapClause,
  toProse,
  type StoryState,
} from '../_lib/story-state';
import { STORY_EXAMPLES } from '../_lib/story-examples';
import { commitStoryAction } from '../_lib/actions';
import type { WizardBlueprint } from '../../onboarding/_lib/types';
import { type StoryDispatch } from './story-canvas';
import { StoryComposeStage } from './story-compose-stage';
import { StoryTail } from './story-tail';
import { StoryExtras, storyPlanItems, storyTotals } from './story-summary';

const SELLING = ['commerce', 'b2b', 'dropship'];

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

// The orchestrator for the story onboarding's COMPOSE phase. The owner narrates their
// business (or seeds from an example); on "Build" it commits through the reused
// pipeline and hands off — IN PAGE — to <StoryTail> (payments + launch). It never
// routes to the classic wizard. (Resuming mid-tail after the Stripe reload is the
// page's job; it renders <StoryTail> directly from persisted state.)
export function StoryComposer({
  blueprints,
  initialName,
  siteOrigin,
  useTenantParam,
}: {
  blueprints: WizardBlueprint[];
  initialName: string;
  siteOrigin: string;
  useTenantParam: boolean;
}): ReactNode {
  const [started, setStarted] = useState(false);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [story, setStory] = useState<StoryState>({ ...EMPTY_STORY, name: initialName });
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dispatch: StoryDispatch = {
    setTense: (t) => setStory((s) => ({ ...s, tense: t })),
    setIndustry: (slug) => setStory((s) => ({ ...s, industry: slug })),
    setAudience: (a) => setStory((s) => ({ ...s, audience: a })),
    addCust: (id) => setStory((s) => addCust(s, id)),
    addToLine: (li, id) => setStory((s) => addToLine(s, li, id)),
    addNewLine: (id) => setStory((s) => addNewLine(s, id)),
    removeClause: (id) => setStory((s) => removeClause(s, id)),
    swapClause: (o, n) => setStory((s) => swapClause(s, o, n)),
    setSlot: (id, v) => setStory((s) => ({ ...s, slots: { ...s.slots, [id]: v } })),
    setName: (v) => setStory((s) => ({ ...s, name: v })),
  };

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
        siteOrigin={siteOrigin}
        useTenantParam={useTenantParam}
      />
    );
  }

  const example = STORY_EXAMPLES[exampleIdx] ?? STORY_EXAMPLES[0]!;
  const display = started ? story : example.story;
  const on = resolveModules(display);
  const selling = SELLING.some((k) => on[k]);
  const canBuild = !!display.industry && !!display.audience && handleSlug(display.name).length >= 3;
  const buildLabel = display.industry
    ? industryOf(display.industry).noun.replace(/^an? /, '')
    : 'workspace';
  const { total, elsewhere } = storyTotals(display);
  const steps: SurfaceStepDef[] = [
    { key: 'story', label: 'Your story', sublabel: 'Describe it' },
    ...(selling ? [{ key: 'payments', label: 'Get paid', sublabel: 'Connect Stripe' }] : []),
    { key: 'launch', label: 'Go live', sublabel: 'Publish' },
  ];

  const startFrom = (seed: StoryState): void => {
    setStory(cloneStory(seed));
    setStarted(true);
  };

  const onBuild = (): void => {
    const industry = story.industry;
    if (!industry || !story.audience || pending) return;
    setError(null);
    const blueprint = pickBlueprint(industryOf(industry), on, blueprints);
    startTransition(async () => {
      const res = await commitStoryAction({
        modules: on,
        industry,
        blueprintKey: blueprint?.key ?? null,
        selling,
        story: {
          text: toProse(story),
          tense: story.tense,
          industry: story.industry,
          audience: story.audience,
          name: story.name,
          cust: story.cust,
          lines: story.lines,
          slots: story.slots,
          modules: enabledModuleKeys(story),
        },
      });
      if (res.ok) {
        setCommitted({
          story,
          installId: res.data.installId,
          blueprintKey: res.data.blueprintKey,
          stage: res.data.next,
        });
      } else {
        setError(res.error);
      }
    });
  };

  const cta = started
    ? { label: `Build my ${buildLabel}`, onClick: onBuild, disabled: !canBuild, loading: pending }
    : { label: 'Start from this story', onClick: () => startFrom(example.story) };

  return (
    <SurfaceFrame
      variant="page"
      lede={{
        title: 'Tell your story.',
        blurb: 'Say it in your own words. We turn it into a working site as you go.',
      }}
      context="Each phrase switches on a module and fills in your setup live. Free for 14 days, no card today."
      steps={steps}
      current={0}
      footer={<RailFooter />}
    >
      <div className="mx-auto w-full max-w-[1120px] px-12 py-12 max-[940px]:px-5 max-[940px]:py-8">
        <div className="grid grid-cols-[1fr_340px] items-start gap-8 max-[1040px]:grid-cols-1">
          <StoryComposeStage
            started={started}
            story={story}
            examples={STORY_EXAMPLES}
            activeIdx={exampleIdx}
            dispatch={dispatch}
            onSelect={setExampleIdx}
            onStartBlank={() => startFrom({ ...EMPTY_STORY, name: initialName })}
          />

          <SummaryCard
            plan={{ total, elsewhere, items: storyPlanItems(display) }}
            entries={[]}
            cta={cta}
            error={error}
            extras={
              display.industry ? <StoryExtras story={display} blueprints={blueprints} /> : undefined
            }
          />
        </div>
      </div>
    </SurfaceFrame>
  );
}
