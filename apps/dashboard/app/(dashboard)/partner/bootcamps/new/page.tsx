import { api } from '@/lib/api-rest-client';

import { UnsavedGuardProvider } from '../../../_components/unsaved-guard';
import { PartnerLocked } from '../../_components/partner-locked';
import type { PartnerProfile } from '../../_lib/types';
import { BootcampForm } from '../_components/bootcamp-form';

// Full-page create surface for a bootcamp (docs/114 §B.7). The shared BootcampForm
// renders on the `embedded` SurfaceFrame — NOT the @detail overlay (module-coupled;
// partner isn't a module, so Finance's full-page approach applies). Wraps in
// UnsavedGuardProvider and renders the frame directly (no Container/PageHeader).

export const dynamic = 'force-dynamic';

export default async function NewBootcampPage() {
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (profile?.status !== 'active') return <PartnerLocked section="Bootcamps" />;

  return (
    <UnsavedGuardProvider>
      <BootcampForm mode="create" partnerTier={profile.tier} />
    </UnsavedGuardProvider>
  );
}
