'use client';

// The ONE onboarding model, shared by both editors.
//
// The story and the step-by-step wizard are not two flows with two states — they are
// two ways to populate a SINGLE `StoryState`, held here and lifted into the gate so it
// survives the in-place switch between them. The summary is a pure projection of this
// model (`storyPlanItems`/`storyTotals`/`StoryExtras`), so it is identical whichever
// editor is active: a module switched on in the wizard adds its phrase to the sentence,
// and the plan matches because both read `resolveModules` off the same state.
//
// The model seeds lazily: whichever editor mounts first calls `seed()` with its initial
// (the story's persisted draft or a starter template; the wizard, an empty base). After
// that both share it. `replace()` is the hard set the story's template-picker / start-
// over use; `dispatch` is the per-field edit both the canvas and the wizard drive; and
// `toggleModule` is the wizard's switch, bridged to clauses.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AudienceKey } from '@sparx/story-schemas';
import {
  addCust,
  addNewLine,
  addToLine,
  removeClause,
  swapClause,
  toggleModuleInStory,
  type StoryDispatch,
  type StoryState,
} from './story-state';

export interface StoryModel {
  /** The shared story, or null until the first editor seeds it. */
  story: StoryState | null;
  /** Whether the owner has made the story their own (vs browsing a starter template). */
  started: boolean;
  /** Set the model ONCE, if still empty (the first editor to mount wins). */
  seed: (story: StoryState, started: boolean) => void;
  /** Hard-replace the whole model (template pick, start blank, start over). */
  replace: (story: StoryState, started: boolean) => void;
  /** Per-field edits — each promotes a browsed template into the owner's own story. */
  dispatch: StoryDispatch;
  /** The wizard's switch: add the module's phrase, or strip every phrase that names it. */
  toggleModule: (key: string) => void;
}

const StoryModelContext = createContext<StoryModel | null>(null);

export function StoryModelProvider({ children }: { children: ReactNode }) {
  const [story, setStory] = useState<StoryState | null>(null);
  const [started, setStarted] = useState(false);

  const model = useMemo<StoryModel>(() => {
    // An edit only applies once the model is seeded; it also flips `started`, since any
    // edit means the owner has made the template their own.
    const edit = (updater: (s: StoryState) => StoryState) => (): void => {
      setStarted(true);
      setStory((s) => (s ? updater(s) : s));
    };
    const dispatch: StoryDispatch = {
      setTense: (t) => edit((s) => ({ ...s, tense: t }))(),
      setIndustry: (slug) => edit((s) => ({ ...s, industry: slug }))(),
      setAudience: (a: AudienceKey) => edit((s) => ({ ...s, audience: a }))(),
      addCust: (id) => edit((s) => addCust(s, id))(),
      addToLine: (li, id) => edit((s) => addToLine(s, li, id))(),
      addNewLine: (id) => edit((s) => addNewLine(s, id))(),
      removeClause: (id) => edit((s) => removeClause(s, id))(),
      swapClause: (o, n) => edit((s) => swapClause(s, o, n))(),
      setSlot: (id, v) => edit((s) => ({ ...s, slots: { ...s.slots, [id]: v } }))(),
      setName: (v) => edit((s) => ({ ...s, name: v }))(),
    };
    return {
      story,
      started,
      seed: (s, st) => {
        // First editor to mount wins; later mounts find it already seeded. `story` is
        // the memo's current value, so this needs no functional-update side effects.
        if (story) return;
        setStarted(st);
        setStory(s);
      },
      replace: (s, st) => {
        setStarted(st);
        setStory(s);
      },
      dispatch,
      toggleModule: (key) => {
        setStarted(true);
        setStory((s) => (s ? toggleModuleInStory(s, key) : s));
      },
    };
  }, [story, started]);

  return <StoryModelContext.Provider value={model}>{children}</StoryModelContext.Provider>;
}

/** Read the shared onboarding model. Throws if used outside the gate's provider. */
export function useStoryModel(): StoryModel {
  const model = useContext(StoryModelContext);
  if (!model) throw new Error('useStoryModel must be used within a StoryModelProvider');
  return model;
}
