'use client';

// The widgets on the open board: add, rename, remove and resize. Every change
// rewrites the whole placement list, which is what the widgets endpoint takes.

import { useState } from 'react';

import { useSetWidgets, type DashboardWidget } from './report-builder-data';
import { blankToNull, placement, type WidgetDraft } from './dashboard-drafts';

export function useWidgetEditing(activeId: string | null, widgets: DashboardWidget[]) {
  const setWidgets = useSetWidgets(activeId ?? 'new');
  const [widgetDraft, setWidgetDraft] = useState<WidgetDraft | null>(null);

  async function addWidget(reportId: string, title: string): Promise<void> {
    // Appended below everything, half width: a new widget never lands on top of
    // something somebody arranged.
    const nextY = widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
    await setWidgets.mutateAsync([
      ...placement(widgets),
      { reportId, x: 0, y: nextY, w: 6, h: 4, title: blankToNull(title) },
    ]);
    setWidgetDraft(null);
  }

  async function renameWidget(widgetId: string, title: string): Promise<void> {
    const next = blankToNull(title);
    await setWidgets.mutateAsync(
      placement(widgets.map((w) => (w.id === widgetId ? { ...w, title: next } : w)))
    );
    setWidgetDraft(null);
  }

  async function removeWidget(widgetId: string): Promise<void> {
    await setWidgets.mutateAsync(placement(widgets.filter((w) => w.id !== widgetId)));
  }

  async function resizeWidget(widgetId: string, w: number): Promise<void> {
    await setWidgets.mutateAsync(
      placement(widgets.map((widget) => (widget.id === widgetId ? { ...widget, w } : widget)))
    );
  }

  return {
    widgets,
    widgetDraft,
    setWidgetDraft,
    saving: setWidgets.isPending,
    addWidget,
    renameWidget,
    removeWidget,
    resizeWidget,
  };
}

export type WidgetEditing = ReturnType<typeof useWidgetEditing>;
