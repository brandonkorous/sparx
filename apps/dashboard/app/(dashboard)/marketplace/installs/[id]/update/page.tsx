// Blueprint UPDATE review surface (docs/55 §6, §11). Previews the changeset for the
// catalog's current version (GET …/update — read-only), then lets the tenant review
// conflicts and apply. Your edits are kept by default; nothing is overwritten or
// deleted automatically.

import { notFound } from 'next/navigation';
import { LayoutTemplate } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { UpdateReview } from './_components/update-review';
import type { UpdatePlan } from './_types';

export const dynamic = 'force-dynamic';

export default async function UpdateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const canManage = session.user.role === 'owner' || session.user.role === 'admin';

  const plan = await api
    .get<UpdatePlan>(`/v1/blueprints/installs/${encodeURIComponent(id)}/update`)
    .catch(() => null);
  if (!plan) notFound();

  const summary = await api
    .get<{ name: string }>(`/v1/blueprints/${encodeURIComponent(plan.blueprintKey)}`)
    .catch(() => null);
  const name = summary?.name ?? plan.blueprintKey;

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title={`Update “${name}”`}
          description={
            plan.updatable
              ? `From v${plan.fromVersion} to v${plan.toVersion}. Your edits are kept by default — review any conflicts below.`
              : `You're already on the latest version (v${plan.fromVersion}).`
          }
        />
        <UpdateReview installId={id} blueprintName={name} plan={plan} canManage={canManage} />
      </div>
    </div>
  );
}
