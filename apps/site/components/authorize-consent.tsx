'use client';

// Store-branded OAuth consent (docs/113 §5). A shopper's assistant is asking to
// connect to their account on this store. We read the authorize params from the
// URL, confirm the shopper is signed in (redirect to the store login otherwise),
// let them choose scopes, and POST the decision to api-rest's consent endpoint —
// which mints the signed grant and returns the /mcp/authorize URL to hand back to.
//
// All API calls are same-origin `/v1/public/auth/consent` (Caddy routes it to
// api-rest on the store's own origin, so the sparx_customer_session cookie rides
// along and the tenant resolves from the store Host).

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { SparxAlert, SparxButton, SparxCheckbox } from '@sparx/site-ui';

const AUTH_PARAM_KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'resource',
  'nonce',
] as const;

interface ScopeRow {
  scope: string;
  label: string;
  description: string;
  checked: boolean;
}

interface ConsentInfo {
  valid: boolean;
  error?: string;
  storeName?: string;
  clientName?: string | null;
  redirectUri?: string;
  scopes?: ScopeRow[];
  signedIn?: boolean;
  email?: string | null;
}

interface Envelope<T> {
  data?: T;
  error?: { message?: string };
}

async function readEnvelope<T>(res: Response): Promise<Envelope<T>> {
  try {
    return (await res.json()) as Envelope<T>;
  } catch {
    return {};
  }
}

/** The scope picker — one labelled checkbox per requested capability. */
function ScopeList({
  scopes,
  selected,
  onToggle,
}: {
  scopes: ScopeRow[];
  selected: Record<string, boolean>;
  onToggle: (scope: string, checked: boolean) => void;
}): React.ReactElement {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {scopes.map((s) => (
        <li key={s.scope}>
          <label
            htmlFor={`scope-${s.scope}`}
            className="st-field"
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '0.6rem' }}
          >
            <SparxCheckbox
              id={`scope-${s.scope}`}
              checked={Boolean(selected[s.scope])}
              onChange={(e) => onToggle(s.scope, e.target.checked)}
            />
            <span>
              <span style={{ fontWeight: 600, display: 'block' }}>{s.label}</span>
              <span className="st-muted" style={{ fontSize: '0.85rem' }}>
                {s.description}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function AuthorizeConsent(): React.ReactElement {
  const search = useSearchParams();
  const params = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const key of AUTH_PARAM_KEYS) {
      const value = search.get(key);
      if (value) rec[key] = value;
    }
    return rec;
  }, [search]);

  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`/v1/public/auth/consent?${qs}`, {
          credentials: 'include',
          headers: { accept: 'application/json' },
        });
        const body = await readEnvelope<ConsentInfo>(res);
        if (cancelled) return;
        const data = body.data;
        if (!res.ok || !data) {
          setLoadError('Could not load the authorization request.');
          return;
        }
        // Signed out → bounce to the store login, returning here after.
        if (data.valid && data.signedIn === false) {
          const self = `/account/authorize?${qs}`;
          window.location.assign(`/account/login?redirect=${encodeURIComponent(self)}`);
          return;
        }
        setInfo(data);
        const initial: Record<string, boolean> = {};
        for (const s of data.scopes ?? []) initial[s.scope] = s.checked;
        setSelected(initial);
      } catch {
        if (!cancelled) setLoadError('Could not load the authorization request.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function submit(action: 'approve' | 'deny'): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const granted = Object.entries(selected)
        .filter(([, on]) => on)
        .map(([scope]) => scope)
        .join(' ');
      const res = await fetch('/v1/public/auth/consent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...params, action, granted }),
      });
      const body = await readEnvelope<{ authorizeUrl?: string; redirectUrl?: string }>(res);
      const dest = body.data?.authorizeUrl ?? body.data?.redirectUrl;
      if (!res.ok || !dest) {
        setError(body.error?.message ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }
      window.location.assign(dest);
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="st-container--prose" style={{ paddingBlock: '2.5rem', maxWidth: 560 }}>
        <SparxAlert color="danger">{loadError}</SparxAlert>
      </div>
    );
  }
  if (!info) {
    return <div className="st-skeleton" style={{ height: 360, maxWidth: 560 }} />;
  }
  if (!info.valid) {
    return (
      <div className="st-container--prose" style={{ paddingBlock: '2.5rem', maxWidth: 560 }}>
        <SparxAlert color="danger">
          {info.error ?? 'This authorization request is invalid.'}
        </SparxAlert>
      </div>
    );
  }

  const trimmedClient = info.clientName?.trim();
  const clientName = trimmedClient && trimmedClient.length > 0 ? trimmedClient : 'An assistant';
  const storeName = info.storeName && info.storeName.length > 0 ? info.storeName : 'store';
  return (
    <div className="st-container--prose" style={{ paddingBlock: '2.5rem', maxWidth: 560 }}>
      <h1 className="st-h2" style={{ marginBottom: '0.5rem' }}>
        Connect {clientName}
      </h1>
      <p className="st-muted" style={{ marginBottom: '1.5rem' }}>
        {clientName} wants to access your {storeName} account
        {info.email ? ` (${info.email})` : ''}. Choose what it can do — you can revoke this anytime.
      </p>

      <form
        className="st-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit('approve');
        }}
      >
        <ScopeList
          scopes={info.scopes ?? []}
          selected={selected}
          onToggle={(scope, checked) => setSelected((prev) => ({ ...prev, [scope]: checked }))}
        />

        {error ? (
          <SparxAlert color="danger" role="alert">
            {error}
          </SparxAlert>
        ) : null}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <SparxButton type="submit" color="primary" size="lg" disabled={busy}>
            {busy ? 'Authorizing…' : 'Authorize'}
          </SparxButton>
          <SparxButton
            type="button"
            color="neutral"
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={() => void submit('deny')}
          >
            Deny
          </SparxButton>
        </div>
      </form>
    </div>
  );
}
