'use client';

// Connect a real calendar account by CalDAV (docs/79 §8.3, Layer 3) — Apple iCloud
// via an app-specific password (the default), or a generic CalDAV server. Unlike a
// read-only iCal link, this discovers the account's calendars and pulls busy
// VEVENTs; the username + app-password are encrypted at rest server-side. Still
// inbound-only + clearly stale — sparx stays the source of truth (the DB no-overlap
// constraint, §8.4).

import { useState } from 'react';
import { Button, Input, toast } from '@sparx/ui';

import { createCaldavConnectionAction } from '../../_lib/actions';

export function CaldavConnectForm({
  resourceId,
  onConnected,
}: {
  resourceId: string;
  onConnected: () => void;
}) {
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [useCustomServer, setUseCustomServer] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = username.trim() && appPassword.trim() && (!useCustomServer || serverUrl.trim());

  async function connect() {
    if (!ready) return;
    setBusy(true);
    const result = await createCaldavConnectionAction({
      resourceId,
      provider: useCustomServer ? 'caldav' : 'apple_caldav',
      username: username.trim(),
      appPassword: appPassword.trim(),
      ...(useCustomServer ? { serverUrl: serverUrl.trim() } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.sync && !result.data.sync.ok) {
      toast.error(result.data.sync.error ?? 'Connected, but the first sync failed.');
    } else {
      toast.success('Calendar connected');
    }
    setUsername('');
    setAppPassword('');
    setServerUrl('');
    onConnected();
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">Connect Apple iCloud (or another CalDAV account)</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Use an{' '}
          <a
            href="https://account.apple.com/account/manage"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            app-specific password
          </a>{' '}
          (not your normal Apple password). Events on the account block this resource&rsquo;s sparx
          availability.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Apple ID email"
          autoComplete="off"
          aria-label="CalDAV username"
        />
        <Input
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          placeholder="app-specific password"
          autoComplete="off"
          aria-label="CalDAV app-specific password"
        />
      </div>

      {useCustomServer ? (
        <Input
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://caldav.example.com"
          aria-label="CalDAV server URL"
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-[var(--color-muted-foreground)] underline"
          onClick={() => setUseCustomServer((v) => !v)}
        >
          {useCustomServer ? 'Use Apple iCloud instead' : 'Use a different CalDAV server'}
        </button>
        <Button
          type="button"
          color="module"
          onClick={() => void connect()}
          loading={busy}
          disabled={!ready}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
