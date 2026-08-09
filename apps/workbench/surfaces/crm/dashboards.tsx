'use client';

// Dashboards (docs/144 §8) — several saved reports on one screen.
//
// A board holds no numbers and no definitions: each widget points at a saved
// report and runs it live. That is why editing a report corrects every board it
// appears on, and why nothing here can drift out of date.
//
// Widgets are placed on a 12-column grid in SPANS, not pixels, so the same board
// collapses to one column on a phone without a second layout. On a narrow screen
// every widget is full width — a two-column board on a 380px screen is two
// unreadable columns, not a compact one.

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  EmptyState,
  Field,
  FieldLabel,
  Select,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { LayoutDashboard, Plus } from 'lucide-react';

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import {
  useCreateDashboard,
  useDashboards,
  useDashboard,
  useLandingDashboard,
  useReports,
  useSetWidgets,
  type DashboardWidget,
} from './report-builder-data';
import { ReportWidget } from './report-widget';

/** Column span → a Tailwind class. Quantised rather than computed, because a
 *  class assembled at runtime is not in the stylesheet Tailwind generated. */
const SPAN: Record<number, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  10: 'lg:col-span-10',
  11: 'lg:col-span-11',
  12: 'lg:col-span-12',
};

export function DashboardsSurface({ ctx }: { ctx: SurfaceContext }) {
  const paramId = typeof ctx.params.id === 'string' ? ctx.params.id : null;
  const landing = useLandingDashboard();
  const { data: boards, isFetching, refetch } = useDashboards();
  const toast = useToast();

  // Which board is open: the one addressed, else the tenant's landing board.
  const [activeId, setActiveId] = useState<string | null>(paramId);
  useEffect(() => {
    if (!activeId && landing.data) setActiveId(landing.data.id);
  }, [activeId, landing.data]);

  const { data: board } = useDashboard(activeId ?? 'new');
  const { data: reports } = useReports();
  const setWidgets = useSetWidgets(activeId ?? 'new');
  const createDashboard = useCreateDashboard();

  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState('');

  useEffect(() => {
    ctx.setTitle(board?.name ?? 'Dashboards');
  }, [ctx, board]);

  const widgets = board?.widgets ?? [];

  function placement(list: DashboardWidget[]): Omit<DashboardWidget, 'id' | 'report'>[] {
    return list.map((w) => ({
      reportId: w.reportId,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      title: w.title,
    }));
  }

  async function addWidget(reportId: string): Promise<void> {
    // Appended below everything, half width — a new widget should never land on
    // top of something somebody arranged.
    const nextY = widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
    await setWidgets.mutateAsync([
      ...placement(widgets),
      { reportId, x: 0, y: nextY, w: 6, h: 4, title: null },
    ]);
    setAdding(false);
    setPick('');
  }

  async function removeWidget(widgetId: string): Promise<void> {
    await setWidgets.mutateAsync(placement(widgets.filter((w) => w.id !== widgetId)));
  }

  async function resizeWidget(widgetId: string, w: number): Promise<void> {
    await setWidgets.mutateAsync(
      placement(widgets.map((widget) => (widget.id === widgetId ? { ...widget, w } : widget)))
    );
  }

  async function makeFirstBoard(): Promise<void> {
    const created = await createDashboard.mutateAsync({
      name: 'How we are doing',
      isDefault: true,
      shared: true,
    });
    setActiveId(created.id);
    toast.add({ title: 'Board created — add a report to it.', type: 'success' });
  }

  if (landing.isPending) {
    return (
      <div className={PANE_SHELL}>
        <div className="skeleton m-6 h-64" />
      </div>
    );
  }

  if (!landing.data && !activeId) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={<LayoutDashboard className="size-6" aria-hidden />}
            title="No dashboard yet"
            description="A dashboard puts the reports you check often on one screen, kept up to date automatically."
            actions={
              <Button color="module" onClick={() => void makeFirstBoard()}>
                Create one
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Dashboard controls">
        {(boards?.items.length ?? 0) > 1 ? (
          <Select
            color="module"
            aria-label="Which dashboard"
            value={activeId ?? ''}
            items={Object.fromEntries((boards?.items ?? []).map((b) => [b.id, b.name]))}
            onValueChange={(next) => setActiveId(next as string)}
          />
        ) : (
          <Text>{board?.name ?? ''}</Text>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button color="module" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add a report
          </Button>
          <RefreshButton isFetching={isFetching} onRefresh={() => void refetch()} />
        </div>
      </PaneToolbar>

      <div className="overflow-auto p-6">
        {widgets.length === 0 ? (
          <EmptyState
            icon={<LayoutDashboard className="size-6" aria-hidden />}
            title="Nothing on this board yet"
            description="Add a report and it will appear here, running live every time you open it."
            actions={
              <Button color="module" onClick={() => setAdding(true)}>
                Add a report
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {widgets.map((widget) => (
              <div key={widget.id} className={SPAN[widget.w] ?? 'lg:col-span-6'}>
                <ReportWidget
                  widget={widget}
                  onOpen={() =>
                    ctx.open('crm.report.builder', { id: widget.reportId }, { target: 'tab' })
                  }
                  onRemove={() => void removeWidget(widget.id)}
                  onResize={(w) => void resizeWidget(widget.id, w)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogTitle>Add a report to this board</DialogTitle>
          <Field>
            <FieldLabel>Which report</FieldLabel>
            <Select
              color="module"
              value={pick}
              items={Object.fromEntries((reports?.items ?? []).map((r) => [r.id, r.name]))}
              onValueChange={(next) => setPick(next as string)}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button color="neutral" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              color="module"
              disabled={!pick || setWidgets.isPending}
              onClick={() => void addWidget(pick)}
            >
              Add it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
