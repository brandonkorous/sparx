import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Container, ModuleProvider, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import type { PartnerProfile } from '../../_lib/types';
import { PrintButton } from '../_components/print-button';
import { ProposalBuilder } from './_components/proposal-builder';

// Partner resource — the client-proposal builder (docs/114 §B.7). Prefills the
// "prepared by" line from the partner's own directory name when available (the
// profile read is viewer-gated, so it's null for a non-partner just browsing).

export const dynamic = 'force-dynamic';

export default async function PartnerProposalPage() {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);

  return (
    <ModuleProvider module="partner">
      <Container size="lg">
        <Stack gap={8} className="py-10">
          <Link
            href="/partner/resources"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Resources
          </Link>
          <PageHeader
            icon={<FileText className="h-5 w-5" />}
            title="Client proposal"
            description="Fill in the client and the modules you’ll set up — a clean proposal renders below, ready to print or save as a PDF."
            actions={<PrintButton label="Print proposal" />}
          />
          <ProposalBuilder defaultPreparedBy={profile?.displayName ?? ''} />
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
