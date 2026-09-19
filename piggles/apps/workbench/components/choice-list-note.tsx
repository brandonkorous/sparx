'use client';

// The note under a chooser whose options come from a fetch.
//
// A component rather than a call at each site because the mistake it fixes is a
// SHAPE, and the shape was written three times: `query.data?.items ?? []`,
// `.length === 0`, and a sentence about the owner's business underneath. The
// words and the decision live in `lib/choice-list-note.ts`, which the node test
// seat can reach; this is only where they are drawn.

import { FieldDescription } from '@wizeworks/silicaui-react';

import {
  choiceListNote,
  type ChoiceListState,
  type ChoiceListWords,
} from '../lib/choice-list-note';

export function ChoiceListNote({
  state,
  words,
}: {
  state: ChoiceListState;
  words: ChoiceListWords;
}) {
  const note = choiceListNote(state, words);
  return note === null ? null : <FieldDescription>{note}</FieldDescription>;
}

/** The shape every caller builds from a react-query result. */
export function choiceListState(query: {
  isPending: boolean;
  isError: boolean;
  data?: { items?: unknown[] } | undefined;
}): ChoiceListState {
  return {
    isPending: query.isPending,
    isError: query.isError,
    count: (query.data?.items ?? []).length,
  };
}
