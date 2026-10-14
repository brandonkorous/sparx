'use client';

// What the old-links card shows: a banner when a refresh failed over rows still on
// screen, else the first-load failure, the wait, the empty state, or the table.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { faPlus, faUpRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { loadFailureWords } from '../../lib/api-error';
import { RedirectsTable } from './redirects-table';
import type { Redirect } from './redirects-data';
import type { RemoveRedirect } from './redirects-remove';

/** Brand artwork for the empty state. */
const MODULE = 'cms';

interface RedirectsBodyProps {
  error: unknown;
  isLoading: boolean;
  /** A refresh failed while rows from the last good load are still on screen. */
  staleAfterFailure: boolean;
  filtered: Redirect[];
  narrowed: boolean;
  remove: RemoveRedirect;
  onRetry: () => void;
  onAdd: () => void;
  onOpen: (row: Redirect) => void;
}

function StaleBanner({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert color="warning" className="m-2">
      <AlertContent>
        <AlertTitle>Could not check for changes just now</AlertTitle>
        <AlertDescription>
          {loadFailureWords(
            error,
            'This is a problem reaching the server. What you see below is what loaded last, and may be out of date.'
          )}
        </AlertDescription>
      </AlertContent>
      <Button size="sm" color="warning" variant="soft" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

function RedirectsEmpty({ narrowed, onAdd }: { narrowed: boolean; onAdd: () => void }) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={narrowed}
      noResults={{
        icon: <Icon glyph={faUpRight} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description:
          'No old link matches what you searched or filtered for. Try part of an address, or switch the filter back to All.',
      }}
      firstRun={{
        title: 'No old links yet',
        description:
          'When you move or rename a page, an old link sends anyone still using the old address to the new one instead of a dead end. Add your first one, or import a whole list at once.',
        actions: (
          <Button size="sm" color="module" onClick={onAdd}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add an old link
          </Button>
        ),
      }}
    />
  );
}

function RedirectsMain(props: RedirectsBodyProps) {
  const { error, staleAfterFailure, remove } = props;
  if (error && !staleAfterFailure) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faUpRight} className="size-6" aria-hidden />}
        title="Could not load your old links"
        description="This is a problem reaching the server. None of your old links have been lost. They are still sending visitors on as before."
        error={error}
        onRetry={props.onRetry}
      />
    );
  }
  if (props.isLoading) return <PaneWaiting />;
  if (props.filtered.length === 0) {
    return <RedirectsEmpty narrowed={props.narrowed} onAdd={props.onAdd} />;
  }
  return (
    <RedirectsTable
      rows={props.filtered}
      onOpen={props.onOpen}
      onDelete={remove.onDelete}
      removingId={remove.removingId}
      busy={remove.busy}
    />
  );
}

export function RedirectsBody(props: RedirectsBodyProps) {
  return (
    <>
      {props.staleAfterFailure ? <StaleBanner error={props.error} onRetry={props.onRetry} /> : null}
      <RedirectsMain {...props} />
    </>
  );
}
