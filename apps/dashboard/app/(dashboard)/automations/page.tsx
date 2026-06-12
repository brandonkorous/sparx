// Automations list (docs/81 §8, docs/84 Slice G-UI) — the platform-level surface
// for the cross-module rule engine. Reads `/v1/automations` (the API-first spine
// the dashboard + MCP both consume) and renders the list with status filters,
// per-row module tags + run stats, and quick enable/pause. A standard docs/34
// List surface, full width.
//
// Platform capability, not a module: no ModuleGate. The page is reachable
// whenever ≥1 trigger-capable module is active; with none, it points the tenant
// at module activation instead of an empty rule list.

import Link from 'next/link';
import { Plus, Workflow } from 'lucide-react';
import { listEnabledModules, requireSession } from '@sparx/auth';
import { Badge, Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import type { AutomationDto } from './_lib/types';
import { AutomationList } from './_components/automation-list';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  const session = await requireSession();
  const [enabledModules, automations] = await Promise.all([
    listEnabledModules(session.user.tenantId),
    api.get<AutomationDto[]>('/v1/automations'),
  ]);

  const role = session.user.role;
  const canWrite = role === 'owner' || role === 'admin' || role === 'editor';

  if (enabledModules.length === 0) {
    return (
      <Container size="full">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Workflow className="h-5 w-5" />}
            title="Automations"
            description="Cross-module “when X, if Y, do Z” rules that connect your Sparx modules."
          />
          <Card padding="none">
            <EmptyState
              icon={<Workflow className="h-5 w-5" />}
              title="Activate a module first"
              description="Automations connect your modules — activate at least one to start authoring rules."
              action={
                <Button asChild color="module">
                  <Link href="/settings/modules">Add a module</Link>
                </Button>
              }
            />
          </Card>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Workflow className="h-5 w-5" />}
          title="Automations"
          badge={
            <Badge color="module">
              {automations.length} automation{automations.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Cross-module “when X, if Y, do Z” rules. Author here, or ask the AI assistant to build one."
          actions={
            canWrite ? (
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/automations/new">New automation</Link>
              </Button>
            ) : undefined
          }
        />

        {automations.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Workflow className="h-5 w-5" />}
              title="No automations yet"
              description="Create your first rule to trigger actions when events happen across your modules."
              action={
                canWrite ? (
                  <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                    <Link href="/automations/new">New automation</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <AutomationList automations={automations} canWrite={canWrite} />
        )}
      </Stack>
    </Container>
  );
}
