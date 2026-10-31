'use client';

// Security: sign-in rules, the devices signed in now, and a record of who did what.
// One centered column, NOT EditorLayout: three self-contained cards in reading
// order, none a KPI worth a rail.

// The queries Refresh reloads (devices + activity) are owned HERE, so one control
// refreshes the whole pane. Two-step verification sits under the password because
// it answers the same question: how you prove it is you.

import { useState } from 'react';
import { Text } from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { PasswordCard } from './password-card';
import { TwoFactorCard } from './two-factor-card';
import { SessionsCard } from './sessions-card';
import { ActivityCard } from './activity-card';
import { ACTIVITY_PAGE, useActivity, useSessions, useSignInMethods } from './security-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

interface ListCardsProps {
  sessions: ReturnType<typeof useSessions>;
  activity: ReturnType<typeof useActivity>;
  activityLimit: number;
  onShowMore: () => void;
}

function ListCards({ sessions, activity, activityLimit, onShowMore }: ListCardsProps) {
  return (
    <>
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
        error={activity.error}
        isFetching={activity.isFetching}
        limit={activityLimit}
        refetch={() => {
          void activity.refetch();
        }}
        onShowMore={onShowMore}
      />
    </>
  );
}

// Read from the console's own account route: Better Auth's `useSession()` hit an
// endpoint this origin does not serve, so the badge read "Off" on accounts that
// had it on. See wizeworks/packages/auth/src/account-operations.ts.
function useTwoFactorEnabled(): boolean {
  const signIn = useSignInMethods();
  return signIn.data?.twoFactorEnabled === true;
}

export function SecuritySurface() {
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE);

  const sessions = useSessions();
  const activity = useActivity(activityLimit);
  const twoFactorEnabled = useTwoFactorEnabled();

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

          <ListCards
            sessions={sessions}
            activity={activity}
            activityLimit={activityLimit}
            onShowMore={() => {
              setActivityLimit((prev) => prev + ACTIVITY_PAGE);
            }}
          />
        </div>
      </div>
    </div>
  );
}
