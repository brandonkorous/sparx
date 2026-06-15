// /builder/governance — the brand-designer's builder governance surface (docs/61
// §8 Phase 6b). Today: the utility ALLOWLIST — the tenant's tighten-only safety
// policy over which styling classes any author can compile, across all their
// sites. The builder layout is gate-only (no ModuleProvider), so this page
// supplies its own module color. (Part B adds a "Brand sections" tab here for the
// archetype set.)

import { requireSession } from '@sparx/auth';
import { Container, ModuleProvider, PageHeader, Stack } from '@sparx/ui';
import { ShieldCheck } from 'lucide-react';

import { getAllowlist, getBlockedClasses } from '../_governance/lib/api';
import { AllowlistCenter } from '../_governance/components/allowlist-center';

export const dynamic = 'force-dynamic';

export default async function BuilderGovernancePage() {
  const [session, allowlist, blocked] = await Promise.all([
    requireSession(),
    getAllowlist(),
    getBlockedClasses(),
  ]);
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';

  return (
    <ModuleProvider module="builder">
      <Container size="lg">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Governance"
            description="Set the guardrails for what authors can build. The utility allowlist controls which styling classes are allowed to compile across all your sites."
          />
          <AllowlistCenter initial={allowlist} blocked={blocked} canEdit={canEdit} />
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
