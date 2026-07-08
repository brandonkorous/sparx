import { notFound } from 'next/navigation';
import { PageHeader } from '@sparx/ui';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { GeneralForm } from './general-form';
import { BecomePartnerCard } from './_components/become-partner-card';

interface TenantCard {
  id: string;
  name: string;
  email: string;
  slug: string;
  plan: string;
}

// First real database-backed dashboard page. Now reads the tenant
// through api-rest (`GET /v1/tenant`) instead of Prisma directly — the
// dashboard no longer touches the database.
export default async function GeneralSettingsPage() {
  let tenant: TenantCard;
  try {
    tenant = await api.get<TenantCard>('/v1/tenant');
  } catch (err) {
    if ((err as ApiRestError).status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          title="General settings"
          description="Update how your account presents itself."
        />
        <GeneralForm
          tenant={{
            name: tenant.name,
            email: tenant.email,
            slug: tenant.slug,
            plan: tenant.plan,
          }}
        />
        <BecomePartnerCard />
      </div>
    </div>
  );
}
