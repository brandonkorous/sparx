// Modules — per-tenant activation toggles.
//
// Owner-only mutations; viewers see the state read-only. Each row is one
// slug from ModuleSlug with a description + toggle. The activation hook
// also runs any in-process bootstrap the module needs (CRM seeds the
// default pipeline + built-in segments idempotently).

import { Layers } from 'lucide-react';
import { requireSession, type ModuleSlug } from '@sparx/auth';
import { Card, CardContent, CardHeader, CardTitle, Container, PageHeader, Stack } from '@sparx/ui';

import { listModuleStateForCurrentTenant } from './actions';
import { ModuleToggleRow } from './_components/module-toggle-row';

export const dynamic = 'force-dynamic';

interface ModuleMeta {
  slug: ModuleSlug;
  label: string;
  description: string;
}

const MODULES: ModuleMeta[] = [
  {
    slug: 'builder',
    label: 'Builder',
    description: 'Site builder — themes, layouts, pages, custom domains.',
  },
  { slug: 'commerce', label: 'Commerce', description: 'Products, variants, inventory, pricing.' },
  { slug: 'cms', label: 'CMS', description: 'Pages, blog posts, media library, navigation.' },
  {
    slug: 'crm',
    label: 'CRM',
    description: 'Customers, deals, segments, tasks, B2B accounts, reports.',
  },
  {
    slug: 'email',
    label: 'Email',
    description: 'Broadcasts, automations, transactional templates.',
  },
  {
    slug: 'b2b',
    label: 'B2B & Wholesale',
    description: 'Tiered pricing, quotes, credit terms, fleet pricing.',
  },
  {
    slug: 'invoicing',
    label: 'Invoicing',
    description: 'Estimates, work orders, invoices, payments, and AR aging.',
  },
  {
    slug: 'dropship',
    label: 'Dropship',
    description: 'Supplier catalog sync, order routing, inventory feeds.',
  },
  {
    slug: 'inventory',
    label: 'Inventory',
    description: 'Stock levels, locations, supplier feeds, low-stock alerts.',
  },
  {
    slug: 'chat',
    label: 'Live Chat',
    description: 'Storefront chat widget, AI replies, and a staff inbox.',
  },
  { slug: 'ai', label: 'AI', description: 'Sparx AI assistant features inside the dashboard.' },
];

const LABELS: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.slug, m.label]));

function joinLabels(slugs: ModuleSlug[]): string {
  const names = slugs.map((s) => LABELS[s] ?? s);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

export default async function ModulesSettingsPage() {
  const session = await requireSession();
  const states = await listModuleStateForCurrentTenant();
  const stateBySlug = new Map(states.map((s) => [s.slug, s]));
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="Modules"
          description={
            <>
              Activate or deactivate modules for this tenant. Disabled modules return 404 from their
              API surface, run no consumers, and store no rows.
              {!canEdit && ' Only owners and admins can change activation state.'}
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Module activation</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              {MODULES.map((m) => {
                const state = stateBySlug.get(m.slug);
                const enabled = state?.enabled ?? false;
                // A required dependency (Commerce while B2B is on) or a bundled
                // capability (invoicing via B2B/Commerce) can't be toggled here.
                const requiredBy = state?.requiredBy ?? [];
                const bundled = state?.source === 'bundled';
                const lockedReason =
                  requiredBy.length > 0
                    ? `Required by ${joinLabels(requiredBy)}`
                    : bundled
                      ? `Included with ${joinLabels(state?.includedBy ?? [])}`
                      : undefined;
                return (
                  <ModuleToggleRow
                    // Key on enabled so a cascade (enabling B2B flips Commerce +
                    // Invoicing) remounts the affected rows after revalidatePath.
                    key={`${m.slug}-${enabled}-${lockedReason ?? ''}`}
                    slug={m.slug}
                    label={m.label}
                    description={m.description}
                    initialEnabled={enabled}
                    disabled={!canEdit}
                    lockedReason={lockedReason}
                  />
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
