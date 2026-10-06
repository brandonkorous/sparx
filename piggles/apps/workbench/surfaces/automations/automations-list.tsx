'use client';

// The automations table: the rules that run your business while you are not looking. A standard
// list surface (sortable <Table> in a Card); columns disclose progressively with @container, never
// a viewport query, so a narrow pane on a wide monitor never shows six columns in 300px.

import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { RowOpenHint } from '../../components/row-open-hint';
import { ListBody } from './automations-list/list-body';
import { ListToolbar } from './automations-list/list-toolbar';
import { useAutomationsList } from './automations-list/use-automations-list';

export function AutomationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const list = useAutomationsList();
  const { rows } = list;

  return (
    <div className={PANE_SHELL}>
      <ListToolbar ctx={ctx} list={list} />
      <ListBody ctx={ctx} list={list} />
      {rows.length > 0 ? <RowOpenHint what="a rule to open it" /> : null}
    </div>
  );
}
