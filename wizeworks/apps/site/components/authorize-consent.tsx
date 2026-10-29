'use client';

// Store-branded OAuth consent (docs/113 §5). A shopper's assistant is asking to
// connect to their account on this store. The authorization server sends the
// browser here with the whole request in the URL, signed. We pass that signed
// request to api-rest, which checks it and says who is asking; confirm the
// shopper is signed in (redirect to the store login otherwise); let them choose
// scopes; and POST the decision with the signed request. api-rest records it
// with the authorization server and returns where the browser goes next: the
// assistant's own address, with a code or with a refusal.
//
// All API calls are same-origin `/v1/public/auth/consent` (Caddy routes it to
// api-rest on the store's own origin, so the sparx_customer_session cookie rides
// along and the tenant resolves from the store Host).
//
// UI is pure silicaui + Tailwind on the storefront's bridged base tokens
// (bg-base-100 / border-base-300 / text-base-content resolve to the tenant theme).
// No hand-rolled `st-*` control classes and no inline `style` props.

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Button, Skeleton, Switch, Text } from '@wizeworks/silicaui-react';

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

/** A max-width column so the card sits centered on the storefront gutter. */
function ConsentShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="mx-auto w-full max-w-xl py-10">{children}</div>;
}

/** The scope picker — one labelled switch per requested capability. The Switch
 *  is the control; the row text is linked to it via aria, not a wrapping label. */
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
    <ul className="flex flex-col gap-2">
      {scopes.map((s) => {
        const labelId = `scope-${s.scope}-label`;
        const descId = `scope-${s.scope}-desc`;
        return (
          <li
            key={s.scope}
            className="border-base-300 flex items-start justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span id={labelId} className="text-sm font-medium">
                {s.label}
              </span>
              {/* Linked via aria-describedby rather than nested, so the switch's
                    accessible name is the label alone — not the full paragraph. */}
              <span id={descId} className="text-sm">
                {s.description}
              </span>
            </div>
            <Switch
              checked={Boolean(selected[s.scope])}
              onCheckedChange={(v) => onToggle(s.scope, v)}
              color="primary"
              aria-labelledby={labelId}
              aria-describedby={descId}
              className="mt-0.5 shrink-0"
            />
          </li>
        );
      })}
    </ul>
  );
}

export function AuthorizeConsent(): React.ReactElement {
  const search = useSearchParams();
  // The signed request, verbatim: every parameter, repeated ones included, in
  // the order the authorization server signed them.
  const oauthQuery = useMemo(() => search.toString(), [search]);

  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const qs = oauthQuery;
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
  }, [oauthQuery]);

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
        body: JSON.stringify({ oauth_query: oauthQuery, action, granted }),
      });
      const body = await readEnvelope<{ redirectUrl?: string }>(res);
      const dest = body.data?.redirectUrl;
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
      <ConsentShell>
        <Alert color="danger">{loadError}</Alert>
      </ConsentShell>
    );
  }
  if (!info) {
    return (
      <ConsentShell>
        <Skeleton className="h-80 w-full rounded-xl" />
      </ConsentShell>
    );
  }
  if (!info.valid) {
    return (
      <ConsentShell>
        <Alert color="danger">{info.error ?? 'This authorization request is invalid.'}</Alert>
      </ConsentShell>
    );
  }

  const trimmedClient = info.clientName?.trim();
  const clientName = trimmedClient && trimmedClient.length > 0 ? trimmedClient : 'An assistant';
  const storeName = info.storeName && info.storeName.length > 0 ? info.storeName : 'store';
  return (
    <ConsentShell>
      <div className="bg-base-100 border-base-300 flex flex-col gap-6 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h1>
          <Text>
            {clientName} wants to access your {storeName} account
            {info.email ? ` (${info.email})` : ''}. Choose what it can do. You can revoke this
            anytime.
          </Text>
        </div>

        <form
          className="flex flex-col gap-6"
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
            <Alert color="danger" role="alert">
              {error}
            </Alert>
          ) : null}

          <div className="flex gap-3">
            <Button
              type="submit"
              color="primary"
              size="lg"
              disabled={busy || !Object.values(selected).some(Boolean)}
            >
              {busy ? 'Authorizing…' : 'Authorize'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => void submit('deny')}
            >
              Deny
            </Button>
          </div>
        </form>
      </div>
    </ConsentShell>
  );
}
