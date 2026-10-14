'use client';

// The open board's body: its report cards on a 12-column grid, or an invitation
// to add the first one. Each card runs its saved report live.

import { Button, Card } from '@wizeworks/silicaui-react';
import { faGauge } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneEmpty } from '../../components/pane-empty';
import { ReportWidget } from './report-widget';
import type { WidgetEditing } from './use-dashboard-widgets';

/** Registry module for this pane, so the brand draws Customers' own picture. */
export const MODULE = 'crm';

/** Span to class, quantised because a runtime class is not in the stylesheet.
 *  Container queries, not viewport ones: a pane is as wide as it is dragged, and
 *  `PANE_SHELL` declares `@container`. Below `@3xl` every widget is full width. */
const SPAN: Record<number, string> = {
  1: '@3xl:col-span-1',
  2: '@3xl:col-span-2',
  3: '@3xl:col-span-3',
  4: '@3xl:col-span-4',
  5: '@3xl:col-span-5',
  6: '@3xl:col-span-6',
  7: '@3xl:col-span-7',
  8: '@3xl:col-span-8',
  9: '@3xl:col-span-9',
  10: '@3xl:col-span-10',
  11: '@3xl:col-span-11',
  12: '@3xl:col-span-12',
};

interface BoardBodyProps {
  ctx: SurfaceContext;
  editing: WidgetEditing;
  onAdd: () => void;
}

export function BoardBody({ ctx, editing, onAdd }: BoardBodyProps) {
  return (
    <div className="overflow-auto p-6">
      {editing.widgets.length === 0 ? (
        /* Carded, because the branch beside it is a grid of report CARDS: an
           uncarded empty board changed shape the moment the first widget landed. */
        <Card>
          <PaneEmpty
            module={MODULE}
            icon={<Icon glyph={faGauge} className="size-6" aria-hidden />}
            title="Nothing on this board yet"
            description="Add a report and it will appear here, running live every time you open it."
            actions={
              <Button color="module" onClick={onAdd}>
                Add a report
              </Button>
            }
          />
        </Card>
      ) : (
        <WidgetGrid ctx={ctx} editing={editing} />
      )}
    </div>
  );
}

function WidgetGrid({ ctx, editing }: { ctx: SurfaceContext; editing: WidgetEditing }) {
  const { widgets, setWidgetDraft, removeWidget, resizeWidget } = editing;
  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-12">
      {widgets.map((widget) => (
        <div key={widget.id} className={SPAN[widget.w] ?? '@3xl:col-span-6'}>
          <ReportWidget
            widget={widget}
            onOpen={() =>
              ctx.open('crm.report.builder', { id: widget.reportId }, { target: 'tab' })
            }
            onRename={() => {
              setWidgetDraft({
                mode: 'rename',
                widgetId: widget.id,
                title: widget.title ?? '',
              });
            }}
            onRemove={() => void removeWidget(widget.id)}
            onResize={(w) => void resizeWidget(widget.id, w)}
          />
        </div>
      ))}
    </div>
  );
}
