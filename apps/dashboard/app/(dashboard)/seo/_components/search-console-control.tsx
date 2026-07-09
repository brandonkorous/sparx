'use client';

// Search Console connection control (docs/50 §7). Renders the right action for
// the current connection state — Connect (OAuth redirect), pick a verified site,
// or, when connected, Sync now / Disconnect. Also surfaces the callback redirect
// flags (?gsc / ?gsc_error) as a toast on mount. Lives in the "Organic traffic"
// card header on the SEO overview.

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast, useConfirm } from '@sparx/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { Check, Link2, Plug, RefreshCw } from 'lucide-react';

import {
  disconnectSearchConsole,
  listSearchConsoleSites,
  selectSearchConsoleSite,
  startSearchConsoleConnect,
  syncSearchConsole,
  type GscSite,
} from '@/components/seo/search-console-actions';

export interface ConnectionView {
  status: string;
  siteUrl: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export function SearchConsoleControl({
  configured,
  connection,
}: {
  configured: boolean;
  connection: ConnectionView | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const confirm = useConfirm();
  const [pending, setPending] = React.useState<string | null>(null);
  const [sites, setSites] = React.useState<GscSite[] | null>(null);

  const status = connection?.status ?? 'disconnected';

  async function loadSites(): Promise<void> {
    setPending('sites');
    const res = await listSearchConsoleSites();
    setPending(null);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'Could not load your sites.');
      return;
    }
    setSites(res.data.sites);
  }

  // Surface the OAuth callback flags once, then clean them off the URL.
  React.useEffect(() => {
    const err = params.get('gsc_error');
    const flag = params.get('gsc');
    if (err) {
      toast.error(err === 'access_denied' ? 'Connection cancelled.' : `Search Console: ${err}`);
    } else if (flag === 'connected') {
      toast.success('Search Console connected.');
    } else if (flag === 'pick_site') {
      toast.message('Choose which Search Console site to connect.');
      void loadSites();
    }
    if (err || flag) router.replace('/seo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(): Promise<void> {
    setPending('connect');
    const res = await startSearchConsoleConnect();
    if (!res.ok || !res.data) {
      setPending(null);
      toast.error(res.error ?? 'Could not start the connection.');
      return;
    }
    window.location.href = res.data.url;
  }

  async function pick(siteUrl: string): Promise<void> {
    setPending(siteUrl);
    const res = await selectSearchConsoleSite(siteUrl);
    setPending(null);
    if (!res.ok) {
      toast.error(res.error ?? 'Could not connect that site.');
      return;
    }
    toast.success('Search Console connected.');
    setSites(null);
    router.refresh();
  }

  async function sync(): Promise<void> {
    setPending('sync');
    const res = await syncSearchConsole();
    setPending(null);
    if (!res.ok) {
      toast.error(res.error ?? 'Sync failed.');
      return;
    }
    toast.success(`Synced ${res.data?.days ?? 0} days · ${res.data?.queries ?? 0} queries.`);
    router.refresh();
  }

  async function disconnect(): Promise<void> {
    const ok = await confirm({
      title: 'Disconnect Search Console?',
      description:
        'sparx will stop importing organic-search data for this site. Your historical figures are kept.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    setPending('disconnect');
    const res = await disconnectSearchConsole();
    setPending(null);
    if (!res.ok) {
      toast.error(res.error ?? 'Could not disconnect.');
      return;
    }
    toast.success('Search Console disconnected.');
    router.refresh();
  }

  if (!configured) {
    return (
      <span className="text-base-content/50 text-xs">Search Console connection coming soon</span>
    );
  }

  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2">
        <Badge color="success" variant="soft">
          <Check className="mr-1 h-3 w-3" />
          Connected
        </Badge>
        <Button size="sm" variant="ghost" onClick={() => void sync()} disabled={pending !== null}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${pending === 'sync' ? 'animate-spin' : ''}`} />
          Sync
        </Button>
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          onClick={() => void disconnect()}
          disabled={pending !== null}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  if (status === 'needs_site' || sites) {
    return (
      <div className="flex flex-col items-end gap-2">
        {sites === null ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadSites()}
            disabled={pending !== null}
          >
            <Link2 className="mr-1 h-3.5 w-3.5" />
            {pending === 'sites' ? 'Loading…' : 'Choose a site'}
          </Button>
        ) : sites.length === 0 ? (
          <span className="text-base-content/50 text-xs">
            No verified sites on this Google account.
          </span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1.5">
            {sites.map((s) => (
              <Button
                key={s.siteUrl}
                size="sm"
                variant="outline"
                onClick={() => void pick(s.siteUrl)}
                disabled={pending !== null}
              >
                {pending === s.siteUrl ? 'Connecting…' : s.siteUrl}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // disconnected / error / no connection → connect CTA
  return (
    <div className="flex items-center gap-2">
      {status === 'error' && connection?.lastError ? (
        <span className="text-danger max-w-[14rem] truncate text-xs" title={connection.lastError}>
          {connection.lastError}
        </span>
      ) : null}
      <Button size="sm" color="module" onClick={() => void connect()} disabled={pending !== null}>
        <Plug className="mr-1 h-3.5 w-3.5" />
        {pending === 'connect'
          ? 'Connecting…'
          : status === 'error'
            ? 'Reconnect'
            : 'Connect Search Console'}
      </Button>
    </div>
  );
}
