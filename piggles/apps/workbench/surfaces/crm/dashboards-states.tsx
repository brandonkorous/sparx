'use client';

// The dashboards pane before it has a board to draw: still loading, could not
// load, no board yet, and a board that is not there.

import type { ReactNode } from 'react';
import { Button, Card } from '@wizeworks/silicaui-react';
import { faGauge } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PANE_SHELL } from '../../components/pane-toolbar';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { BoardlessToolbar } from './dashboards-toolbar';
import { MODULE } from './dashboard-board-view';
import type { ActiveBoard, BoardEditing } from './use-dashboard-board';

interface StateProps {
  active: ActiveBoard;
  editing: BoardEditing;
}

export function DashboardsLoading({ active, editing }: StateProps) {
  return (
    <div className={PANE_SHELL}>
      <BoardlessToolbar active={active} onNew={editing.startNewBoard} />
      <div className="skeleton m-6 h-64" />
    </div>
  );
}

/** A failed read is not "you have no boards": two facts, two answers. */
export function DashboardsLoadError({ active, editing }: StateProps) {
  return (
    <div className={PANE_SHELL}>
      <BoardlessToolbar active={active} onNew={editing.startNewBoard} />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PaneLoadError
          icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
          title="Could not load your dashboards"
          description="This is a problem reaching the server. Every board you have built is unaffected."
          error={active.landing.error}
          onRetry={() => {
            void active.landing.refetch();
            void active.boards.refetch();
          }}
        />
      </Card>
    </div>
  );
}

export function NoDashboardYet({ active, editing }: StateProps) {
  return (
    <div className={PANE_SHELL}>
      <BoardlessToolbar active={active} onNew={editing.startNewBoard} />
      {/* The card is the pane's content region, the same one a board of report
          cards fills. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <PaneEmpty
          module={MODULE}
          icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
          title="No dashboard yet"
          description="A dashboard puts the reports you check often on one screen, kept up to date automatically."
          actions={
            <Button color="module" onClick={editing.startNewBoard}>
              Create one
            </Button>
          }
        />
      </Card>
    </div>
  );
}

/** A board that is not there (removed, or another business's id) says so,
 *  rather than drawing an empty board that looks like yours (persona issue 226). */
export function DashboardMissing({ active }: { active: ActiveBoard }) {
  const { boardQuery, setActiveId } = active;
  return (
    <div className={PANE_SHELL}>
      <PaneLoadError
        error={boardQuery.error}
        noun="dashboard"
        title="Could not load this dashboard"
        description="This is a problem reaching the server. The dashboard itself is unaffected. Try again in a moment."
        onRetry={() => {
          void boardQuery.refetch();
        }}
        actions={
          <Button
            variant="outline"
            color="module"
            onClick={() => {
              setActiveId(null);
            }}
          >
            Show my dashboards
          </Button>
        }
      />
    </div>
  );
}

/** The pane for a state with no board to draw, or null when there is one. */
export function boardlessPane(active: ActiveBoard, editing: BoardEditing): ReactNode {
  const { landing, activeId, boardQuery } = active;
  if (landing.isPending) return <DashboardsLoading active={active} editing={editing} />;
  if (landing.isError && !landing.data && !activeId) {
    return <DashboardsLoadError active={active} editing={editing} />;
  }
  if (!landing.data && !activeId) return <NoDashboardYet active={active} editing={editing} />;
  if (activeId !== null && boardQuery.isError) return <DashboardMissing active={active} />;
  return null;
}
