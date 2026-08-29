'use client';

// One site that already exists — rename it, choose what it shows, retire it.

import { useEffect, useMemo, useState } from 'react';
import { Card, useToast } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { useModuleStates } from '../../lib/api/shell-data';
import { useDirtySource } from '../../lib/workbench/dirty';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDomains, useSite, useUpdateSite } from './data';
import { SiteAddressLine, SiteNameFields, SiteTrafficSection } from './site-manage-body';
import { SiteScope } from './site-manage-scope';
import { ManageToolbar, RareMoves } from './site-manage-actions';

export function ManageSite({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const toast = useToast();
  const { data: site, isError, error, isPending, refetch, isFetching, dataUpdatedAt } = useSite(id);
  const { data: modules } = useModuleStates();
  const { data: domains } = useDomains();
  const update = useUpdateSite(id);

  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (site && !loaded) {
      setName(site.name);
      setLoaded(true);
    }
  }, [site, loaded]);

  useEffect(() => {
    if (site) ctx.setTitle(site.name);
  }, [ctx, site]);

  const dirty = loaded && site !== undefined && name.trim() !== site.name;
  useDirtySource(dirty, 'This site has an unsaved name change. Close anyway?');

  // The address a visitor would actually type: the canonical one when a site has
  // named it, otherwise the first that still works. Every site has at least its
  // piggles.site subdomain, so this is normally present.
  const host = useMemo(() => {
    const mine = (domains ?? []).filter(
      (domain) => domain.propertyId === id && domain.status !== 'removed'
    );
    return (mine.find((domain) => domain.isCanonical) ?? mine[0])?.host ?? null;
  }, [domains, id]);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="site"
            title="Could not load this site"
            description="This is a problem reaching the server. Nothing about the site has changed."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !site) return <PaneWaiting />;

  /** `moduleScope` stores what is switched OFF, so the switch state is its
   *  inverse. Writing the array back is full-replace, not a merge. */
  const setModule = (slug: string, visible: boolean) => {
    const next = visible
      ? site.moduleScope.filter((s) => s !== slug)
      : [...new Set([...site.moduleScope, slug])];
    update.mutate(
      { moduleScope: next },
      {
        onError: () => {
          toast.add({ title: 'Could not change that', type: 'error' });
        },
      }
    );
  };

  const save = () => {
    update.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          toast.add({ title: 'Site name saved', type: 'success' });
        },
        onError: () => {
          toast.add({ title: 'Could not save the name', type: 'error' });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <ManageToolbar
        site={site}
        dirty={dirty}
        saving={update.isPending}
        onSave={save}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={dataUpdatedAt}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <SiteAddressLine host={host} />

          <SiteTrafficSection
            propertyId={site.id}
            onOpenDomains={(beside) => {
              ctx.open('platform.settings.domains', undefined, {
                target: beside ? 'beside' : 'tab',
              });
            }}
          />

          <SiteNameFields name={name} onName={setName} handle={site.slug} host={host} />

          <SiteScope
            site={site}
            enabledModules={(modules ?? []).filter((m) => m.enabled).map((m) => m.slug)}
            saving={update.isPending}
            onToggle={setModule}
          />

          <RareMoves ctx={ctx} site={site} />
        </div>
      </div>
    </div>
  );
}
