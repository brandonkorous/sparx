import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  Badge,
  Card,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import {
  OperatorApiError,
  type OperatorPartnerCommission,
  type OperatorPartnerDetail,
  type OperatorPartnerPayoutRun,
  type OperatorPartnerReferral,
} from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate, formatMoneyCents } from '@/lib/format';
import {
  commissionStatusTone,
  partnerKindLabel,
  partnerStatusTone,
  referralStatusTone,
  tierLabel,
  tierTone,
} from '@/lib/partners';
import { PartnerControls } from './_components/partner-controls';

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const operator = await requireCapability('partner:read');
  const canAct = hasCapability(operator, 'partner:act');
  const { tenantId } = await params;

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'partner:read',
      action: 'partner.detail.view',
      targetTenantId: tenantId,
    });
  } catch {
    // best-effort audit
  }

  let detail: OperatorPartnerDetail | null = null;
  let error: string | null = null;
  try {
    detail = await operatorApi().getPartner(tenantId, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  const backLink = (
    <Link href="/sparx/partners" className="text-sm text-[var(--color-text-muted)] hover:underline">
      ← All partners
    </Link>
  );

  if (!detail) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'Partner unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  const { partner, kpis } = detail;

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <Heading level={1}>{partner.displayName}</Heading>
          <Badge color={tierTone(partner.tier)} variant="soft">
            {tierLabel(partner.tier)}
          </Badge>
          <Badge color={partnerStatusTone(partner.status)} variant="soft">
            {partner.status}
          </Badge>
        </Stack>
        <Text variant="muted">
          {partnerKindLabel(partner.kind)} · Referral code{' '}
          <span className="font-mono">{partner.referralCode}</span>
          {partner.websiteUrl ? ` · ${partner.websiteUrl}` : ''} · Joined{' '}
          {formatDate(partner.createdAt)}
        </Text>
        {detail.bio ? <Text size="sm">{detail.bio}</Text> : null}
        <Link
          href={`/sparx/tenants/${tenantId}`}
          className="text-sm font-medium text-[var(--module-active-text)] hover:underline"
        >
          View this partner’s tenant account →
        </Link>
      </Stack>

      {canAct ? (
        <Card>
          <Stack gap={3}>
            <Heading level={3}>Manage</Heading>
            <PartnerControls
              tenantId={tenantId}
              displayName={partner.displayName}
              tier={partner.tier}
              status={partner.status}
            />
          </Stack>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Referrals" value={String(kpis.referralCount)} />
        <Kpi label="Active referrals" value={String(kpis.activeReferrals)} />
        <Kpi label="Lifetime paid" value={formatMoneyCents(kpis.lifetimeCents)} />
        <Kpi label="Pending" value={formatMoneyCents(kpis.pendingCents)} />
      </div>

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Referrals</Heading>
          {detail.referrals.length === 0 ? (
            <Text variant="muted">No referrals yet.</Text>
          ) : (
            <ReferralsTable referrals={detail.referrals} />
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Commissions</Heading>
          {detail.commissions.length === 0 ? (
            <Text variant="muted">No commissions accrued yet.</Text>
          ) : (
            <CommissionsTable commissions={detail.commissions} />
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Payout runs</Heading>
          {detail.payouts.length === 0 ? (
            <Text variant="muted">No payouts run yet.</Text>
          ) : (
            <PayoutsTable payouts={detail.payouts} />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <Stack gap={1}>
        <Text size="sm" variant="muted">
          {label}
        </Text>
        <Text className="text-2xl font-medium tracking-tight">{value}</Text>
      </Stack>
    </Card>
  );
}

function ReferralsTable({ referrals }: { referrals: OperatorPartnerReferral[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Referred account</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Rate</TableHead>
          <TableHead>First payment</TableHead>
          <TableHead>Signed up</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Text size="sm" className="font-medium">
                {r.referredOrgName ?? 'Unknown account'}
              </Text>
            </TableCell>
            <TableCell>
              <Badge color={referralStatusTone(r.status)} variant="soft">
                {r.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm">{Math.round(r.commissionRate * 100)}%</Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(r.firstPaymentAt) ?? '—'}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(r.createdAt)}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CommissionsTable({ commissions }: { commissions: OperatorPartnerCommission[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Amount</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Accrued</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {commissions.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <Text size="sm" className="font-medium">
                {formatMoneyCents(c.amountCents)}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm">{c.kind}</Text>
            </TableCell>
            <TableCell>
              <Badge color={commissionStatusTone(c.status)} variant="soft">
                {c.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(c.paidAt) ?? '—'}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(c.createdAt)}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PayoutsTable({ payouts }: { payouts: OperatorPartnerPayoutRun[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Amount</TableHead>
          <TableHead>Commissions</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payouts.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <Text size="sm" className="font-medium">
                {formatMoneyCents(p.amountCents)}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm">{p.commissionCount}</Text>
            </TableCell>
            <TableCell>
              <Badge color={commissionStatusTone(p.status)} variant="soft">
                {p.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDate(p.paidAt) ?? '—'}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
