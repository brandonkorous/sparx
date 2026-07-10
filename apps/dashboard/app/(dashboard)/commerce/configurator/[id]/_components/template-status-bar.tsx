'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Trash2 } from 'lucide-react';

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { deleteTemplateAction, updateTemplateAction } from '../../../configurator-actions';

// Lifecycle controls for a configurator template, teleported into the detail
// frame's header (drawer/modal chrome or the full-page shell) via the shared
// header slot — parity with ProductStatusBar. Errors surface as a toast: the
// header bar has no room for inline error text.
export function TemplateStatusBar({ templateId, status }: { templateId: string; status: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function updateStatus(next: 'draft' | 'active' | 'archived') {
    startTransition(async () => {
      const result = await updateTemplateAction(templateId, { status: next });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onArchive() {
    void (async () => {
      const ok = await confirm({
        title: 'Archive this template?',
        description:
          'It’ll stop applying to new cart items. Existing carts and orders that already reference it are unaffected.',
        confirmLabel: 'Archive',
        tone: 'warning',
      });
      if (!ok) return;
      updateStatus('archived');
    })();
  }

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete configurator template?',
        description:
          'Deletes the template, its options, rules, and add-ons. Cart items that already reference this template keep their stored payload.',
        confirmLabel: 'Delete template',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteTemplateAction(templateId);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/configurator');
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {status !== 'archived' && (
        <Tooltip content="Archive">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Archive"
            disabled={pending}
            onClick={onArchive}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      <Tooltip content="Delete">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete template"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {status === 'active' && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => updateStatus('draft')}>
          Move to draft
        </Button>
      )}
      {status !== 'active' && (
        <Button
          variant="solid"
          color="module"
          size="sm"
          disabled={pending}
          onClick={() => updateStatus('active')}
        >
          Activate
        </Button>
      )}
    </div>
  );
}
