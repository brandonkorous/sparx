// PaneHost backed by dockview — the desktop arrangement.
//
// Everything dockview-specific that used to sit inside the controller lives
// here: panel config, grid positions, popout groups. The controller now only
// knows the PaneHost vocabulary, so this file is the ONLY place in the app that
// needs to know dockview exists (alongside dock.tsx, which mounts it).

import type { DockviewApi, DockviewPanelApi } from 'dockview';
import type { PaneDescriptor } from '../surfaces/descriptor';
import type { OpenTarget } from '../surfaces/registry';
import type {
  AddPaneOptions,
  DetachedWindow,
  PaneHost,
  PaneHostCapabilities,
} from '../workbench/pane-host';

export class DockPaneHost implements PaneHost {
  readonly capabilities: PaneHostCapabilities = { split: true, popout: true };

  constructor(private readonly api: DockviewApi) {}

  has(paneId: string): boolean {
    return this.api.getPanel(paneId) !== undefined;
  }

  add(descriptor: PaneDescriptor, title: string, options: AddPaneOptions): void {
    this.api.addPanel({
      id: descriptor.id,
      component: 'surface',
      // Opts this panel into our <PaneTab>. Registering `tabComponents` on
      // DockviewReact is NOT enough — without naming it here dockview silently
      // uses its built-in tab, which is why tabs rendered as bare text with no
      // icon and no module accent.
      tabComponent: 'surface',
      title,
      params: { paneId: descriptor.id },
      position: positionFor(options.target, options.fromPaneId),
      inactive: !options.focus,
    });
  }

  close(paneId: string): void {
    this.api.getPanel(paneId)?.api.close();
  }

  focus(paneId: string): void {
    this.api.getPanel(paneId)?.focus();
  }

  setTitle(paneId: string, title: string): void {
    this.api.getPanel(paneId)?.setTitle(title);
  }

  retarget(paneId: string, title: string): void {
    const panel = this.api.getPanel(paneId);
    if (!panel) return;
    panel.setTitle(title);
    // Bumping a parameter is what forces the pane to re-read its descriptor;
    // the id is unchanged on purpose, so the grid slot, size and tab order all
    // survive the retarget.
    panel.api.updateParameters({ paneId, revision: Date.now() });
  }

  serialize(): unknown {
    return this.api.toJSON();
  }

  popout(paneId: string): void {
    const panel = this.api.getPanel(paneId);
    if (!panel) return;
    const group = (panel.api as DockviewPanelApi & { group?: unknown }).group;
    if (!group) return;
    void this.api.addPopoutGroup(panel);
  }

  detachedWindows(): DetachedWindow[] {
    return this.api.groups
      .filter((group) => group.api.location.type === 'popout')
      .map((group) => ({
        id: group.id,
        paneIds: group.panels.map((panel) => panel.id),
        focus: () => {
          // getWindow() is only present on a popout location, which the filter
          // above already established — but the union doesn't narrow across the
          // map, so re-read it here.
          const location = group.api.location;
          if (location.type === 'popout') location.getWindow().focus();
        },
        // No `group` target: dockview then mints a fresh grid group for it,
        // which is what makes this work even when every pane is torn off and
        // the main grid is empty.
        redock: () => {
          group.api.moveTo({ position: 'right' });
        },
      }));
  }
}

function positionFor(
  target: OpenTarget,
  fromPaneId?: string
): { referencePanel: string; direction: 'right' | 'within' } | undefined {
  if (!fromPaneId) return undefined;
  if (target === 'beside') return { referencePanel: fromPaneId, direction: 'right' };
  if (target === 'tab') return { referencePanel: fromPaneId, direction: 'within' };
  return undefined;
}
