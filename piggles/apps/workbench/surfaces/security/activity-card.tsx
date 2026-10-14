'use client';

// The account's activity record: the HUMAN feed (api-rest /v1/activity), already in
// sentences with real names, so an owner can answer "did someone change my prices,
// and who?". Each row's badge colors the KIND of change so a long run is scannable.

// It grows in steps ("Show more") instead of paging: a recent-history view is
// skimmed from the top, and page numbers on a feed that only gets longer mislead.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Text,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { faClockRotateLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { FormSection } from '../../components/form-section';
import { loadFailureWords } from '../../lib/api-error';
import { ACTIVITY_MAX, activityKindLabel, activityTone, type ActivityEntry } from './security-data';
import { productName } from '../../lib/product';

/** Registry module for this surface, so the brand draws one consistent picture
 *  in its empty, waiting and failed states. */
const MODULE = 'platform';

interface ActivityCardProps {
  entries: ActivityEntry[] | undefined;
  isPending: boolean;
  isError: boolean;
  /** The failed read's error, so the message can say WHY it failed (issue 260). */
  error: unknown;
  isFetching: boolean;
  limit: number;
  refetch: () => void;
  onShowMore: () => void;
}

function ActivityFailed({ error, refetch }: { error: unknown; refetch: () => void }) {
  return (
    <Alert color="error">
      <AlertContent>
        <AlertTitle>Could not load your activity</AlertTitle>
        <AlertDescription>
          {loadFailureWords(
            error,
            'This is a problem reaching the server. Your account record is unaffected.'
          )}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button
          size="sm"
          color="error"
          variant="soft"
          onClick={() => {
            refetch();
          }}
        >
          Try again
        </Button>
      </AlertActions>
    </Alert>
  );
}

function ActivityRow({ entry, first }: { entry: ActivityEntry; first: boolean }) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${
        first ? '' : 'border-base-300 border-t'
      }`}
    >
      <Badge color={activityTone(entry.action)} variant="soft" size="sm" className="shrink-0">
        {activityKindLabel(entry.action)}
      </Badge>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">
          {entry.title}
          {entry.subject ? <span className="font-normal"> ({entry.subject})</span> : null}
        </span>
        <Text className="text-sm">
          {entry.actor.name ?? productName()} ·{' '}
          <Timestamp value={new Date(entry.at).getTime()} format="relative" />
        </Text>
      </div>
    </li>
  );
}

interface ActivityListProps {
  rows: ActivityEntry[];
  isFetching: boolean;
  limit: number;
  onShowMore: () => void;
}

function ActivityList({ rows, isFetching, limit, onShowMore }: ActivityListProps) {
  // The endpoint returns exactly `limit` rows when more exist, fewer when the
  // history runs out, so a full page is the signal there may be more to show.
  const mayHaveMore = rows.length >= limit && limit < ACTIVITY_MAX;
  return (
    <>
      <ul className="flex flex-col">
        {rows.map((entry, index) => (
          <ActivityRow key={entry.id} entry={entry} first={index === 0} />
        ))}
      </ul>

      {mayHaveMore ? (
        <div className="flex justify-center pt-1">
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            loading={isFetching}
            onClick={onShowMore}
          >
            Show more
          </Button>
        </div>
      ) : (
        <Text className="pt-1 text-center text-sm">
          {limit >= ACTIVITY_MAX
            ? 'Showing the most recent activity.'
            : 'That is everything so far.'}
        </Text>
      )}
    </>
  );
}

export function ActivityCard(props: ActivityCardProps) {
  const { isPending, isError, error, refetch } = props;
  const rows = props.entries ?? [];

  return (
    <FormSection
      title="Recent account activity"
      description="A record of the things people have done in your account, newest first. Only actions are listed here: simply looking at something is not."
    >
      {isError ? (
        <ActivityFailed error={error} refetch={refetch} />
      ) : isPending ? (
        <PaneWaiting module={MODULE} label="Loading your activity…" />
      ) : rows.length === 0 ? (
        /* No Card: the FormSection is one. <PaneEmpty> so this state draws the
           same kind of picture as the <PaneWaiting> beside it. */
        <PaneEmpty
          module={MODULE}
          icon={<Icon glyph={faClockRotateLeft} className="size-6" aria-hidden />}
          title="Nothing has happened yet"
          description="As you and your team work in your account, everything you do shows up here."
        />
      ) : (
        <ActivityList
          rows={rows}
          isFetching={props.isFetching}
          limit={props.limit}
          onShowMore={props.onShowMore}
        />
      )}
    </FormSection>
  );
}
