'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { SurfaceFrame, type SurfaceStepDef } from '@sparx/ui';
import { SummaryCard } from '../../onboarding/_components/summary-card';
import { RailFooter } from '../../onboarding/_components/rail-footer';
import { FlowSwitchAlt } from '../../_components/flow-switch';
import { industryOf } from '../_lib/clauses';
import {
  EMPTY_STORY,
  addCust,
  addNewLine,
  addToLine,
  handleSlug,
  pickBlueprint,
  removeClause,
  resolveModules,
  swapClause,
  toPersistPayload,
  type StoryState,
} from '../_lib/story-state';
import { STORY_EXAMPLES } from '../_lib/story-examples';
import { commitStoryAction, saveStoryDraftAction } from '../_lib/actions';
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
// pipeline and hands off — IN PAGE — to <StoryTail> (payments + launch), never bouncing
// to the wizard to finish. (Resuming mid-tail after the Stripe reload is the page's
// job; it renders <StoryTail> directly from persisted state.)
//
// The summary card does carry a switch to the classic wizard (`<FlowSwitchAlt>`) — the
// two front ends are interchangeable. That's an owner-initiated move, not a hand-off,
// and it's lossless: the draft keeps saving here, so switching back resumes this story.
export function StoryComposer({
  blueprints,
  initialName,
  initialStory,
  siteOrigin,
  useTenantParam,
}: {
  blueprints: WizardBlueprint[];
  initialName: string;
  /** A saved-but-not-committed draft to resume composing (null → start on examples). */
  initialStory?: StoryState | null;
  siteOrigin: string;
  useTenantParam: boolean;
}): ReactNode {
  // `started` = the owner has made a template THEIR OWN (edited it, or chose a blank
  // page). Until then they're browsing a pristine template — editable in place, but not
  // yet persisted, so navigating away resets it (a template is a starting point, not a
  // commitment). The composer opens on the first template so there is always something
  // to edit, not a dead read-only preview.
  const [started, setStarted] = useState(!!initialStory);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [story, setStory] = useState<StoryState>(
    initialStory ?? cloneStory({ ...STORY_EXAMPLES[0]!.story, name: initialName })
  );
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Any edit promotes a browsed template into the owner's own story — it flips
  // `started` (the draft begins persisting + the heading changes) and applies the edit.
  const edit = (updater: (s: StoryState) => StoryState): void => {
    setStarted(true);
    setStory(updater);
  };
  const dispatch: StoryDispatch = {
    setTense: (t) => edit((s) => ({ ...s, tense: t })),
    setIndustry: (slug) => edit((s) => ({ ...s, industry: slug })),
    setAudience: (a) => edit((s) => ({ ...s, audience: a })),
    addCust: (id) => edit((s) => addCust(s, id)),
    addToLine: (li, id) => edit((s) => addToLine(s, li, id)),
    addNewLine: (id) => edit((s) => addNewLine(s, id)),
    removeClause: (id) => edit((s) => removeClause(s, id)),
    swapClause: (o, n) => edit((s) => swapClause(s, o, n)),
    setSlot: (id, v) => edit((s) => ({ ...s, slots: { ...s.slots, [id]: v } })),
    setName: (v) => edit((s) => ({ ...s, name: v })),
  };

  // Persist the in-progress narrative as the owner composes, so a refresh or a trip
  // away resumes the story instead of losing it (the classic wizard already persists
  // each step as you go). Debounced to coalesce rapid edits; the server keeps
  // `currentStep` put, so the page resumes the COMPOSE phase — not the tail — and the
  // draft is superseded by the final narrative on commit. Only runs once the owner is
  // actually composing (`started`) and before the in-page hand-off (`committed`).
  const savedDraft = useRef<string>(
    initialStory ? JSON.stringify(toPersistPayload(initialStory)) : ''
  );
  useEffect(() => {
    if (!started || committed) return;
    const payload = toPersistPayload(story);
    const serial = JSON.stringify(payload);
    if (serial === savedDraft.current) return;
    const timer = setTimeout(() => {
      savedDraft.current = serial;
      void saveStoryDraftAction(payload);
    }, 900);
    return () => clearTimeout(timer);
  }, [story, started, committed]);

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

  // The canvas is always the live, editable story (seeded from a template or a draft),
  // so the plan rail always mirrors exactly what's on screen.
  const display = story;
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

  // A pristine copy of a template, keyed to the tenant's own web handle.
  const seedTemplate = (i: number): StoryState =>
    cloneStory({ ...STORY_EXAMPLES[i]!.story, name: initialName });

  // Picking a template while browsing (not yet started) just swaps the editable canvas.
  const onSelectTemplate = (i: number): void => {
    setExampleIdx(i);
    setStory(seedTemplate(i));
    setStarted(false);
  };

  // "Start over" discards the owner's edits and returns to the template picker. Guarded
  // because it's destructive; the (onboarding) group has no ConfirmProvider, so this
  // uses the native confirm rather than useConfirm.
  const onStartOver = (): void => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Start over? Your story so far will be cleared.')
    ) {
      return;
    }
    setStarted(false);
    setStory(seedTemplate(exampleIdx));
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
        story: toPersistPayload(story),
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

  // One CTA throughout compose: build what's on screen. Enabled once the story has the
  // essentials (industry + audience + a ≥3-char handle) — true for any template as-is,
  // so an owner who likes a template can build it in one tap, or edit it first.
  const cta = {
    label: `Build my ${buildLabel}`,
    onClick: onBuild,
    disabled: !canBuild,
    loading: pending,
  };

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
            onSelectTemplate={onSelectTemplate}
            onStartBlank={() => startFrom({ ...EMPTY_STORY, name: initialName })}
            onStartOver={onStartOver}
          />

          <SummaryCard
            plan={{ total, elsewhere, items: storyPlanItems(display) }}
            entries={[]}
            cta={cta}
            error={error}
            extras={
              display.industry ? <StoryExtras story={display} blueprints={blueprints} /> : undefined
            }
            altAction={<FlowSwitchAlt to="classic" />}
          />
        </div>
      </div>
    </SurfaceFrame>
  );
}
