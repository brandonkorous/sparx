import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { NewDocumentForm } from './_components/new-document-form';

export const dynamic = 'force-dynamic';

interface WorkflowLite {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}
interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}
interface B2bAccountLite {
  id: string;
  companyName: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewDocumentPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const [workflows, customers, b2bAccounts] = await Promise.all([
    api.get<WorkflowLite[]>('/v1/invoicing/workflows'),
    api
      .getPaged<CustomerLite[]>('/v1/crm/customers?take=200&sort_by=updatedAt')
      .then((r) => r.data),
    api
      .getPaged<B2bAccountLite[]>('/v1/crm/b2b-accounts?take=200')
      .then((r) => r.data)
      .catch(() => []),
  ]);

  const preselectedCustomerId = stringParam(sp.customerId) ?? null;
  const preselectedAccountId = stringParam(sp.b2bAccountId) ?? null;

  return (
    <Container size="lg">
      <Stack gap={6} className="py-8">
        <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
          <Link href="/invoicing">All documents</Link>
        </Button>
        <PageHeader
          title="New document"
          description="Pick a workflow and who it bills. You'll compose the line items, advance its stage, take payment and print from the document editor."
        />

        <NewDocumentForm
          workflows={workflows.map((w) => ({ id: w.id, label: w.name, isDefault: w.isDefault }))}
          customers={customers.map((c) => ({
            id: c.id,
            label:
              [c.firstName, c.lastName].filter(Boolean).join(' ') ||
              (c.company ?? c.email ?? c.id.slice(0, 8)),
          }))}
          b2bAccounts={b2bAccounts.map((a) => ({ id: a.id, label: a.companyName }))}
          preselectedCustomerId={preselectedCustomerId}
          preselectedAccountId={preselectedAccountId}
        />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
