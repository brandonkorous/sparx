// What the dashboards pane's two dialogs edit, and the pure steps that turn a
// draft into a write. The hooks in use-dashboard-board.ts and
// use-dashboard-widgets.ts call these.

import type { Dashboard, DashboardWidget } from './report-builder-data';

/** What the board dialog is editing. `null` when it is closed. */
export interface BoardDraft {
  mode: 'new' | 'edit';
  name: string;
  description: string;
  isDefault: boolean;
  shared: boolean;
}

/** Adding picks a report and may name it; renaming only changes the name,
 *  because moving a widget to another report is a remove plus an add. */
export type WidgetDraft =
  | { mode: 'add'; reportId: string; title: string }
  | { mode: 'rename'; widgetId: string; title: string };

export type WidgetPlacement = Omit<DashboardWidget, 'id' | 'report'>;

/** What the widgets write sends: where each one sits, never the report itself. */
export function placement(list: DashboardWidget[]): WidgetPlacement[] {
  return list.map((w) => ({
    reportId: w.reportId,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    title: w.title,
  }));
}

/** Blank means "none": a widget falls back to its report's name. */
export function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

/** The first board gets a suggested name and opens first. A later one is made
 *  for something in particular, so it starts blank and takes over nothing. */
export function newBoardDraft(boardCount: number): BoardDraft {
  return {
    mode: 'new',
    name: boardCount === 0 ? 'How we are doing' : '',
    description: '',
    isDefault: boardCount === 0,
    shared: true,
  };
}

export function editBoardDraft(board: Dashboard): BoardDraft {
  return {
    mode: 'edit',
    name: board.name,
    description: board.description ?? '',
    isDefault: board.isDefault,
    shared: board.shared,
  };
}

export function boardInput(draft: BoardDraft) {
  return {
    name: draft.name.trim(),
    description: blankToNull(draft.description),
    isDefault: draft.isDefault,
    shared: draft.shared,
  };
}

/** Says what a delete takes away: the board, never the reports on it. */
export function deleteBoardDescription(count: number): string {
  return count > 0
    ? `The ${String(count)} report${count === 1 ? '' : 's'} on it stay exactly as they are. This only removes the board they were arranged on.`
    : 'The reports it points at stay exactly as they are. This only removes the board.';
}
