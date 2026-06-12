// Edit an automation (docs/84 Slice G-UI). Full-page builder pre-filled from the
// stored row (parsed back into the rich rule document via the canonical schema
// parsers). Editor-gated; a LOCKED rule is bounced to its detail (the service
// rejects edits — the path is "Duplicate to edit").

import { notFound, redirect } from 'next/navigation';
import { Workflow } from 'lucide-react';
import { listEnabledModules, requireSession } from '@sparx/auth';
import { Container, PageHeader, Stack } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { AutomationDto } from '../../_lib/types';
import { parseActions, parseConditions, parseTrigger } from '../../_lib/presentation';
import { AutomationBuilder, type BuilderInitial } from '../../_components/automation-builder';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAutomationPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  const role = session.user.role;
  if (!(role === 'owner' || role === 'admin' || role === 'editor')) redirect(`/automations/${id}`);

  let automation: AutomationDto;
  try {
    automation = await api.get<AutomationDto>(`/v1/automations/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  // Locked = platform-managed; the service rejects edits. Send the tenant to the
  // detail, where "Duplicate to edit" is the supported path.
  if (automation.locked) redirect(`/automations/${id}`);

  const enabledModules = await listEnabledModules(session.user.tenantId);

  const initial: BuilderInitial = {
    id: automation.id,
    name: automation.name,
    description: automation.description,
    trigger:
      parseTrigger(automation.triggerType, automation.triggerConfig) ??
      { kind: 'event', eventType: automation.triggerType },
    conditions: parseConditions(automation.conditions),
    actions: parseActions(automation.actions),
    maxDepth: automation.maxDepth,
  };

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Workflow className="h-5 w-5" />}
          title={`Edit ${automation.name}`}
          description="Changes take effect on the next trigger. Status is unchanged unless you set it."
        />
        <AutomationBuilder enabledModules={enabledModules} initial={initial} />
      </Stack>
    </Container>
  );
}
