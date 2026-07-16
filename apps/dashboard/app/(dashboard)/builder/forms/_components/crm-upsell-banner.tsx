'use client';

// The one tasteful "turn on CRM" prompt above the inbox (docs/115 §6). Shown
// only when the CRM module is OFF. Activating routes through the REAL activation
// path — `setModuleEnabledAction('crm', true)` — which publishes
// `module.activated`, seeds CRM defaults, and BACKFILLS the leads already
// captured (so turning it on isn't starting from zero). We never flip a flag
// directly.
//
// Owners/admins get the button (mirroring ModuleUpsell's `canActivate` gate);
// everyone else is told who to ask. Dismissal is per-browser (sessionStorage) so
// it doesn't nag on every visit but returns for a fresh session.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { Button, ModuleProvider, Stack, Text, toast } from '@sparx/ui';

import { setModuleEnabledAction } from '../../../settings/modules/actions';

const DISMISS_KEY = 'sparx.forms.crmUpsellDismissed';

export function CrmUpsellBanner({ canActivate }: { canActivate: boolean }) {
  const router = useRouter();
  const [dismissed, setDismissed] = React.useState(true); // default hidden until we read storage
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  async function activate() {
    setBusy(true);
    const result = await setModuleEnabledAction('crm', true);
    setBusy(false);
    if (result.ok) {
      toast.success('CRM is on — your existing leads are being imported into your contacts.');
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  }

  if (dismissed) return null;

  return (
    <ModuleProvider module="crm">
      <div className="border-base-300 bg-base-100 relative rounded-lg border p-4">
        <Stack direction="row" align="start" gap={3}>
          <span
            aria-hidden
            className="bg-module bg-soft text-module mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <Stack gap={2} className="min-w-0 flex-1">
            <Stack gap={1}>
              <Text weight="medium">Keep these people as contacts?</Text>
              <Text size="sm" variant="muted">
                Turn on CRM and every message here becomes a contact you can follow up with, tag,
                and track. The leads you&apos;ve already collected are imported automatically — you
                won&apos;t lose a thing.
              </Text>
            </Stack>
            <Stack direction="row" align="center" gap={2} wrap>
              {canActivate ? (
                <Button color="module" size="sm" loading={busy} onClick={activate}>
                  Turn on CRM
                </Button>
              ) : (
                <Text size="sm" variant="muted">
                  Ask a workspace owner or admin to turn on CRM.
                </Text>
              )}
              <Button variant="ghost" size="sm" onClick={dismiss} disabled={busy}>
                Not now
              </Button>
            </Stack>
          </Stack>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="text-base-content hover:text-base-content absolute top-2 right-2 rounded-md p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </Stack>
      </div>
    </ModuleProvider>
  );
}
