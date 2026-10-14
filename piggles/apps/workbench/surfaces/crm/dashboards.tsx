'use client';

// Dashboards (docs/144 §8): several saved reports on one screen. A board holds no
// numbers, only widgets that run their saved report live, so editing a report
// corrects every board it is on and nothing here drifts out of date.

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useReports } from './report-builder-data';
import { useActiveBoard, useBoardEditing } from './use-dashboard-board';
import { useWidgetEditing } from './use-dashboard-widgets';
import { BoardToolbar } from './dashboards-toolbar';
import { boardlessPane } from './dashboards-states';
import { BoardBody } from './dashboard-board-view';
import { BoardDialog } from './dashboard-board-dialog';
import { WidgetDialog } from './dashboard-widget-dialog';

export function DashboardsSurface({ ctx }: { ctx: SurfaceContext }) {
  const active = useActiveBoard(ctx);
  const editing = useBoardEditing(active);
  const widgets = useWidgetEditing(active.activeId, active.board?.widgets ?? []);
  const { data: reports } = useReports();
  const startAdding = (): void => {
    widgets.setWidgetDraft({ mode: 'add', reportId: '', title: '' });
  };
  const pane = boardlessPane(active, editing) ?? (
    <div className={PANE_SHELL}>
      <BoardToolbar active={active} editing={editing} onAdd={startAdding} />
      <BoardBody ctx={ctx} editing={widgets} onAdd={startAdding} />
      <WidgetDialog
        editing={widgets}
        reports={reports}
        boardShared={active.board?.shared ?? false}
      />
    </div>
  );
  // One board dialog for every state: "Make a dashboard" shows in all of them,
  // and loading and load-error had the button without it (issue 259).
  return (
    <>
      {pane}
      <BoardDialog editing={editing} />
    </>
  );
}
