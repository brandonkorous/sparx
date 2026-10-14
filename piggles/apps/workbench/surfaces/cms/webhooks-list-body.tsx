'use client';

// What the notifications card shows: a banner when a refresh failed over rows still
// on screen, else the first-load failure, the wait, the empty state, or the table.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { faPlus, faWebhook } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { loadFailureWords } from '../../lib/api-error';
import type { WebhookSubscription } from './webhooks-data';
import { WebhooksTable } from './webhooks-list-table';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'cms';

interface WebhooksBodyProps {
  error: unknown;
  isLoading: boolean;
  /** A refresh failed while rows from the last good load are still on screen. */
  staleAfterFailure: boolean;
  rows: WebhookSubscription[];
  filtered: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onOpen: (webhook: WebhookSubscription, event: { shiftKey: boolean; altKey: boolean }) => void;
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

function WebhooksEmpty({ filtered, onCreate }: { filtered: boolean; onCreate: () => void }) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={filtered}
      noResults={{
        icon: <Icon glyph={faWebhook} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description:
          'Nothing here has a name or address matching that. Clear the search to see them all.',
      }}
      firstRun={{
        title: 'Nothing is being told yet',
        description:
          'You can have us tell another system the moment something happens here: a page goes live, a file is uploaded, stock runs out. Useful when someone is building on top of your content and wants to know without having to keep checking.',
        actions: (
          <Button size="sm" color="module" onClick={onCreate}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Set one up
          </Button>
        ),
      }}
    />
  );
}

function WebhooksMain(props: WebhooksBodyProps) {
  const { error, staleAfterFailure } = props;
  if (error && !staleAfterFailure) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faWebhook} className="size-6" aria-hidden />}
        title="Could not load these"
        description="This is a problem reaching the server. Nothing you have set up has been changed or lost."
        error={error}
        onRetry={props.onRetry}
      />
    );
  }
  if (props.isLoading) return <PaneWaiting />;
  if (props.rows.length === 0) {
    return <WebhooksEmpty filtered={props.filtered} onCreate={props.onCreate} />;
  }
  return <WebhooksTable rows={props.rows} onOpen={props.onOpen} />;
}

export function WebhooksBody(props: WebhooksBodyProps) {
  return (
    <>
      {props.staleAfterFailure ? <StaleBanner error={props.error} onRetry={props.onRetry} /> : null}
      <WebhooksMain {...props} />
    </>
  );
}
