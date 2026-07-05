import Link from 'next/link';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  Badge,
  Card,
  Heading,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  cn,
} from '@sparx/ui';
import {
  OperatorApiError,
  type OperatorPartnerApplication,
  type OperatorPartnerListItem,
} from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate } from '@/lib/format';
import { partnerKindLabel, partnerStatusTone, tierLabel, tierTone } from '@/lib/partners';
import { ApplicationsTable } from './_components/applications-table';
import { PayoutActions } from './_components/payout-actions';

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
] as const;

type AppStatus = (typeof STATUS_TABS)[number]['value'];

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const operator = await requireCapability('partner:read');
  const canAct = hasCapability(operator, 'partner:act');
  const sp = await searchParams;
  const status: AppStatus = STATUS_TABS.some((t) => t.value === sp.status)
    ? (sp.status as AppStatus)
    : 'pending';

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'partner:read',
      action: 'partners.view',
    });
  } catch {
    // best-effort audit
  }

  let applications: OperatorPartnerApplication[] = [];
  let roster: OperatorPartnerListItem[] = [];
  let error: string | null = null;
  try {
    [applications, roster] = await Promise.all([
      operatorApi().listPartnerApplications(operator.id, status === 'all' ? undefined : status),
      operatorApi().listPartners(operator.id),
    ]);
  } catch (err) {
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Partners"
        description="The Sparx Partner Program — review applications, manage the partner roster and tiers, and run commission payouts. Freelancers, agencies, and educators who refer and build on Sparx."
      />

      {error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Stack gap={4}>
              <Stack direction="row" align="center" justify="between" className="flex-wrap gap-3">
                <Heading level={3}>Applications</Heading>
                <nav className="flex flex-wrap items-center gap-4" aria-label="Filter applications">
                  {STATUS_TABS.map((t) => (
                    <Link
                      key={t.value}
                      href={
                        t.value === 'pending'
                          ? '/sparx/partners'
                          : `/sparx/partners?status=${t.value}`
                      }
                      aria-current={status === t.value ? 'page' : undefined}
                      className={cn(
                        'border-b-2 pb-1 text-sm font-medium transition-colors',
                        status === t.value
                          ? 'border-[var(--module-active)] text-[var(--color-text-primary)]'
                          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                      )}
                    >
                      {t.label}
                    </Link>
                  ))}
                </nav>
              </Stack>
              {applications.length === 0 ? (
                <Text variant="muted">
                  {status === 'pending'
                    ? 'No applications waiting for review.'
                    : `No ${status === 'all' ? '' : status} applications.`}
                </Text>
              ) : (
                <ApplicationsTable applications={applications} canAct={canAct} />
              )}
            </Stack>
          </Card>

          {canAct ? (
            <Card>
              <Stack gap={3}>
                <Stack gap={1}>
                  <Heading level={3}>Commissions &amp; payouts</Heading>
                  <Text size="sm" variant="muted">
                    Approve commissions past their clawback window, then run the monthly Stripe
                    Connect payout batch to active partners.
                  </Text>
                </Stack>
                <PayoutActions />
              </Stack>
            </Card>
          ) : null}

          <Card>
            <Stack gap={3}>
              <Stack gap={1}>
                <Heading level={3}>Active partners</Heading>
                <Text size="sm" variant="muted">
                  Suspended partners leave this list — reinstate one from its detail page.
                </Text>
              </Stack>
              {roster.length === 0 ? (
                <Text variant="muted">No active partners yet.</Text>
              ) : (
                <RosterTable partners={roster} />
              )}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}

function RosterTable({ partners }: { partners: OperatorPartnerListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Partner</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Referral code</TableHead>
          <TableHead>Payouts</TableHead>
          <TableHead>Approved</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((p) => (
          <TableRow key={p.tenantId}>
            <TableCell>
              <Stack gap={0}>
                <Link
                  href={`/sparx/partners/${p.tenantId}`}
                  className="font-medium text-[var(--color-text-primary)] hover:underline"
                >
                  {p.displayName}
                </Link>
                <Text size="xs" variant="muted">
                  {partnerKindLabel(p.kind)}
                </Text>
              </Stack>
            </TableCell>
            <TableCell>
              <Badge color={tierTone(p.tier)} variant="soft">
                {tierLabel(p.tier)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge color={partnerStatusTone(p.status)} variant="soft">
                {p.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" className="font-mono">
                {p.referralCode}
              </Text>
            </TableCell>
            <TableCell>
              <Badge color={p.hasPayoutAccount ? 'success' : 'neutral'} variant="soft">
                {p.hasPayoutAccount ? 'Connected' : 'Not set up'}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(p.approvedAt) ?? '—'}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
