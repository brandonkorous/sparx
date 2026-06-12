// Edit an automation (docs/84 Slice G-UI). Full-bleed map + inspector editor,
// pre-filled from the stored row (parsed back into the rich rule document via the
// canonical schema parsers). Editor-gated; a LOCKED rule is bounced to its detail
// (the service rejects edits — the path is "Duplicate to edit").

import { notFound, redirect } from 'next/navigation';
import { listEnabledModules, requireSession } from '@sparx/auth';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { AutomationDto } from '../../_lib/types';
import { parseActions, parseConditions, parseTrigger } from '../../_lib/presentation';
import { AutomationEditor, type EditorInitial } from '../../_components/automation-editor';
import '../../automation-editor.css';

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

  // Editing works on the DRAFT if one is staged (Builder-style draft → publish),
  // else the live published document. The live def keeps running until publish.
  const doc = automation.draft ?? automation;

  const initial: EditorInitial = {
    id: automation.id,
    name: doc.name,
    description: doc.description,
    status: automation.status,
    version: automation.version,
    publishedAt: automation.publishedAt,
    hasDraft: automation.draft !== null,
    trigger: parseTrigger(doc.triggerType, doc.triggerConfig) ?? {
      kind: 'event',
      eventType: doc.triggerType,
    },
    conditions: parseConditions(doc.conditions),
    actions: parseActions(doc.actions),
    maxDepth: doc.maxDepth,
  };

  return <AutomationEditor enabledModules={enabledModules} initial={initial} />;
}
