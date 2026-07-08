'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Power, Trash2 } from 'lucide-react';

import { useConfirm } from '@sparx/ui';
import { Button } from 'silicaui-react';

import {
  setProviderEnabledAction,
  testProviderAction,
  uninstallProviderAction,
} from '../../../provider-actions';

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
  const [testResult, setTestResult] = React.useState<string | null>(null);

  function onToggle() {
    startTransition(async () => {
      const result = await setProviderEnabledAction({ installationId, enabled: !enabled });
      if (!result.ok) {
        console.error('Failed to toggle provider', result.error);
        return;
      }
      router.refresh();
    });
  }

  function onTest() {
    setTestResult(null);
    startTransition(async () => {
      const result = await testProviderAction(installationId);
      if (!result.ok) {
        setTestResult(`Failed: ${result.error.message}`);
        return;
      }
      setTestResult(
        result.data.ok ? `OK — ${result.data.details}` : `Test failed: ${result.data.details}`
      );
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
          console.error('Failed to uninstall', result.error);
          return;
        }
        router.push('/commerce/providers');
      });
    })();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-row gap-2">
        <Button variant="ghost" disabled={pending} onClick={onTest}>
          Test
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={onToggle}
          iconStart={<Power className="h-4 w-4" />}
        >
          {enabled ? 'Disable' : 'Enable'}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={onUninstall}
          iconStart={<Trash2 className="h-4 w-4" />}
        >
          Uninstall
        </Button>
      </div>
      {testResult && (
        <p className="text-base-content/70 text-xs" role="status" aria-live="polite">
          {testResult}
        </p>
      )}
    </div>
  );
}
