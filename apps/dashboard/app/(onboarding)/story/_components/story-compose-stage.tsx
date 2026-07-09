'use client';

import { type ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import type { StoryState } from '../_lib/story-state';
import type { StoryExample } from '../_lib/story-examples';
import { StoryCanvas, type StoryDispatch } from './story-canvas';
import { StoryProse } from './story-prose';

// The compose phase's LEFT column. Until the owner starts their own, it shows a
// vision prompt + a DIRECT example picker (selectable chips — you see all four and
// pick one, no blind paging) over a read-only preview of the chosen example. Once
// started, it becomes the editable sentence canvas. The headline + supporting copy
// invite a story in the owner's words rather than "a sentence to fill in".
function cap(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function StoryComposeStage({
  started,
  story,
  examples,
  activeIdx,
  dispatch,
  onSelect,
  onStartBlank,
}: {
  started: boolean;
  /** The editable story (shown once started). */
  story: StoryState;
  /** The example stories to pick from (shown until started). */
  examples: StoryExample[];
  activeIdx: number;
  dispatch: StoryDispatch;
  onSelect: (idx: number) => void;
  onStartBlank: () => void;
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
      </div>
    );
  }

  const active = examples[activeIdx] ?? examples[0]!;
  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-2.5">
        <h2 className="text-2xl font-semibold tracking-tight">What are you building?</h2>
        <p className="text-base-content/70 max-w-[58ch]">
          Say it the way you’d tell a friend: what you make, who it’s for, how they buy. Each phrase
          you add switches on a module and builds your setup in real time. Here’s how a few others
          told theirs:
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
            onClick={() => onSelect(i)}
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
        <StoryProse story={active.story} />
      </div>
    </div>
  );
}
