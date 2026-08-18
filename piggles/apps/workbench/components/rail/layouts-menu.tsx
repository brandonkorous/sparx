'use client';

// Saved arrangements: what is open, how it is split, at what size.
//
// Opening one replaces the live arrangement wholesale, so all three actions here
// go through the same door as a site switch — confirm unsaved work first, write
// the arrangement as the site's current layout, restart the window.

import { useEffect, useState } from 'react';
import { faGrid, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarItem,
  Tooltip,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '@/lib/confirm';
import { afterMenuClose, deferTick } from '@/lib/defer';
import { useWorkbench } from '@/lib/workbench/context';
import {
  clearLayout,
  deleteWorkspace,
  listWorkspaces,
  saveLayout,
  saveWorkspace,
  type NamedWorkspace,
} from '@/lib/workbench/persistence';
import { clearModeLayouts } from '@/lib/mode-layouts';
import { readWindowMode, writeWindowMode } from '@/lib/window-mode';
import { coerceZoom, readZoom, writeZoom } from '@/lib/window-zoom';
import { SaveLayoutDialog } from './save-layout-dialog';

export function LayoutsMenu({ siteKey, expanded }: { siteKey: string; expanded: boolean }) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const toast = useToast();

  // STATE, not a render-time localStorage read — a read during render never
  // updates, so a workspace saved a second ago would not appear until something
  // unrelated re-rendered the rail.
  const [workspaces, setWorkspaces] = useState<NamedWorkspace[]>([]);
  useEffect(() => {
    setWorkspaces(listWorkspaces());
  }, []);
  const [saveOpen, setSaveOpen] = useState(false);

  // Opening a workspace replaces the live arrangement wholesale, so it goes
  // through the same door as a site switch: confirm unsaved work, write the
  // saved arrangement as the site's current layout, restart the window.
  const restoreWorkspace = async (workspace: NamedWorkspace) => {
    // Let the menu finish closing before any dialog opens — see lib/defer.ts.
    await deferTick();
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: `Open "${workspace.name}" over unsaved changes?`,
        description:
          'Something here has edits that were never saved. Opening a saved layout reloads the page and those edits are gone.',
        confirmLabel: 'Open it',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    saveLayout(siteKey, workspace.grid, workspace.panes);
    // The boxes in that grid were measured in a particular presentation at a
    // particular zoom. Restoring them into a different one is what made a 50%
    // arrangement come back half size — so the presentation is part of what is
    // restored, and the reload below picks both up. Arrangements saved before
    // this existed carry neither, and are left in whatever is on screen.
    const zoom = coerceZoom(workspace.zoom);
    if (zoom) writeZoom(zoom);
    if (workspace.mode === 'windows' || workspace.mode === 'tabs') {
      writeWindowMode(workspace.mode);
    }
    window.location.reload();
  };

  const removeWorkspace = async (workspace: NamedWorkspace) => {
    await deferTick();
    const ok = await confirm({
      title: `Delete the "${workspace.name}" layout?`,
      description:
        'Only the saved arrangement is deleted — nothing that was open in it is touched. There is no undo.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    deleteWorkspace(workspace.id);
    setWorkspaces(listWorkspaces());
  };

  const resetToEmpty = async () => {
    await deferTick();
    const ok = await confirm({
      title: 'Close everything and start empty?',
      description: controller.hasUnsavedWork()
        ? 'Something here has unsaved edits — starting empty discards them. There is no undo.'
        : 'Everything open closes and the page reloads empty. Your saved layouts are not affected.',
      confirmLabel: 'Start empty',
      cancelLabel: 'Keep what I have',
      color: 'danger',
    });
    if (!ok) return;
    clearLayout(siteKey);
    // The other presentation's remembered arrangement goes too. Left behind, the
    // first flick of the windows/tabs toggle would deal an empty workspace an
    // arrangement from before it was emptied — and "start empty" has to mean it
    // in both presentations, not just the one you happened to be looking at.
    clearModeLayouts(siteKey);
    window.location.reload();
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip content="Saved layouts" side="right" disabled={expanded}>
          <DropdownMenuTrigger>
            <SidebarItem
              icon={<Icon glyph={faGrid} className="size-5" aria-hidden />}
              aria-label="Saved layouts"
            >
              Layouts
            </SidebarItem>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent side="right" align="end">
          {/* Base UI requires a label to live inside a Group — a bare
                  DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Saved layouts</DropdownMenuLabel>
            {workspaces.length === 0 ? (
              <DropdownMenuItem disabled>Nothing saved yet</DropdownMenuItem>
            ) : (
              workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => {
                    void restoreWorkspace(workspace);
                  }}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                    {/* Delete rides inside the row. stopPropagation keeps
                            the row's restore from firing on the same click. */}
                    <Button
                      color="danger"
                      variant="ghost"
                      size="xs"
                      shape="square"
                      aria-label={`Delete the ${workspace.name} layout`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeWorkspace(workspace);
                      }}
                    >
                      <Icon glyph={faTrashCan} className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              afterMenuClose(() => {
                setSaveOpen(true);
              });
            }}
          >
            Save this arrangement…
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void resetToEmpty();
            }}
          >
            Close everything and start empty
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveLayoutDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSave={(name) => {
          saveWorkspace(
            name,
            controller.serializeGrid(),
            { ...controller.snapshotDescriptors() },
            // Read rather than passed down: these ARE the live preferences, so
            // there is no prop to drift out of step with what is on screen.
            { zoom: readZoom(), mode: readWindowMode() ?? 'tabs' }
          );
          setWorkspaces(listWorkspaces());
          toast.add({
            title: 'Layout saved',
            description: `"${name}" is under Layouts whenever you want this arrangement back.`,
            type: 'success',
          });
        }}
      />
    </>
  );
}
