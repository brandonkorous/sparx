// /builder/governance — the brand-designer's governance area (docs/61 §6/§8
// Phase 6b). Shared chrome (module color + page header + the two route tabs) for
// both governance surfaces: Brand sections (the archetype set) and the Utility
// allowlist. The builder layout is gate-only (no ModuleProvider), so this supplies
// its own module color.

import type { ReactNode } from 'react';
import { Container, ModuleProvider, PageHeader, Stack } from '@sparx/ui';
import { ShieldCheck } from 'lucide-react';

import { GovernanceTabs } from '../_governance/components/governance-tabs';

export default function GovernanceLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleProvider module="builder">
      <Container size="lg">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Governance"
            description="Set the guardrails for what authors can build — the brand sections they can stamp onto a page, and which styling classes are allowed to compile across all your sites."
          />
          <GovernanceTabs />
          {children}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
