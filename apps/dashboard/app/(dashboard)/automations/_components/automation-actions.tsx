'use client';

// The detail-page action bar. Locked (platform-managed) automations expose only
// "Duplicate to edit" (the §3.1 adapt path) + View runs — edit / pause / delete
// are rejected by the service (AUTOMATION_LOCKED), so we don't offer them. A
// user-origin rule gets the full set; delete goes behind a confirm that names the
// target and the run-history it drops (cascade).

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from 'silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { AutomationDto } from '../_lib/types';
import {
  cloneAutomationAction,
  deleteAutomationAction,
  setAutomationStatusAction,
} from '../actions';

export function AutomationActions({
  automation,
  canWrite,
}: {
  automation: AutomationDto;
  canWrite: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function setStatus(next: 'active' | 'paused') {
    startTransition(async () => {
      const result = await setAutomationStatusAction(automation.id, next);
      if (result.ok)
        toast.success(next === 'active' ? 'Automation activated.' : 'Automation paused.');
      else toast.error(result.error.message);
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await cloneAutomationAction(automation.id);
      if (result.ok) {
        toast.success('Duplicated — editing the copy.');
        router.push(`/automations/${result.data.id}/edit`);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete “${automation.name}”?`,
      description:
        'This permanently removes the automation and its run history. This cannot be undone.',
      confirmLabel: 'Delete automation',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteAutomationAction(automation.id);
      if (result.ok) {
        toast.success('Automation deleted.');
        router.push('/automations');
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" render={<Link href={`/automations/${automation.id}/runs`} />}>
        View runs
      </Button>

      {automation.locked ? (
        <Button
          type="button"
          color="module"
          iconStart={<Copy className="h-4 w-4" />}
          loading={pending}
          disabled={pending}
          onClick={duplicate}
        >
          Duplicate to edit
        </Button>
      ) : canWrite ? (
        <>
          <Button
            type="button"
            variant="outline"
            iconStart={<Copy className="h-4 w-4" />}
            disabled={pending}
            onClick={duplicate}
          >
            Duplicate
          </Button>
          {automation.status === 'active' ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStatus('paused')}
            >
              Pause
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStatus('active')}
            >
              Activate
            </Button>
          )}
          <Button
            color="module"
            iconStart={<Pencil className="h-4 w-4" />}
            render={<Link href={`/automations/${automation.id}/edit`} />}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            color="danger"
            iconStart={<Trash2 className="h-4 w-4" />}
            disabled={pending}
            onClick={remove}
          >
            Delete
          </Button>
        </>
      ) : null}
    </div>
  );
}
