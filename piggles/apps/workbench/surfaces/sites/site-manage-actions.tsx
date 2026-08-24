'use client';

// The chrome around the manage view: the toolbar, and the two rare moves that
// need a conversation before they happen.

import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { useWorkbench } from '../../lib/workbench/context';
import { useActivePropertyId, switchSite } from '../../lib/api/shell-data';
import { afterPaneChange } from '../../lib/defer';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDeleteSite, useMakePrimary, type Site } from './data';
import { SiteRareMoves } from './site-manage-scope';

export function ManageToolbar({
  site,
  dirty,
  saving,
  onSave,
  refresh,
}: {
  site: Site;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  refresh: React.ReactNode;
}) {
  const confirm = useConfirm();
  const { controller } = useWorkbench();
  const activeSiteId = useActivePropertyId();
  const isActive = site.id === activeSiteId;

  /**
   * Switching reloads the window, so it asks first when anything is unsaved —
   * INCLUDING the rename sitting in this very pane, which is the likeliest thing
   * at risk: someone types a new name, then reaches for "work on this site".
   */
  const onSwitch = async () => {
    if (controller.hasUnsavedWork()) {
      const ok = await confirm({
        title: `Switch to ${site.name}?`,
        description:
          'Something in this workspace has unsaved changes. Switching sites reloads the workbench and those changes will be lost.',
        confirmLabel: 'Switch anyway',
        cancelLabel: 'Stay here',
        color: 'warning',
      });
      if (!ok) return;
    }
    await switchSite(controller, activeSiteId ?? 'default', site.id);
  };

  return (
    <PaneToolbar
      label="Site actions"
      refresh={refresh}
      status={
        <>
          <div className="flex flex-wrap items-center gap-1">
            {site.isPrimary ? (
              <Badge color="module" variant="soft" size="sm">
                Primary
              </Badge>
            ) : null}
            {isActive ? (
              <Badge color="success" variant="soft" size="sm">
                You are here
              </Badge>
            ) : null}
          </div>
          <div className="flex-1" />
        </>
      }
      primary={
        <Button color="module" size="sm" disabled={!dirty || saving} onClick={onSave}>
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
      controls={
        isActive ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void onSwitch();
            }}
          >
            Work on this site
          </Button>
        )
      }
    />
  );
}

export function RareMoves({ ctx, site }: { ctx: SurfaceContext; site: Site }) {
  const toast = useToast();
  const confirm = useConfirm();
  const makePrimary = useMakePrimary(site.id);
  const remove = useDeleteSite(site.id);

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${site.name}?`,
      description:
        'Its pages, layouts, forms and web addresses are deleted with it. Orders and customers are kept, because they belong to the business rather than the site. This cannot be undone.',
      confirmLabel: 'Delete this site',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${site.name} deleted`, type: 'success' });
        });
      },
      onError: () => {
        toast.add({
          title: 'Could not delete this site',
          description: 'Nothing was removed.',
          type: 'error',
        });
      },
    });
  };

  return (
    <SiteRareMoves
      site={site}
      promoting={makePrimary.isPending}
      deleting={remove.isPending}
      onMakePrimary={() => {
        makePrimary.mutate(undefined, {
          onSuccess: () => {
            toast.add({ title: `${site.name} is now primary`, type: 'success' });
          },
          onError: () => {
            toast.add({ title: 'Could not change the primary site', type: 'error' });
          },
        });
      }}
      onDelete={() => {
        void onDelete();
      }}
    />
  );
}
