import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  Badge,
  Card,
  Heading,
  statusLabel,
  statusTone,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import { OperatorApiError, type OperatorTenantBillingView } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate, formatMoneyCents } from '@/lib/format';
import { SubscriptionCard } from '../../_components/tenant-detail-sections';
import { RefundButton } from './_components/refund-button';
import { InvoiceForm } from './_components/invoice-form';

export default async function TenantBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await requireCapability('billing:read');
  const canAct = hasCapability(operator, 'billing:act');
  const { id } = await params;

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'billing:read',
      action: 'tenant.billing.view',
      targetTenantId: id,
    });
  } catch {
    // best-effort audit
  }

  let view: OperatorTenantBillingView | null = null;
  let error: string | null = null;
  try {
    view = await operatorApi().getTenantBilling(id, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  const backLink = (
    <Link href={`/sparx/tenants/${id}`} className="text-base-content/60 text-sm hover:underline">
      ← Back to tenant
    </Link>
  );

  if (!view) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'Billing unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Heading level={1}>{view.name} · Billing</Heading>
        {!view.hasStripeCustomer ? (
          <Text variant="muted">
            No platform Stripe customer yet — this tenant has no billing relationship, so there are
            no charges to refund and invoices can’t be issued.
          </Text>
        ) : null}
      </Stack>

      <div className="grid gap-4 lg:grid-cols-2">
        <SubscriptionCard billing={view.billing} />
        <Card>
          <Stack gap={3}>
            <Heading level={3}>Charges</Heading>
            {view.charges.length === 0 ? (
              <Text variant="muted">No charges on record.</Text>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    {canAct ? <TableHead className="text-right">Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.charges.map((charge) => {
                    const refundable = canAct && charge.status === 'succeeded' && !charge.refunded;
                    return (
                      <TableRow key={charge.id}>
                        <TableCell>
                          <Text size="sm">{formatDate(charge.created)}</Text>
                          {charge.description ? (
                            <Text size="xs" variant="muted">
                              {charge.description}
                            </Text>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Text size="sm">{formatMoneyCents(charge.amountCents)}</Text>
                          {charge.amountRefundedCents > 0 ? (
                            <Text size="xs" variant="muted">
                              {formatMoneyCents(charge.amountRefundedCents)} refunded
                            </Text>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            color={charge.refunded ? 'neutral' : statusTone(charge.status)}
                            variant="soft"
                          >
                            {charge.refunded ? 'Refunded' : statusLabel(charge.status)}
                          </Badge>
                        </TableCell>
                        {canAct ? (
                          <TableCell className="text-right">
                            {refundable ? (
                              <RefundButton
                                tenantId={id}
                                chargeId={charge.id}
                                amountLabel={formatMoneyCents(charge.amountCents)}
                              />
                            ) : (
                              <Text size="xs" variant="muted">
                                —
                              </Text>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Stack>
        </Card>
      </div>

      {canAct && view.hasStripeCustomer ? (
        <Card>
          <Stack gap={4}>
            <Stack gap={1}>
              <Heading level={3}>Enterprise invoice</Heading>
              <Text size="sm" variant="muted">
                Author a one-off invoice against this tenant’s platform Stripe customer — for custom
                pricing, professional services, or manual charges.
              </Text>
            </Stack>
            <InvoiceForm tenantId={id} />
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
