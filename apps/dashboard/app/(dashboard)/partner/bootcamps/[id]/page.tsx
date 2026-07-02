import { notFound } from 'next/navigation';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { UnsavedGuardProvider } from '../../../_components/unsaved-guard';
import { PartnerLocked } from '../../_components/partner-locked';
import type { Bootcamp, PartnerProfile } from '../../_lib/types';
import { BootcampForm } from '../_components/bootcamp-form';

// Full-page edit surface for a bootcamp (docs/114 §B.7). Same shared BootcampForm
// on the `embedded` SurfaceFrame; the frame header carries the Publish/Cancel
// lifecycle actions. Wraps in UnsavedGuardProvider so the guard fires on leave.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BootcampDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await api.get<PartnerProfile | null>('/v1/partner/profile').catch(() => null);
  if (!profile) return <PartnerLocked section="Bootcamps" />;

  let bootcamp: Bootcamp;
  try {
    bootcamp = await api.get<Bootcamp>(`/v1/partner/bootcamps/${id}`);
  } catch (err) {
    if ((err as ApiRestError).status === 404) notFound();
    throw err;
  }

  return (
    <UnsavedGuardProvider>
      <BootcampForm mode="edit" bootcamp={bootcamp} partnerTier={profile.tier} />
    </UnsavedGuardProvider>
  );
}
