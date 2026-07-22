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
// growing its own. Password change is a mutation with no list to refresh, so it
// stays entirely inside its card.
//
// Two-step verification is named honestly and nothing more: the platform has no
// second-factor system yet, so this promises nothing it cannot do — no toggle,
// no dead "Enable" button, just what is coming and why it is not here.

import { useEffect, useState } from 'react';
import { Heading, Text } from '@wizeworks/silicaui-react';
import { Clock } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PasswordCard } from './password-card';
import { SessionsCard } from './sessions-card';
import { ActivityCard } from './activity-card';
import { ACTIVITY_PAGE, useActivity, useSessions } from './security-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function SecuritySurface({ ctx }: { ctx: SurfaceContext }) {
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE);

  const sessions = useSessions();
  const activity = useActivity(activityLimit);

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
      <PaneToolbar label="Security actions">
        <RefreshButton
          className="ml-auto"
          isFetching={isFetching}
          updatedAt={updatedAt}
          onRefresh={refreshAll}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="text-2xl font-semibold">
              Security
            </Heading>
            <Text>
              How you sign in, the devices signed in right now, and a record of what has been done
              in your account.
            </Text>
          </div>

          <PasswordCard />

          <FormSection title="Two-step verification">
            <div className="flex items-start gap-3">
              <Clock className="text-base-content mt-0.5 size-5 shrink-0" aria-hidden />
              <Text className="text-sm">
                Two-step verification asks for a second thing — a code from your phone — on top of
                your password, so knowing your password alone is not enough to sign in. It is not
                available in sparx yet. When it is, you will turn it on from here; until then, a
                strong, unique password and signing out devices you do not recognise are your best
                protection.
              </Text>
            </div>
          </FormSection>

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
