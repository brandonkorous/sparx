import { api } from '@/lib/api-rest-client';

import { UnsavedGuardProvider } from '../../_components/unsaved-guard';
import { PartnerLocked } from '../_components/partner-locked';
import { PartnerAccessLocked } from '../_components/partner-access-locked';
import { getPartnerAccess } from '../_lib/access';
import type { PartnerProfile } from '../_lib/types';
import { PartnerProfileEditForm } from './_components/profile-edit-form';

// Partner Portal — Profile (docs/114 §B.7). The partner's public directory listing,
// edited on the standard full-page `embedded` SurfaceFrame (surface="page"). Like
// every other embedded edit route it wraps in UnsavedGuardProvider and renders the
// frame directly — no page-level Container/PageHeader (the frame owns the title).

export const dynamic = 'force-dynamic';

export default async function PartnerProfilePage() {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (!profile) return <PartnerLocked section="Profile" />;
  const { canOperate } = await getPartnerAccess();
  if (!canOperate) return <PartnerAccessLocked section="Profile" />;

  return (
    <UnsavedGuardProvider>
      <PartnerProfileEditForm profile={profile} />
    </UnsavedGuardProvider>
  );
}
