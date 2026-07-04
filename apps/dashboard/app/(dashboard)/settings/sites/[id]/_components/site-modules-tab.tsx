'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  ModuleProvider,
  Stack,
  Switch,
  Text,
  toast,
  type SparxModule,
} from '@sparx/ui';

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
    <Card variant="default">
      <CardHeader>
        <Heading level={3}>Modules on this site</Heading>
        <CardDescription>
          Turn a module off to hide it on this site only — it stays available on your other sites.
          You can&apos;t turn on a module that&apos;s off for the whole workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--color-border-default)]">
          {MODULES.map((m) => {
            const enabled = !moduleScope.includes(m.slug);
            return (
              <ModuleProvider key={m.slug} module={m.slug}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full bg-[var(--module-active)]"
                  />
                  <Stack gap={0} className="min-w-0 flex-1">
                    <Text weight="medium" size="sm">
                      {m.label}
                    </Text>
                    <Text size="xs" variant="muted">
                      {m.description}
                    </Text>
                  </Stack>
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
      </CardContent>
    </Card>
  );
}
