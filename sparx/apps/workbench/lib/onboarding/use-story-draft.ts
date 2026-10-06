'use client';

// Keeps the in-progress story saved, whichever editor is changing it.
//
// The story and the step-by-step wizard edit ONE model (use-story-model.tsx), and on
// a reload both rebuild the plan from the saved story. Only the story screen used to
// save it, so a module switched on in step-by-step was flagged on the tenant but
// missing from the story: the next load showed a $411 plan for a $440 setup, and the
// screen and the saved flags disagreed (sparx persona issue 009). Both editors now
// call this one hook.
//
// Debounced (~600ms) to coalesce rapid edits; only once the owner has made the story
// their own (`started`); paused after the in-page hand-off. A failed save never
// blocks editing, but it is not forgotten either: the story only counts as saved once
// the server says so, and a failure tries again a few seconds later. It used to be
// marked saved before the request went out, so one 503 lost the last three switches
// for good (sparx persona issue 009).

import { useEffect, useRef, useState } from 'react';
import type { StoryState } from '@wizeworks/story-schemas';
import { toPersistPayload, type StoryPayload } from './story-state';
import type { StoryModel } from './use-story-model';

export function useStoryDraftSave(
  model: StoryModel,
  save: (payload: StoryPayload) => Promise<unknown>,
  { initialStory, paused = false }: { initialStory: StoryState | null; paused?: boolean }
): void {
  const saved = useRef<string>(initialStory ? JSON.stringify(toPersistPayload(initialStory)) : '');
  // Bumped after a failed save, so the effect runs again with nothing else changed.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!model.story || !model.started || paused) return;
    const payload = toPersistPayload(model.story);
    const serial = JSON.stringify(payload);
    if (serial === saved.current) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      save(payload)
        .then(() => {
          saved.current = serial;
        })
        .catch(() => {
          retry = setTimeout(() => setAttempt((n) => n + 1), 3000);
        });
    }, 600);
    return () => {
      clearTimeout(timer);
      if (retry) clearTimeout(retry);
    };
  }, [model.story, model.started, paused, save, attempt]);
}
