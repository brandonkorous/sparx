// Create an automation (docs/84 Slice G-UI). Full-page builder, editor-gated
// (a viewer is bounced to the list rather than shown a form that would 403 on
// submit). The builder offers only triggers/actions for the tenant's active
// modules.

import { redirect } from 'next/navigation';
import { Workflow } from 'lucide-react';
import { listEnabledModules, requireSession } from '@sparx/auth';
import { Container, PageHeader, Stack } from '@sparx/ui';

import { AutomationBuilder } from '../_components/automation-builder';

export const dynamic = 'force-dynamic';

export default async function NewAutomationPage() {
  const session = await requireSession();
  const role = session.user.role;
  if (!(role === 'owner' || role === 'admin' || role === 'editor')) redirect('/automations');

  const enabledModules = await listEnabledModules(session.user.tenantId);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Workflow className="h-5 w-5" />}
          title="New automation"
          description="Pick a trigger, add optional conditions, then the actions to run. It's created as a draft — activate it when it looks right."
        />
        <AutomationBuilder enabledModules={enabledModules} />
      </Stack>
    </Container>
  );
}
