// Modules — per-tenant activation toggles.
//
// The same switchboard a tenant met on the pricing page and in onboarding, now
// wired to the live workspace: one Switch per module, expandable for detail,
// with the price and any Included/Required lock shown inline. Owner/admin
// mutations persist through `setModuleEnabledAction`; viewers see it read-only.
// The activation hook (in api-rest) publishes `module.activated`, which runs any
// in-process bootstrap the module needs (CRM seeds its default pipeline + built-in
// segments, email seeds default automations) idempotently.

import { Layers } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Card, CardContent, CardHeader, CardTitle, Container, PageHeader, Stack } from '@sparx/ui';

import { listModuleStateForCurrentTenant } from './actions';
import { ModuleSwitchboard } from './_components/module-switchboard';

export const dynamic = 'force-dynamic';

export default async function ModulesSettingsPage() {
  const session = await requireSession();
  const states = await listModuleStateForCurrentTenant();
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="Modules"
          description={
            <>
              Switch modules on or off for this tenant — each is billed only while it&apos;s active.
              A disabled module returns 404 from its API surface, runs no consumers, and stores no
              rows.
              {!canEdit && ' Only owners and admins can change activation state.'}
            </>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Module activation</CardTitle>
          </CardHeader>
          <CardContent>
            <ModuleSwitchboard states={states} canEdit={canEdit} />
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
