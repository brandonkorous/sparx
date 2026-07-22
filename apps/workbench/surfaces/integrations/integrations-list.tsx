'use client';

// Every outside service this business can connect, and the ones it already has.
//
// Grouped by what the service DOES (shipping, card payments, sales tax…) rather
// than shown as one flat list, because "connect a shipping carrier" and "connect
// a tax service" are different errands — the group heading is what tells a
// non-technical owner which is which. Inside a group, a service already
// connected shows its state; one that is not shows an invitation to add it.
//
// Deliberately NOT a table: a provider's identity (its name and who makes it) is
// the content of the row, with one state badge on the right — a table would
// invent columns to justify themselves and repeat a header per group.

import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Heading, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Plug, Plus } from 'lucide-react';
import { RefreshButton } from '../../components/refresh-button';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { kindIcon } from './kind-icon';
import {
  installationState,
  isSellingDisabled,
  kindHint,
  kindLabel,
  KIND_ORDER,
  useAvailableIntegrations,
  useInstallations,
  type Installation,
  type ProviderKind,
  type ProviderMetadata,
} from './data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** One connected service — name, maker, and how it is doing. Opens the manage
 *  view for that connection. */
function ConnectedRow({
  installation,
  metadata,
  onOpen,
}: {
  installation: Installation;
  metadata: ProviderMetadata | undefined;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const state = installationState(installation);
  const name = metadata?.displayName ?? installation.providerSlug;
  return (
    <li className="border-base-300 hover:bg-base-200 border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <span className="min-w-0 flex-1">
          <span className="font-medium">{name}</span>
          {installation.label ? (
            <span className="text-sm"> · {installation.label}</span>
          ) : metadata?.vendor ? (
            <span className="text-sm"> · by {metadata.vendor}</span>
          ) : null}
        </span>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </button>
    </li>
  );
}

/** One service available to connect. Opens the connect view for that service. */
function AvailableRow({
  metadata,
  onOpen,
}: {
  metadata: ProviderMetadata;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <li className="border-base-300 hover:bg-base-200 border-b last:border-b-0">
      <button
        type="button"
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <span className="min-w-0 flex-1">
          <span className="font-medium">{metadata.displayName}</span>
          <span className="text-sm"> · by {metadata.vendor}</span>
          <span className="mt-0.5 block text-sm">{metadata.description}</span>
        </span>
        <span className="text-module inline-flex shrink-0 items-center gap-1 text-sm font-medium">
          <Plus className="size-4" aria-hidden />
          Connect
        </span>
      </button>
    </li>
  );
}

export function IntegrationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const available = useAvailableIntegrations();
  const installs = useInstallations();
  const [search, setSearch] = useState('');

  const metadataBySlug = useMemo(() => {
    const map = new Map<string, ProviderMetadata>();
    for (const meta of available.data ?? []) map.set(meta.slug, meta);
    return map;
  }, [available.data]);

  const connectedSlugs = useMemo(
    () => new Set((installs.data ?? []).map((i) => i.providerSlug)),
    [installs.data]
  );

  const needle = search.trim().toLowerCase();

  // Each kind becomes a group holding its connected connections first, then the
  // services still available to add. A group appears only if it has something in
  // it after filtering.
  const groups = useMemo(() => {
    const matchesText = (text: string) => text.toLowerCase().includes(needle);
    const installations = installs.data ?? [];
    const catalog = available.data ?? [];

    return KIND_ORDER.map((kind) => {
      const connected = installations.filter((i) => {
        if (i.kind !== kind) return false;
        if (!needle) return true;
        const meta = metadataBySlug.get(i.providerSlug);
        return (
          matchesText(meta?.displayName ?? i.providerSlug) ||
          matchesText(meta?.vendor ?? '') ||
          matchesText(kindLabel(kind))
        );
      });
      const availableHere = catalog.filter((meta) => {
        if (!meta.kinds.includes(kind)) return false;
        if (connectedSlugs.has(meta.slug)) return false;
        if (!needle) return true;
        return (
          matchesText(meta.displayName) ||
          matchesText(meta.vendor) ||
          matchesText(meta.description) ||
          matchesText(kindLabel(kind))
        );
      });
      return { kind, connected, availableHere };
    }).filter((group) => group.connected.length > 0 || group.availableHere.length > 0);
  }, [installs.data, available.data, metadataBySlug, connectedSlugs, needle]);

  const connectedCount = installs.data?.length ?? 0;

  const openConnected = (
    installation: Installation,
    event: { shiftKey: boolean; altKey: boolean }
  ) => {
    ctx.open(
      'platform.settings.integration',
      { id: installation.id, slug: installation.providerSlug },
      { target: targetFor(event) }
    );
  };
  const openAvailable = (
    meta: ProviderMetadata,
    kind: ProviderKind,
    event: { shiftKey: boolean; altKey: boolean }
  ) => {
    ctx.open(
      'platform.settings.integration',
      { slug: meta.slug, kind },
      { target: targetFor(event) }
    );
  };

  const sellingOff = isSellingDisabled(available.error) || isSellingDisabled(installs.error);
  const hardError =
    (available.isError && !isSellingDisabled(available.error)) ||
    (installs.isError && !isSellingDisabled(installs.error));

  if (sellingOff) {
    return (
      <div className={PANE_SHELL}>
        <PaneToolbar label="Integration list controls">
          <RefreshButton
            className="ml-auto"
            isFetching={available.isFetching || installs.isFetching}
            updatedAt={undefined}
            onRefresh={() => {
              void available.refetch();
              void installs.refetch();
            }}
          />
        </PaneToolbar>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex h-full max-w-xl items-center justify-center">
            <EmptyState
              icon={<Plug className="size-6" aria-hidden />}
              title="Turn on selling to connect these"
              description="Connections like shipping carriers, card payments and sales tax are part of the selling features. Switch selling on under Modules and they will appear here."
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={(event) => {
                    ctx.open('platform.settings.modules', {}, { target: targetFor(event) });
                  }}
                >
                  Open Modules
                </Button>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (hardError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={<Plug className="size-6" aria-hidden />}
          title="Could not load your integrations"
          description="This is a problem reaching the server. Your existing connections are unaffected and still working."
          actions={
            <Button
              size="sm"
              color="module"
              onClick={() => {
                void available.refetch();
                void installs.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const loading = available.isPending || installs.isPending;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Integration list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search integrations"
            placeholder="Search services…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <p className="ml-auto hidden shrink-0 text-sm whitespace-nowrap @sm:block">
          {connectedCount === 0
            ? 'None connected yet'
            : connectedCount === 1
              ? '1 connected'
              : `${String(connectedCount)} connected`}
        </p>
        <RefreshButton
          isFetching={available.isFetching || installs.isFetching}
          updatedAt={available.data ? available.dataUpdatedAt : undefined}
          onRefresh={() => {
            void available.refetch();
            void installs.refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm" role="status">
            Loading…
          </p>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Plug className="size-6" aria-hidden />}
            title={needle ? 'No services match that' : 'No services to connect yet'}
            description={
              needle
                ? 'Try the name of the service, or clear the search to see everything you can connect.'
                : 'There are no services available to connect right now. Check back as more are added.'
            }
          />
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {groups.map(({ kind, connected, availableHere }) => {
              const KindIcon = kindIcon(kind);
              return (
                <section key={kind} className="card bg-base-100 overflow-hidden">
                  <header className="border-base-300 flex flex-wrap items-start gap-2 border-b px-4 py-3">
                    <span className="bg-base-200 flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <KindIcon className="size-5" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <Heading level={2} className="text-base font-semibold">
                        {kindLabel(kind)}
                      </Heading>
                      <Text className="text-sm">{kindHint(kind)}</Text>
                    </div>
                  </header>
                  <ul>
                    {connected.map((installation) => (
                      <ConnectedRow
                        key={installation.id}
                        installation={installation}
                        metadata={metadataBySlug.get(installation.providerSlug)}
                        onOpen={(event) => {
                          openConnected(installation, event);
                        }}
                      />
                    ))}
                    {availableHere.map((meta) => (
                      <AvailableRow
                        key={meta.slug}
                        metadata={meta}
                        onOpen={(event) => {
                          openAvailable(meta, kind, event);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <p className="shrink-0 px-1 text-xs">
        Click a service to connect or manage it · Shift-click to open alongside · Alt-click for a
        new window
      </p>
    </div>
  );
}
