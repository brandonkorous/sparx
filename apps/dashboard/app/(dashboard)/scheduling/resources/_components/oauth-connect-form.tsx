'use client';

// Connect a real calendar account over OAuth (docs/79 §8.3, Layer 3) — the
// near-real-time path. The platform "Connect Google / Microsoft" buttons use the
// verified WizeWorks app (one click); the BYO panel lets a tenant use their OWN
// Google Cloud / Azure client (no platform involvement). Clicking leaves the SPA for
// the provider's consent screen and returns to /scheduling/calendar/connected, which
// finishes the exchange. Two-way (Google) / inbound + feed-out (Microsoft); a live
// push channel keeps it fresh — sparx still owns availability (the no-overlap guard).

import { useEffect, useState } from 'react';
import { Button, Field, FieldControl } from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';
import { CalendarCheck2 } from 'lucide-react';

import { getCalendarOAuthProvidersAction, startCalendarOAuthAction } from '../../_lib/actions';

type Provider = 'google' | 'microsoft';
const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Outlook',
};

export function OAuthConnectForm({ resourceId }: { resourceId: string }) {
  const [providers, setProviders] = useState<{
    cryptoConfigured: boolean;
    google: boolean;
    microsoft: boolean;
  } | null>(null);
  const [byoOpen, setByoOpen] = useState(false);
  const [byoProvider, setByoProvider] = useState<Provider>('google');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getCalendarOAuthProvidersAction().then((r) => {
      if (r.ok) setProviders(r.data);
    });
  }, []);

  async function connect(
    provider: Provider,
    credentialSource: 'platform' | 'tenant_byo',
    extra: { oauthClientId?: string; oauthClientSecret?: string } = {}
  ): Promise<void> {
    setBusy(`${provider}:${credentialSource}`);
    const result = await startCalendarOAuthAction({
      resourceId,
      provider,
      credentialSource,
      redirectUri: `${window.location.origin}/scheduling/calendar/connected`,
      ...extra,
    });
    if (!result.ok) {
      setBusy(null);
      toast.error(result.error);
      return;
    }
    // Leave the SPA for the provider's consent screen; the callback finishes up.
    window.location.href = result.data.authorizeUrl;
  }

  const byoReady = clientId.trim() && clientSecret.trim();

  const v = useFieldValidation(
    { clientId, clientSecret },
    {
      clientId: rule.required('Enter the client ID.'),
      clientSecret: rule.required('Enter the client secret.'),
    }
  );

  if (providers && !providers.cryptoConfigured) {
    return (
      <p className="text-base-content text-xs">
        Real-time calendar sync isn&rsquo;t enabled on this deployment yet. You can still import a
        read-only calendar link below.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">Connect a calendar for real-time sync</p>
        <p className="text-base-content text-xs">
          One click. Outside events block this resource&rsquo;s sparx availability the moment they
          change, and confirmed bookings appear on the connected calendar.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {(['google', 'microsoft'] as Provider[]).map((p) => {
          const platformReady = providers?.[p] ?? false;
          return (
            <Button
              key={p}
              type="button"
              variant="outline"
              color="module"
              loading={busy === `${p}:platform`}
              disabled={!platformReady || busy !== null}
              onClick={() => void connect(p, 'platform')}
            >
              <CalendarCheck2 className="mr-2 h-4 w-4" />
              Connect {PROVIDER_LABEL[p]}
            </Button>
          );
        })}
      </div>
      {providers && (!providers.google || !providers.microsoft) ? (
        <p className="text-base-content text-xs">
          {!providers.google && !providers.microsoft
            ? 'The one-click apps aren’t configured here — use your own credentials below.'
            : `${!providers.google ? 'Google' : 'Microsoft'} one-click isn’t configured here — use your own credentials below.`}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          className="text-base-content text-xs underline"
          onClick={() => setByoOpen((v) => !v)}
        >
          {byoOpen
            ? 'Hide advanced (use your own app)'
            : 'Use your own Google/Azure app credentials'}
        </button>
      </div>

      {byoOpen ? (
        <div className="border-base-300 flex flex-col gap-2 rounded-md border p-3">
          <div className="flex gap-2">
            {(['google', 'microsoft'] as Provider[]).map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={byoProvider === p ? 'soft' : 'ghost'}
                color="module"
                onClick={() => setByoProvider(p)}
              >
                {PROVIDER_LABEL[p]}
              </Button>
            ))}
          </div>
          <Field {...v.field('clientId')}>
            <FieldControl
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={byoProvider === 'google' ? 'OAuth client ID' : 'Application (client) ID'}
              autoComplete="off"
              aria-label="OAuth client ID"
              {...v.control('clientId')}
            />
          </Field>
          <Field {...v.field('clientSecret')}>
            <FieldControl
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Client secret"
              autoComplete="off"
              aria-label="OAuth client secret"
              {...v.control('clientSecret')}
            />
          </Field>
          <div className="flex justify-end">
            <Button
              type="button"
              color="module"
              size="sm"
              loading={busy === `${byoProvider}:tenant_byo`}
              disabled={!byoReady || busy !== null}
              onClick={() => {
                if (!v.validate()) return;
                void connect(byoProvider, 'tenant_byo', {
                  oauthClientId: clientId.trim(),
                  oauthClientSecret: clientSecret.trim(),
                });
              }}
            >
              Connect with my app
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
