'use client';

import { type ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import type { StoryState } from '../_lib/story-state';
import type { StoryExample } from '../_lib/story-examples';
import { StoryCanvas, type StoryDispatch } from './story-canvas';

// The compose phase's LEFT column. The story is ALWAYS the editable sentence canvas —
// tap any phrase to change it, add clauses, type your web address. Before the owner has
// made a template their own, a template picker sits above the canvas (each chip loads a
// starting point you then edit in place); the first edit promotes it to "your story" and
// the picker gives way to a quiet "Start over". There is no dead read-only preview: what
// you see is what you edit.
function cap(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function StoryComposeStage({
  started,
  story,
  examples,
  activeIdx,
  dispatch,
  onSelectTemplate,
  onStartBlank,
  onStartOver,
}: {
  started: boolean;
  /** The live, editable story (a template, a draft, or the owner's own). */
  story: StoryState;
  /** The starting-point templates to pick from (shown until the owner starts editing). */
  examples: StoryExample[];
  activeIdx: number;
  dispatch: StoryDispatch;
  onSelectTemplate: (idx: number) => void;
  onStartBlank: () => void;
  onStartOver: () => void;
}): ReactNode {
  if (started) {
    return (
      <div className="min-w-0">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Make it yours</h2>
          <p className="text-base-content/70 max-w-[58ch]">
            Tap any phrase to change it. Add as much as you want; there’s always room for more.
          </p>
        </div>
        <div className="mt-8">
          <StoryCanvas story={story} dispatch={dispatch} />
        </div>
        <div className="mt-6">
          <Button color="neutral" variant="link" size="sm" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-2.5">
        <h2 className="text-2xl font-semibold tracking-tight">What are you building?</h2>
        <p className="text-base-content/70 max-w-[58ch]">
          Say it the way you’d tell a friend — what you make, who it’s for, how they buy. Start from
          one of these and tap any phrase to make it your own, or write your own from scratch.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {examples.map((ex, i) => (
          <Button
            key={ex.label}
            color={i === activeIdx ? 'primary' : 'neutral'}
            variant={i === activeIdx ? 'solid' : 'outline'}
            size="sm"
            className="rounded-full"
            onClick={() => onSelectTemplate(i)}
            aria-pressed={i === activeIdx}
          >
            {cap(ex.label)}
          </Button>
        ))}
      </div>
      <div className="mt-2.5">
        <Button color="neutral" variant="link" size="sm" onClick={onStartBlank}>
          or start from a blank page
        </Button>
      </div>

      <div className="mt-7">
        <StoryCanvas story={story} dispatch={dispatch} />
      </div>
    </div>
  );
}
