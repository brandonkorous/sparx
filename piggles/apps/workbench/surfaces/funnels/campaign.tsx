'use client';

// One campaign — set it up, turn it on, and read how it is doing.
//
// A PANE, and creating one is the same pane with `{id:'new'}`. The report sits
// ABOVE the setup because a campaign is configured once and looked at for months.

import { useEffect } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { faArrowProgress } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useViewer } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CampaignActions } from './campaign-actions';
import { useCampaignDraft } from './campaign-draft';
import { NewCampaign } from './campaign-new';
import { ReportPanel } from './campaign-report';
import { CampaignSetup } from './campaign-setup';
import { funnelErrorMessage, useDeleteFunnel, useFunnel, useUpdateFunnel } from './data';
import { canEditCampaigns } from './presentation';

export function CampaignSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  if (id === 'new') return <NewCampaign ctx={ctx} />;
  return <ExistingCampaign ctx={ctx} id={id} />;
}

function ExistingCampaign({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const funnel = useFunnel(id);
  const canEdit = canEditCampaigns(useViewer().data?.role);
  const update = useUpdateFunnel(id);
  const remove = useDeleteFunnel();
  const toast = useToast();
  const confirm = useConfirm();
  const draft = useCampaignDraft(funnel.data);

  useDirtySource(canEdit && draft.changed, 'This campaign has unsaved changes. Close anyway?');

  const title = funnel.data?.name;
  useEffect(() => {
    if (title) ctx.setTitle(title);
  }, [title, ctx]);

  if (funnel.isPending) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting module="funnels" />
      </div>
    );
  }

  if (funnel.isError || !funnel.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          module="funnels"
          title="Could not open this campaign"
          description={funnelErrorMessage(
            funnel.error,
            'It may have been deleted, or this is a problem reaching the server.'
          )}
          onRetry={() => {
            void funnel.refetch();
          }}
        />
      </div>
    );
  }

  const current = funnel.data;

  const save = () => {
    update.mutate(
      {
        name: draft.name,
        description: draft.description || null,
        stages: draft.stages,
        goal: draft.hasGoal ? draft.goal : null,
      },
      { onSuccess: () => toast.add({ title: 'Campaign saved', type: 'success' }) }
    );
  };

  const setRunning = (next: boolean) => {
    update.mutate(
      { status: next ? 'active' : 'paused' },
      {
        onSuccess: () =>
          toast.add({
            title: next ? 'Campaign is running' : 'Campaign paused',
            description: next
              ? 'It is counting people from now on.'
              : 'It keeps everything it has already recorded.',
            type: 'success',
          }),
      }
    );
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${current.name}?`,
      description:
        'This removes the campaign and every number recorded against it. The people it recorded stay in your customer list. This cannot be undone.',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        ctx.close();
        toast.add({ title: `${current.name} deleted`, type: 'success' });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <CampaignActions
        status={current.status}
        canEdit={canEdit}
        busy={update.isPending}
        changed={draft.changed}
        blockedReason={draft.blockedReason}
        onSave={save}
        onToggleRunning={setRunning}
        onDelete={() => {
          void onDelete();
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-6 p-4">
          {current.status === 'draft' ? (
            <PaneEmpty
              module="funnels"
              icon={<Icon glyph={faArrowProgress} className="size-6" aria-hidden />}
              title="Nothing recorded yet"
              description="This campaign is a draft, so it is not counting anyone. Set up its steps and say what counts as success, then turn it on."
            />
          ) : (
            <ReportPanel id={id} />
          )}

          <CampaignSetup
            draft={draft}
            on={draft}
            canEdit={canEdit}
            error={
              update.isError
                ? funnelErrorMessage(update.error, 'That change could not be saved.')
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}

export default CampaignSurface;
