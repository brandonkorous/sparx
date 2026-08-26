'use client';

// The composer's toolbar: what state this draft is in, how many people it
// reaches, and the two things you can do with it.

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faCalendarClock, faFloppyDisk, faPaperPlane } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { peopleCount } from './broadcast-draft';
import type { useBroadcastCommit } from './broadcast-compose-writes';

export interface ComposeToolbarProps {
  commit: ReturnType<typeof useBroadcastCommit>;
  /** The three reference lists the form reads, for the one refresh button that
   *  reloads all of them. */
  lists: { isFetching: boolean; updatedAt: number | undefined; refresh: () => void };
  recipientCount: number | undefined;
  canSave: boolean;
  ready: boolean;
  dirty: boolean;
  saved: boolean;
  timing: 'now' | 'schedule';
  scheduleValid: boolean;
}

export function BroadcastComposeToolbar({
  commit,
  lists,
  recipientCount,
  canSave,
  ready,
  dirty,
  saved,
  timing,
  scheduleValid,
}: ComposeToolbarProps) {
  return (
    <PaneToolbar
      label="Broadcast composer actions"
      // The composer reads three lists off the server — audiences, designed
      // emails, the sending address — and each has an in-body "try refreshing"
      // message with nothing to press. This is that button.
      refresh={
        <RefreshButton
          isFetching={lists.isFetching}
          updatedAt={lists.updatedAt}
          onRefresh={lists.refresh}
        />
      }
      status={
        <>
          <Badge color="info" variant="soft" size="sm">
            Draft
          </Badge>
          {recipientCount !== undefined ? (
            <Text as="span" className="text-sm">
              {peopleCount(recipientCount)}
            </Text>
          ) : null}
        </>
      }
      primary={
        <Button
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          disabled={!canSave || commit.busy || (!dirty && saved)}
          loading={commit.saving && !commit.sending && !commit.scheduling}
          onClick={() => {
            void commit.saveDraft();
          }}
        >
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          Save draft
        </Button>
      }
      controls={
        timing === 'now' ? (
          <Button
            size="sm"
            color="module"
            className="shrink-0"
            disabled={!ready || commit.busy}
            loading={commit.sending}
            onClick={() => {
              void commit.sendNow();
            }}
          >
            <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
            Send now
          </Button>
        ) : (
          <Button
            size="sm"
            color="module"
            className="shrink-0"
            disabled={!ready || !scheduleValid || commit.busy}
            loading={commit.scheduling}
            onClick={() => {
              void commit.scheduleFor();
            }}
          >
            <Icon glyph={faCalendarClock} className="size-4" aria-hidden />
            Schedule
          </Button>
        )
      }
    />
  );
}
