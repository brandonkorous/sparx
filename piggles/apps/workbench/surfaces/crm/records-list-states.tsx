'use client';

// Everything a record type's list can show in its card besides its rows, and the
// two cases where it shows no list at all. Moved out of records-list.tsx (sparx
// persona issue 240) unchanged, except `RecordTypeMissing`, which is new.

import { Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { faPlus, faTable } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { ListEmptyState } from '../../components/list-empty-state';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { recordErrorMessage } from './records-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
export const MODULE = 'crm';

const GLYPH = <Icon glyph={faTable} className="size-6" aria-hidden />;

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * A BUILT-IN OBJECT HAS ITS OWN SCREEN, AND THIS IS NOT IT.
 *
 * `crm_records` holds tenant-invented objects only. Addressed with a built-in
 * key — `/crm/records/contact` — this pane drew a working, permanently empty
 * list: "No customers yet · 0 in total", on a shop with forty of them, under a
 * sentence telling her she had made the idea up herself. Every word of it was
 * false, and the fact that makes it false was already on the record the pane
 * had fetched: `kind: 'builtin'`.
 * [[feedback_fetched_but_never_rendered]] [[feedback_never_present_absence_as_measurement]]
 *
 * A `target` of undefined still gets the refusal, just without a way through,
 * because being sent nowhere is better than being told a number that is not true.
 */
export function BuiltinScreen(props: {
  labelPlural: string;
  target: string | undefined;
  onOpen: (target: string, event: OpenEvent) => void;
}) {
  const { labelPlural, target } = props;
  return (
    <div className={PANE_SHELL}>
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PaneEmpty
          module={MODULE}
          icon={GLYPH}
          title={`${labelPlural} have a screen of their own`}
          description={`This screen lists the things you chose to track yourself. ${labelPlural} came with Piggles, so they live on their own screen with everything that only they can do.`}
          {...(target
            ? {
                actions: (
                  <Button
                    color="module"
                    onClick={(event) => {
                      props.onOpen(target, event);
                    }}
                  >
                    Open {labelPlural}
                  </Button>
                ),
              }
            : {})}
        />
      </Card>
    </div>
  );
}

/** A type that is not there (deleted, or another business's) says so. It drew a
 *  working list with an Add button and "You made this up yourself" for a type
 *  with no definition at all (sparx persona issue 240). */
export function RecordTypeMissing({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={PANE_SHELL}>
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PaneLoadError
          module={MODULE}
          icon={GLYPH}
          error={error}
          noun="record type"
          title="Could not load this record type"
          description="This is a problem reaching the server. Your records are unaffected. Try again in a moment."
          onRetry={onRetry}
        />
      </Card>
    </div>
  );
}

export function RecordsLoadError(props: {
  labelPlural: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      icon={GLYPH}
      title={`Could not load these ${props.labelPlural.toLowerCase()}`}
      description={recordErrorMessage(
        props.error,
        'Something went wrong reaching the server. It may be a temporary problem. Try again in a moment.'
      )}
      actions={
        <Button size="sm" color="module" onClick={props.onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export function NoRecords(props: {
  label: string;
  labelPlural: string;
  filtered: boolean;
  onClear: () => void;
  onAdd: (event: OpenEvent) => void;
}) {
  const { label, labelPlural } = props;
  return (
    <ListEmptyState
      module={MODULE}
      filtered={props.filtered}
      noResults={{
        icon: GLYPH,
        title: `No ${labelPlural.toLowerCase()} match that search`,
        description: 'Try a different word, or clear the search to see them all.',
        actions: (
          <Button size="sm" color="module" variant="soft" onClick={props.onClear}>
            Clear the search
          </Button>
        ),
      }}
      firstRun={{
        // The tenant invented this type, so the welcome is about the thing
        // they invented — in their word for it, not "records".
        title: `No ${labelPlural.toLowerCase()} yet`,
        description: `You made this up yourself, which means nobody else's software has it. Add the first ${label.toLowerCase()} and it will show here, with its own search, its own saved views, and a page of its own.`,
        actions: (
          <Button size="sm" color="module" onClick={props.onAdd}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add the first {label.toLowerCase()}
          </Button>
        ),
      }}
    />
  );
}
