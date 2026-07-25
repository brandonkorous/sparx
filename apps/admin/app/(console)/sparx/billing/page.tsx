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
} from '@sparx/ui';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import type {
  OperatorCoupon,
  OperatorPromotionCode,
  OperatorStripeEvent,
  OperatorTenantListItem,
} from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDateTime, formatMoneyCents } from '@/lib/format';
import { TenantsTable } from '../tenants/_components/tenants-table';
import { CouponCreateForm } from './_components/coupon-create-form';
import { CouponDeleteButton } from './_components/coupon-delete-button';
import { PromotionCodeCreateForm } from './_components/promotion-code-create-form';
import { PromotionCodeDeactivateButton } from './_components/promotion-code-deactivate-button';

export default async function BillingPage() {
  const operator = await requireCapability('billing:read');
  const canAct = hasCapability(operator, 'billing:act');

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'billing:read',
      action: 'billing.view',
    });
  } catch {
    // best-effort audit
  }

  const api = operatorApi();
  const [failed, coupons, codes, events] = await Promise.all([
    api.listFailedPayments(operator.id).catch((): OperatorTenantListItem[] => []),
    api.listCoupons(operator.id).catch((): OperatorCoupon[] => []),
    api.listPromotionCodes(operator.id).catch((): OperatorPromotionCode[] => []),
    api.listStripeEvents(operator.id, 25).catch((): OperatorStripeEvent[] => []),
  ]);

  return (
    <Stack gap={6}>
      <PageHeader
        title="Billing operations"
        description="Cross-tenant platform billing — failed payments, coupons, and the Stripe event feed. Refunds and enterprise invoices live on each tenant’s billing tab."
      />

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Failed payments</Heading>
          {failed.length === 0 ? (
            <Text variant="muted">No tenants are past due. 🎉</Text>
          ) : (
            <TenantsTable tenants={failed} />
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={4}>
          <Heading level={3}>Coupons</Heading>
          {coupons.length === 0 ? (
            <Text variant="muted">
              No coupons on the platform account{canAct ? ' yet — create one below.' : '.'}
            </Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Applies</TableHead>
                  <TableHead className="text-right">Redeemed</TableHead>
                  <TableHead>Status</TableHead>
                  {canAct ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Text size="sm" className="font-medium">
                        {c.name ?? c.id}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{couponDiscount(c)}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {couponDuration(c)}
                      </Text>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Text size="sm">{c.timesRedeemed}</Text>
                    </TableCell>
                    <TableCell>
                      <Badge color={c.valid ? 'success' : 'neutral'} variant="soft">
                        {c.valid ? 'Valid' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {canAct ? (
                      <TableCell className="text-right">
                        <CouponDeleteButton couponId={c.id} label={c.name ?? c.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {canAct ? (
            <Card variant="subtle">
              <Stack gap={3}>
                <Heading level={4}>New coupon</Heading>
                <CouponCreateForm />
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Card>

      <Card>
        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={3}>Promotion codes</Heading>
            <Text size="sm" variant="muted">
              The strings a tenant types on the Stripe payment page when they set up billing. Each
              one redeems a coupon above.
            </Text>
          </Stack>
          {codes.length === 0 ? (
            <Text variant="muted">
              No promotion codes yet
              {canAct ? ' — create one below to hand out to a tenant.' : '.'}
            </Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Redeemed</TableHead>
                  <TableHead>Status</TableHead>
                  {canAct ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Text size="sm" className="font-mono font-medium">
                        {p.code}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {p.couponName ?? p.couponId}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge color={p.customerId ? 'info' : 'neutral'} variant="soft">
                        {p.customerId ? 'One tenant' : 'Public'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {p.expiresAt ? formatDateTime(p.expiresAt) : '—'}
                      </Text>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Text size="sm">
                        {p.timesRedeemed}
                        {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ''}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge color={p.active ? 'success' : 'neutral'} variant="soft">
                        {p.active ? 'Active' : 'Off'}
                      </Badge>
                    </TableCell>
                    {canAct ? (
                      <TableCell className="text-right">
                        {p.active ? (
                          <PromotionCodeDeactivateButton id={p.id} code={p.code} />
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {canAct ? (
            <Card variant="subtle">
              <Stack gap={3}>
                <Heading level={4}>New promotion code</Heading>
                <PromotionCodeCreateForm
                  coupons={coupons.map((c) => ({ id: c.id, name: c.name }))}
                />
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Card>

      <Card>
        <Stack gap={3}>
          <Heading level={3}>Recent Stripe events</Heading>
          {events.length === 0 ? (
            <Text variant="muted">
              No recent platform events — Stripe isn’t configured yet, or nothing has happened in
              the last 30 days.
            </Text>
          ) : (
            <Stack gap={2}>
              {events.map((e) => (
                <Stack
                  key={e.id}
                  direction="row"
                  align="center"
                  justify="between"
                  className="border-base-300 border-b pb-2 last:border-0"
                >
                  <Text size="sm" className="font-mono">
                    {e.type}
                  </Text>
                  <Text size="xs" variant="muted">
                    {formatDateTime(e.createdAt)}
                  </Text>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function couponDiscount(c: OperatorCoupon): string {
  if (c.percentOff !== null) return `${c.percentOff}% off`;
  if (c.amountOffCents !== null) return `${formatMoneyCents(c.amountOffCents)} off`;
  return '—';
}

function couponDuration(c: OperatorCoupon): string {
  if (c.duration === 'repeating') return `${c.durationInMonths ?? 0} months`;
  if (c.duration === 'forever') return 'Forever';
  return 'Once';
}
