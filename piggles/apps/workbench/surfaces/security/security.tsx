'use client';

// Security — sign-in rules, the devices currently signed in, and a record of
// who did what.
//
// One centred column, deliberately NOT EditorLayout: this is not a form with a
// summary rail, it is three self-contained concerns stacked in reading order —
// the password you sign in with, the devices that are in right now, and the
// history of what has been done. Each is its own card; none is a KPI worth a
// rail.
//
// The queries the toolbar's Refresh reloads (devices + activity) are owned HERE
// and passed down, so one control refreshes the whole pane rather than each card
// growing its own. Password change and two-step verification are mutations with
// no list to refresh, so they stay entirely inside their cards.
//
// Two-step verification sits directly under the password because it is the same
// question — how you prove it is you — and reads as the answer to the weakness
// the card above it has.

import { useEffect, useState } from 'react';
import { Text } from '@wizeworks/silicaui-react';
import { useSession } from '@wizeworks/auth/client';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PasswordCard } from './password-card';
import { TwoFactorCard } from './two-factor-card';
import { SessionsCard } from './sessions-card';
import { ActivityCard } from './activity-card';
import { ACTIVITY_PAGE, useActivity, useSessions } from './security-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function SecuritySurface({ ctx }: { ctx: SurfaceContext }) {
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE);

  const sessions = useSessions();
  const activity = useActivity(activityLimit);

  // Whether two-step verification is on is a fact about the SESSION's user, not
  // a separate fetch — Better Auth carries `twoFactorEnabled` on the user and
  // re-issues the session when the flag flips, so reading it here keeps the card
  // honest without a query that could disagree with the cookie.
  const { data: session } = useSession();
  const twoFactorEnabled =
    (session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled === true;

  useEffect(() => {
    ctx.setTitle('Security');
  }, [ctx]);

  const refreshAll = () => {
    void sessions.refetch();
    void activity.refetch();
  };
  const isFetching = sessions.isFetching || activity.isFetching;
  const updatedAt = Math.max(sessions.dataUpdatedAt, activity.dataUpdatedAt) || undefined;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Security actions"
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={refreshAll} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text>
            How you sign in, the devices signed in right now, and a record of what has been done in
            your account.
          </Text>

          <PasswordCard />

          <TwoFactorCard enabled={twoFactorEnabled} />

          <SessionsCard
            sessions={sessions.data}
            isPending={sessions.isPending}
            isError={sessions.isError}
            refetch={() => {
              void sessions.refetch();
            }}
          />

          <ActivityCard
            entries={activity.data}
            isPending={activity.isPending}
            isError={activity.isError}
            isFetching={activity.isFetching}
            limit={activityLimit}
            refetch={() => {
              void activity.refetch();
            }}
            onShowMore={() => {
              setActivityLimit((prev) => prev + ACTIVITY_PAGE);
            }}
          />
        </div>
      </div>
    </div>
  );
}
