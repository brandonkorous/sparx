'use client';

// Sales channels — every outside shop you've connected, and the ones you could.
//
// product-channels.tsx shows where ONE product is listed. This is the whole-
// business view: each connected shop, whether it's healthy, and how many of your
// product listings ride on it. Connections are made by an OAuth handshake and
// the listings on them are created by the sync worker (the side that knows the
// external ids), so this surface manages what exists — view health, disconnect —
// and shows the catalog of what's available, rather than hand-creating a link.
//
// Disconnecting is the one destructive act here, and it has a sharp edge: it
// removes OUR record of the shop's listings, but it does NOT take those listings
// down on the shop itself. The confirm says so first.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  Heading,
  Text,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Link2Off, Plug, ServerCrash, Store } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { productErrorMessage } from './products-data';
import {
  channelErrorMessage,
  connectionState,
  useChannelConnectUrl,
  useChannels,
  useCompleteChannelConnect,
  useDisconnectChannel,
  type ChannelCatalogEntry,
  type ChannelConnection,
} from './channels-data';

const LABEL = 'Sales channels';

const PHASE_LABEL: Record<ChannelCatalogEntry['phase'], string> = {
  P1: 'coming soon',
  P2: 'coming soon',
  P3: 'coming later',
  P4: 'coming later',
  P5: 'coming later',
};

function ConnectionRow({
  connection,
  channelName,
}: {
  connection: ChannelConnection;
  channelName: string;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const disconnect = useDisconnectChannel();
  const state = connectionState(connection.status);
  const where = connection.shopName ? `${channelName} · ${connection.shopName}` : channelName;

  const onDisconnect = () => {
    void (async () => {
      const ok = await confirm({
        title: `Disconnect ${where}?`,
        description: `This does NOT take your listings down on ${channelName}: they stay live there and people can still buy them. What stops is us keeping them up to date and matching orders from ${channelName} back to your products, so stock will drift. To actually remove the listings, delist them in ${channelName}'s own seller tools first.`,
        confirmLabel: 'Disconnect it',
        cancelLabel: 'Keep it connected',
        color: 'danger',
      });
      if (!ok) return;
      disconnect.mutate(connection.channel, {
        onSuccess: () => {
          toast.add({ title: `Disconnected ${channelName}`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not disconnect that shop',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      });
    })();
  };

  return (
    <div className="border-base-300 flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Text as="span" className="font-medium">
            {where}
          </Text>
          <Text className="text-sm">
            {connection.mappingCount === 0
              ? 'No product listings on it yet.'
              : connection.mappingCount === 1
                ? '1 product listing rides on it.'
                : `${String(connection.mappingCount)} product listings ride on it.`}
          </Text>
          <Text className="text-sm">
            {connection.lastSyncedAt ? (
              <>
                Last updated <Timestamp value={connection.lastSyncedAt} format="relative" />
              </>
            ) : (
              'Not updated since it was connected.'
            )}
          </Text>
        </div>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </div>
      <div className="flex">
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          className="ml-auto"
          loading={disconnect.isPending}
          onClick={onDisconnect}
        >
          <Link2Off className="size-4" aria-hidden />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

function CatalogRow({
  entry,
  connecting,
  onConnect,
}: {
  entry: ChannelCatalogEntry;
  /** Non-null while a popup is open, so only the row being connected shows it. */
  connecting: string | null;
  onConnect: ((slug: string) => void) | null;
}) {
  const available = entry.availability === 'available';
  return (
    <div className="border-base-300 flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text as="span" className="font-medium">
          {entry.name}
        </Text>
        <Text className="text-sm">{entry.tagline}</Text>
      </div>
      {/* A shop that is ready gets the button that makes it true. Without one,
          the green badge was a claim with nowhere to act on it — the API's
          connect handshake shipped and nothing in either console called it
          (issue 733). */}
      {available && onConnect ? (
        <Button
          size="sm"
          color="module"
          aria-label={`Connect ${entry.name}`}
          loading={connecting === entry.slug}
          disabled={connecting !== null}
          onClick={() => {
            onConnect(entry.slug);
          }}
        >
          <Plug className="size-4" aria-hidden />
          Connect
        </Button>
      ) : (
        <Badge color={available ? 'success' : 'neutral'} variant="soft" size="sm">
          {available ? 'Available' : PHASE_LABEL[entry.phase]}
        </Badge>
      )}
    </div>
  );
}

/** The shape the callback page posts back through `window.opener`. */
interface CallbackMessage {
  source: 'sparx-channel';
  code?: string;
  state?: string;
  error?: string;
}

function isCallbackMessage(data: unknown): data is CallbackMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === 'sparx-channel'
  );
}

export function ChannelsSurface({ ctx: _ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const channels = useChannels();
  const data = channels.data;

  const connectUrl = useChannelConnectUrl();
  const completeConnect = useCompleteChannelConnect();
  /** Which row was pressed. The BUSY flag is derived below, not stored: a
   *  stored one never clears when somebody closes the shop's window without
   *  finishing, and the whole section stays disabled until the pane reloads.
   *  Same shape as Your social accounts. */
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [connectFailure, setConnectFailure] = useState<string | null>(null);

  const nameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of data?.catalog ?? []) map.set(entry.slug, entry.name);
    return map;
  }, [data]);

  const connecting = connectUrl.isPending || completeConnect.isPending;

  const connections = data?.connections ?? [];
  const available = (data?.catalog ?? []).filter((c) => c.availability === 'available');
  const comingSoon = (data?.catalog ?? []).filter((c) => c.availability !== 'available');

  // Finish a connect once the popup posts the code back.
  const runComplete = useCallback(
    (code: string, state: string) => {
      completeConnect.mutate(
        { code, state },
        {
          onSuccess: (result) => {
            setConnectingSlug(null);
            toast.add({
              title: `${nameBySlug.get(result.channel) ?? result.channel} connected`,
              description: 'Your products start syncing to it shortly.',
              type: 'success',
            });
          },
          onError: (error) => {
            setConnectingSlug(null);
            setConnectFailure(
              channelErrorMessage(error, 'Could not finish connecting. Nothing was changed.')
            );
          },
        }
      );
    },
    [completeConnect, toast, nameBySlug]
  );

  // A live handle to the runner, so the listener — registered once — always
  // calls the current one without re-binding and dropping an open popup's
  // message.
  const completeRef = useRef(runComplete);
  completeRef.current = runComplete;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isCallbackMessage(event.data)) return;
      if (event.data.error) {
        setConnectingSlug(null);
        setConnectFailure(
          event.data.error === 'access_denied'
            ? 'You canceled the sign-in, so nothing was connected.'
            : `The shop reported a problem: ${event.data.error}`
        );
        return;
      }
      if (event.data.code && event.data.state) {
        completeRef.current(event.data.code, event.data.state);
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const connect = (slug: string) => {
    setConnectFailure(null);
    setConnectingSlug(slug);
    // Open the popup synchronously inside the click so the browser does not
    // treat it as unsolicited; point it at the shop once the URL resolves.
    const popup = window.open('', 'sparx-channel-connect', 'width=560,height=680');
    const redirectUri = `${window.location.origin}/commerce/sales-channels/callback`;
    connectUrl.mutate(
      { slug, redirectUri },
      {
        onSuccess: ({ url }) => {
          if (popup) popup.location.href = url;
          else window.location.href = url;
        },
        onError: (error) => {
          popup?.close();
          setConnectingSlug(null);
          setConnectFailure(
            channelErrorMessage(error, 'Could not start the connection. Nothing was changed.')
          );
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Sales channels controls"
        controls={
          <>
            <Store className="size-4 shrink-0" aria-hidden />
            <Heading level={2} className="min-w-0 truncate text-base font-semibold">
              {LABEL}
            </Heading>
            {connections.length > 0 ? (
              <Badge color="success" variant="soft" size="sm">
                {connections.length === 1
                  ? '1 connected'
                  : `${String(connections.length)} connected`}
              </Badge>
            ) : null}
          </>
        }
        refresh={
          <RefreshButton
            className="ml-auto"
            isFetching={channels.isFetching}
            updatedAt={data ? channels.dataUpdatedAt : undefined}
            onRefresh={() => {
              void channels.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {channels.isError ? (
            <EmptyState
              icon={<ServerCrash className="size-6" aria-hidden />}
              title="Could not load your sales channels"
              description={productErrorMessage(
                channels.error,
                'This is a problem reaching the server. Nothing about your connected shops has changed.'
              )}
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    void channels.refetch();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : channels.isLoading ? (
            <p className="text-sm" role="status">
              Loading…
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Heading level={1} className="text-2xl font-semibold">
                  Where else you sell
                </Heading>
                <Text className="text-sm">
                  Outside shops like Etsy or TikTok Shop that you’ve connected, and the ones you’ll
                  be able to connect. Connecting a shop syncs your products to it and brings its
                  orders back to you.
                </Text>
              </div>

              {/* A failed handshake happens in a popup that has already closed,
                  so a toast would land on a screen nobody is looking at. It
                  stays here until the next attempt clears it. */}
              {connectFailure ? (
                <Alert color="danger" variant="soft">
                  <AlertContent>
                    <AlertTitle>Could not connect that shop</AlertTitle>
                    <AlertDescription>{connectFailure}</AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}

              <FormSection title="Connected shops">
                {connections.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={<Store className="size-6" aria-hidden />}
                    title="No shops connected yet"
                    description="Once you connect an outside shop, it appears here with how many of your products are listed on it and whether it's up to date."
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {connections.map((connection) => (
                      <ConnectionRow
                        key={connection.id}
                        connection={connection}
                        channelName={nameBySlug.get(connection.channel) ?? connection.channel}
                      />
                    ))}
                  </div>
                )}
              </FormSection>

              {available.length > 0 ? (
                <FormSection
                  title="Ready to connect"
                  description="Connect one and you sign in to that shop, allow it once, and come straight back. Your products start going across shortly afterwards."
                >
                  <div className="flex flex-col gap-3">
                    {available.map((entry) => (
                      <CatalogRow
                        key={entry.slug}
                        entry={entry}
                        connecting={connecting ? connectingSlug : null}
                        onConnect={connect}
                      />
                    ))}
                  </div>
                </FormSection>
              ) : null}

              {comingSoon.length > 0 ? (
                <FormSection
                  title="On the way"
                  description="Shops that aren't ready to connect yet: they'll light up here when they are, with nothing for you to do."
                >
                  <div className="flex flex-col gap-3">
                    {comingSoon.map((entry) => (
                      <CatalogRow
                        key={entry.slug}
                        entry={entry}
                        connecting={null}
                        onConnect={null}
                      />
                    ))}
                  </div>
                </FormSection>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
