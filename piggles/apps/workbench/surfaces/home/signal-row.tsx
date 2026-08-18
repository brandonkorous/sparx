'use client';

// One line of "what needs you", and the sentence inside it.

import { faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Text } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '@/lib/surfaces/registry';
import { ModuleScope } from '@/components/module-scope';
import type { AttentionCount } from '@/lib/console/home-data';
import type { Signal } from './signals';

/**
 * One line of "what needs you".
 *
 * The whole row is the door — a link at the end of a sentence is a smaller
 * target than the sentence, and there is nothing else on the row to click.
 */
export function SignalRow({
  signal,
  count,
  ctx,
}: {
  signal: Signal;
  count: AttentionCount;
  ctx: SurfaceContext;
}) {
  const glyph = signal.icon;
  const open = () => {
    ctx.open(signal.surface);
  };

  return (
    <ModuleScope module={signal.module as never}>
      <li className="border-base-300 border-b last:border-b-0">
        <button
          type="button"
          onClick={open}
          className="hover:bg-module hover:bg-soft flex w-full items-center gap-4 p-5 text-left transition-colors"
        >
          <span className="bg-module bg-soft text-module flex size-11 shrink-0 items-center justify-center rounded-full">
            <Icon glyph={glyph} className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <RowSentence signal={signal} count={count} />
          </span>
          <Icon glyph={faChevronRight} className="size-5 shrink-0" aria-hidden />
        </button>
      </li>
    </ModuleScope>
  );
}

/**
 * The sentence itself.
 *
 * Three shapes, and the two that are not a number say so plainly rather than
 * borrowing the shape of one. See the file header.
 */
function RowSentence({ signal, count }: { signal: Signal; count: AttentionCount }) {
  if (count.state === 'error') {
    return (
      <Text className="text-lg">
        We could not reach your {signal.noun} just now. Open them to try again.
      </Text>
    );
  }

  if (count.state === 'unknown') {
    // The endpoint answered without a total. There is no number to show and
    // inventing one is the failure this screen is built to avoid.
    return (
      <Text className="text-lg">
        We could not put a number on your {signal.noun}. Open them to look.
      </Text>
    );
  }

  const value = count.value ?? 0;
  return (
    <Text className="text-lg">
      <span className="text-module font-heading mr-1.5 text-2xl font-black tabular-nums">
        {value.toLocaleString()}
      </span>
      {value === 1 ? signal.one : signal.many}
    </Text>
  );
}
