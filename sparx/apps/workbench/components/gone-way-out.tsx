'use client';

// The way out of a record that is gone (persona issue 267): the list it belongs
// to, in the same pane, or closing the pane when no list owns it. Shown by
// <PaneLoadError> when the screen gave no way out of its own.

import { Button } from '@wizeworks/silicaui-react';
import { useOptionalWorkbench } from '../lib/workbench/context';
import { usePaneId } from '../lib/workbench/pane-identity';
import { listFor } from '../lib/surfaces/list-for';
import { surfaceTitle } from '../lib/surfaces/registry';

export function GoneWayOut() {
  const workbench = useOptionalWorkbench();
  const paneId = usePaneId();
  if (!workbench || !paneId) return null;
  const { controller } = workbench;
  const surface = controller.snapshotDescriptors()[paneId]?.surface;
  const list = surface ? listFor(surface) : null;
  const title = list ? surfaceTitle(list) : null;

  if (list && title) {
    return (
      <Button
        size="sm"
        variant="outline"
        color="module"
        onClick={() => controller.open(list, {}, { target: 'replace', fromPaneId: paneId })}
      >
        Open {title}
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" color="module" onClick={() => controller.close(paneId)}>
      Close this
    </Button>
  );
}
