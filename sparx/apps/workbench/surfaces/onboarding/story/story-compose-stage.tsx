'use client';

import { type ReactNode } from 'react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import type { StoryExample } from '@wizeworks/story-schemas';
import type { StoryState } from '../../../lib/onboarding/story-state';
import { StoryCanvas, type StoryDispatch } from './story-canvas';

// The compose phase's LEFT column. The story is ALWAYS the editable sentence canvas —
// tap any phrase to change it, add clauses, type your web address. The starting-point
// templates sit above it and STAY there the whole time (not just before the first
// edit): they're the clear, constant way back if the owner gets lost — pick a fresh
// template or a blank page to begin again. Picking one mid-story confirms first (the
// composer guards it), so the escape hatch can't wipe work by accident.

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
}: {
  started: boolean;
  /** The live, editable story (a template, a draft, or the owner's own). */
  story: StoryState;
  /** The starting-point templates — always shown, the persistent way back. */
  examples: StoryExample[];
  activeIdx: number;
  dispatch: StoryDispatch;
  onSelectTemplate: (idx: number) => void;
  onStartBlank: () => void;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <Heading level={2} className="text-2xl font-semibold tracking-tight">
          {started ? 'Make it yours' : 'So, what’s your story?'}
        </Heading>
        <Text className="max-w-[58ch] text-base">
          {started
            ? 'Tap any phrase to change it, and add as much as you want — there’s always room for more. Changed your mind? Pick a different starting point below to begin again.'
            : 'Tell it the way you’d tell a friend — what you make, who it’s for, and how they buy from you. Say as little or as much as you like, and we’ll build everything it takes to run it. Start from one of these, or begin with a blank page.'}
        </Text>
      </div>

      {/* Starting points — always here, so the templates and the blank-page escape hatch
          stay a clear, constant route back. The active one is highlighted so the owner
          can always see where they began. */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
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
        <div>
          <Button color="neutral" variant="link" size="sm" onClick={onStartBlank}>
            or start from a blank page
          </Button>
        </div>
      </div>

      <StoryCanvas story={story} dispatch={dispatch} />
    </div>
  );
}
