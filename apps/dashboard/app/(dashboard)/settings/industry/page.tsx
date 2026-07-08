// Industry — install the right starting config for your vertical across the
// modules you've enabled (categories, tax, pipelines, content types, booking,
// campaigns). Sits beside Modules in settings: Modules picks the CAPABILITY, this
// picks the industry CONFIG. The install is purely ADDITIVE — each preset's marker
// guards a re-stamp, so it only fills empty slots and never removes or migrates a
// tenant's own data. Safe to run again, and safe to add a second vertical's config
// later (a business that expands its lines). Admin-only, like the Modules toggle.

import { Compass } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import type { IndustryStarterView } from './actions';
import { IndustryPicker } from './_components/industry-picker';

export const dynamic = 'force-dynamic';

export default async function IndustrySettingsPage() {
  const session = await requireSession();
  const starters = await api.get<IndustryStarterView[]>('/v1/industry-starters');
  const canEdit = session.user.role === 'owner' || session.user.role === 'admin';
  const active = starters.find((s) => s.active) ?? null;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Compass className="h-5 w-5" />}
          title="Industry"
          description={
            <>
              Pick your industry and we&apos;ll install the right starting config — categories, tax,
              pipelines, content types, booking, and campaigns — across the modules you&apos;ve
              enabled. It only fills empty slots and never removes your own data, so it&apos;s safe
              to re-run or to add another vertical&apos;s config later.
              {!canEdit && ' Only owners and admins can install a starter.'}
            </>
          }
        />

        <IndustryPicker starters={starters} activeSlug={active?.slug ?? null} canEdit={canEdit} />
      </div>
    </div>
  );
}
