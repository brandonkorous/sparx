'use client';

// Browser push opt-in toggle (docs/69 A-6). Registers the service worker,
// subscribes via the Push API with the VAPID public key, and stores the
// subscription through a server action. Per-browser: each device opts in
// separately. No-ops gracefully when push is unsupported or VAPID is unset.

import * as React from 'react';
import { Bell } from 'lucide-react';
import { Loading, Switch } from 'silicaui-react';

import { subscribePushAction, unsubscribePushAction } from '../actions';

const SW_URL = '/push-sw.js';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const ok =
        typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window &&
        Boolean(vapidPublicKey);
      const reg = ok ? await navigator.serviceWorker.getRegistration(SW_URL) : null;
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!active) return;
      setSupported(ok);
      setEnabled(Boolean(sub));
    })();
    return () => {
      active = false;
    };
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notifications are blocked in your browser settings.');
        return;
      }
      const reg = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        setError('Could not read the push subscription.');
        return;
      }
      await subscribePushAction({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <p className="text-base-content/70 text-sm">
        {vapidPublicKey
          ? 'This browser doesn’t support web push notifications.'
          : 'Push notifications aren’t configured for this environment yet.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row items-center gap-3">
        <Switch
          id="push-toggle"
          checked={enabled}
          onCheckedChange={(next) => {
            if (!busy) void (next ? enable() : disable());
          }}
          disabled={busy || supported === null}
        />
        <div className="flex flex-row items-center gap-2">
          <Bell className="h-4 w-4 text-[var(--color-text-secondary)]" />
          <p className="text-sm">
            {enabled ? 'Browser notifications are on' : 'Enable browser notifications'}
          </p>
          {busy ? <Loading size="sm" /> : null}
        </div>
      </div>
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
