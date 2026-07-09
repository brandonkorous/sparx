import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star, Archive, Users, Code2 } from 'lucide-react';

import { Badge, Card, CardBody, CardTitle, EmptyState, Table } from '@wizeworks/silicaui-react';
import { Stat, statusLabel } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { RecomputeButton } from '../_components/recompute-button';

export const dynamic = 'force-dynamic';

interface Segment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isBuiltIn: boolean;
  archivedAt: string | null;
  rules: unknown;
  createdAt: string;
  updatedAt: string;
}

interface SegmentMember {
  customerId: string;
  enteredAt: string;
  customer: {
    type: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string | null;
    totalSpent: string | number;
  };
}

interface Props {
  id: string;
}

export async function SegmentDetailContent({ id }: Props) {
  let segment: Segment;
  try {
    segment = await api.get<Segment>(`/v1/crm/segments/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [{ data: members, meta }] = await Promise.all([
    api.getPaged<SegmentMember[]>(`/v1/crm/segments/${id}/members?limit=100`),
  ]);
  const total = (meta?.total as number | undefined) ?? members.length;

  return (
    // @container so the body responds to its OWN width — full-page (wide) vs. the
    // detail drawer (narrow), where viewport breakpoints would crush the columns.
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{segment.name}</h1>
            {segment.isBuiltIn && (
              <Badge color="neutral" variant="soft" size="sm">
                <Star className="h-3 w-3" /> Built-in
              </Badge>
            )}
            {segment.archivedAt && (
              <Badge color="warning">
                <Archive className="h-3 w-3" /> Archived
              </Badge>
            )}
            <code className="text-base-content/50 text-xs">{segment.slug}</code>
          </div>
          <RecomputeButton segmentId={segment.id} />
        </div>
        {segment.description && (
          <p className="text-base-content/70 text-base">{segment.description}</p>
        )}
      </div>

      <div className="grid gap-4 @[600px]:grid-cols-3">
        <Card className="bg-module bg-soft">
          <CardBody className="py-4">
            <Stat label="Members" value={total.toLocaleString()} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat label="Created" value={new Date(segment.createdAt).toLocaleDateString()} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat label="Updated" value={new Date(segment.updatedAt).toLocaleDateString()} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle>
            <div className="flex flex-row items-center gap-2">
              <Code2 className="h-4 w-4" /> Rule
            </div>
          </CardTitle>
          <pre className="bg-base-200 overflow-x-auto rounded-md p-3 text-xs">
            {JSON.stringify(segment.rules, null, 2)}
          </pre>
          <p className="text-base-content/70 mt-2 text-xs">
            {segment.isBuiltIn
              ? 'Built-in segments are read-only — clone to customize. (Visual rule editor lands in the next dashboard iteration.)'
              : 'Visual rule editor lands in the next dashboard iteration; until then the JSON above is the source of truth and can be edited via the API.'}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle>
            <div className="flex flex-row items-center gap-2">
              <Users className="h-4 w-4" /> Members
              <Badge color="neutral" variant="soft" size="sm">
                {total}
              </Badge>
            </div>
          </CardTitle>
          {members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description={
                segment.isBuiltIn
                  ? 'Membership is updated as events flow. Place an order or import customers, then check back.'
                  : 'New segments only materialise after a recompute. Click Recompute above to evaluate every customer against the rule, then refresh.'
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th className="text-right">Spent</th>
                  <th>Entered</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.customerId}>
                    <td>
                      <Link
                        href={`/crm/customers/${m.customerId}`}
                        className="hover:text-module text-sm font-medium hover:underline"
                      >
                        {customerLabel(m.customer)}
                      </Link>
                    </td>
                    <td>
                      <Badge color="neutral" variant="soft" size="sm">
                        {statusLabel(m.customer.type)}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums">
                      ${Number(m.customer.totalSpent).toLocaleString()}
                    </td>
                    <td>
                      <p className="text-base-content/70 text-sm">
                        {new Date(m.enteredAt).toLocaleDateString()}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function customerLabel(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
  return fullName !== '' ? fullName : (c.company ?? c.email ?? 'Unnamed customer');
}
