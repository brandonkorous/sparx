'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ModuleProvider, toast, type SparxModule } from '@sparx/ui';
import { Card, CardBody, Switch } from '@wizeworks/silicaui-react';

import { updateModuleScope } from '../../actions';

// Modules tab of the site detail — per-site module visibility (docs/49 Slice F).
// `moduleScope` stores the DISABLED module keys for this site; a module is hidden
// on THIS site only. Tenant-level activation is the master gate — you can't turn
// on a module that's off for the whole workspace (api-rest enforces).

const MODULES: { slug: SparxModule; label: string; description: string }[] = [
  { slug: 'commerce', label: 'Commerce', description: 'Products, cart, checkout, and orders' },
  { slug: 'cms', label: 'CMS', description: 'Blog posts, articles, and pages' },
  { slug: 'b2b', label: 'B2B / Wholesale', description: 'Accounts, price tiers, and quotes' },
  { slug: 'email', label: 'Email', description: 'Broadcasts and transactional email' },
  { slug: 'dropship', label: 'Dropship', description: 'Supplier catalogs and routed fulfillment' },
  { slug: 'ai', label: 'AI & MCP', description: 'Assistant tools and integrations' },
];

export function SiteModulesTab({
  propertyId,
  moduleScope,
}: {
  propertyId: string;
  moduleScope: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function toggle(slug: string, enabled: boolean) {
    // `enabled` is the desired NEW state; moduleScope stores DISABLED keys.
    const next = enabled
      ? moduleScope.filter((s) => s !== slug)
      : [...new Set([...moduleScope, slug])];
    startTransition(async () => {
      const res = await updateModuleScope(propertyId, next);
      if (res.ok) {
        toast.success(enabled ? `${slug} shown on this site.` : `${slug} hidden on this site.`);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-xl font-semibold">Modules on this site</h3>
        <p className="opacity-70">
          Turn a module off to hide it on this site only — it stays available on your other sites.
          You can&apos;t turn on a module that&apos;s off for the whole workspace.
        </p>
      </CardBody>
      <div className="divide-base-300 divide-y">
        {MODULES.map((m) => {
          const enabled = !moduleScope.includes(m.slug);
          return (
            <ModuleProvider key={m.slug} module={m.slug}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="bg-module size-2.5 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-0">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-base-content text-xs">{m.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={pending}
                  onCheckedChange={(v) => toggle(m.slug, v)}
                  aria-label={`${m.label} on this site`}
                />
              </div>
            </ModuleProvider>
          );
        })}
      </div>
    </Card>
  );
}
