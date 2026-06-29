import { requireSession } from '@sparx/auth';

import { api } from '@/lib/api-rest-client';

import { NewTaskForm } from './_components/new-task-form';

export const dynamic = 'force-dynamic';

interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

interface TenantUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTaskPage({ searchParams }: PageProps) {
  // requireSession stays — we need currentUserId for the form prop. Customers
  // and users both load from api-rest now.
  const session = await requireSession();
  const sp = await searchParams;

  const [customers, users] = await Promise.all([
    api.getPaged<CustomerLite[]>('/v1/crm/customers?take=200').then((r) => r.data),
    api.get<TenantUser[]>('/v1/users?take=100'),
  ]);

  // The embedded SurfaceFrame supplies the title + chrome — no Container/PageHeader.
  return (
    <NewTaskForm
      surface="page"
      currentUserId={session.user.id}
      users={users.map((u) => ({
        id: u.id,
        label: u.name ?? u.email ?? u.id.slice(0, 8),
      }))}
      customers={customers.map((c) => ({
        id: c.id,
        label:
          [c.firstName, c.lastName].filter(Boolean).join(' ') ||
          (c.company ?? c.email ?? c.id.slice(0, 8)),
      }))}
      preselectedCustomerId={stringParam(sp.customerId) ?? null}
      preselectedDealId={stringParam(sp.dealId) ?? null}
    />
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
