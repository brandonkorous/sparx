'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { toast, useConfirm } from '@sparx/ui';
import { Button, Tooltip } from '@wizeworks/silicaui-react';

import {
  setProviderEnabledAction,
  testProviderAction,
  uninstallProviderAction,
} from '../../../provider-actions';

// Lifecycle controls for a provider installation, teleported into the detail
// frame's header (drawer/modal chrome or the full-page shell) via the shared
// header slot — parity with TemplateStatusBar. Errors + test results surface
// as toasts: the header bar has no room for inline status text.
export function ProviderActionsBar({
  installationId,
  enabled,
}: {
  installationId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onToggle() {
    startTransition(async () => {
      const result = await setProviderEnabledAction({ installationId, enabled: !enabled });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onTest() {
    startTransition(async () => {
      const result = await testProviderAction(installationId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      if (result.data.ok) {
        toast.success(`OK — ${result.data.details}`);
      } else {
        toast.error(`Test failed: ${result.data.details}`);
      }
    });
  }

  function onUninstall() {
    void (async () => {
      const ok = await confirm({
        title: 'Uninstall provider?',
        description:
          'The credentials are detached and the platform stops dispatching to this provider. Webhook events still record but are not processed. You can reinstall later.',
        confirmLabel: 'Uninstall',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await uninstallProviderAction(installationId);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/providers');
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      <Button variant="ghost" size="sm" disabled={pending} onClick={onTest}>
        Test
      </Button>
      <Tooltip content="Uninstall">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Uninstall"
          disabled={pending}
          onClick={onUninstall}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {enabled ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onToggle}>
          Disable
        </Button>
      ) : (
        <Button variant="solid" color="module" size="sm" disabled={pending} onClick={onToggle}>
          Enable
        </Button>
      )}
    </div>
  );
}
