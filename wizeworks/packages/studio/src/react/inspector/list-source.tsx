'use client';

// "What this list shows" — the source a repeating list draws from.
//
// Offered only for the sources the app lists (`host.listSources`), so an author picks
// between her own kinds of writing ("Articles", "Articles in Field") rather than typing
// a source name. The change is `retargetListOps`: the list, the "nothing here yet" line
// beside it, and any pager naming it, as one undoable edit.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import type { StudioDoc } from '../../documents/types';
import { listSourceOf, retargetListOps } from '../../tree/retarget-list';
import type { AddressableNode } from '../../tree/walk';
import { useApply, useDoc, useStudioHost } from '../context';
import { fieldKey } from './settings-tab';

export function ListSource({ node }: { node: AddressableNode }) {
  const host = useStudioHost();
  const apply = useApply();
  const doc = useDoc<StudioDoc>();
  const current = listSourceOf(node);
  const choices = current ? (host.listSources?.(current) ?? []) : [];
  if (!current || !node.id || choices.length < 2 || !('root' in doc)) return null;
  const id = node.id;
  const root = doc.root;

  return (
    <>
      <Field>
        <FieldLabel>What this list shows</FieldLabel>
        {/* Inside FieldControl, which is what ties the label to the select: a bare select
          under a FieldLabel has no name a screen reader can announce. */}
        <FieldControl
          key={fieldKey(id, 'list', current)}
          render={
            <NativeSelect
              defaultValue={current}
              onChange={(event) => {
                const ref = event.currentTarget.value;
                const label = choices.find((c) => c.ref === ref)?.label ?? 'list';
                apply(`Show ${label}`, retargetListOps(root, id, ref));
              }}
            >
              {choices.map((choice) => (
                <option key={choice.ref} value={choice.ref}>
                  {choice.label}
                </option>
              ))}
            </NativeSelect>
          }
        />
        <FieldDescription>
          Each card shows the headline, summary and picture of whichever you choose.
        </FieldDescription>
      </Field>
      <HowMany id={id} data={node.data} />
    </>
  );
}

const COUNTS = [1, 2, 3, 4, 6, 8, 12];

/**
 * How many the list shows, newest first. "All of them" pages the rest; a number is a
 * curation with no pager, which is how a front page leads with its newest piece: a list
 * of one above the others. The engine applies `limit` and the site fetches no more.
 */
function HowMany({ id, data }: { id: string; data: AddressableNode['data'] }) {
  const apply = useApply();
  if (data?.kind !== 'collection') return null;
  const current = data.limit ?? 0;
  return (
    <Field>
      <FieldLabel>How many</FieldLabel>
      <FieldControl
        key={fieldKey(id, 'limit', String(current))}
        render={
          <NativeSelect
            defaultValue={String(current)}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              const { limit: _old, ...rest } = data;
              apply(next ? `Show ${String(next)}` : 'Show all of them', [
                { kind: 'node.setData', id, value: next ? { ...rest, limit: next } : rest },
              ]);
            }}
          >
            <option value="0">All of them, a page at a time</option>
            {COUNTS.map((n) => (
              <option key={n} value={String(n)}>
                {n === 1 ? 'Just the newest one' : `The newest ${String(n)}`}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </Field>
  );
}
