import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Receipt, Calendar, User, Briefcase } from 'lucide-react';

import { Badge, Card, CardBody, CardTitle, EmptyState, Table } from '@wizeworks/silicaui-react';
import { statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { stageColor } from '../../pipelines/[id]/_components/kanban-types';
import { AttachOrderPopover, DetachOrderButton } from './_components/attach-order-popover';
import { AttachQuotePopover, DetachQuoteButton } from './_components/attach-quote-popover';
import { StagePicker } from './_components/stage-picker';

interface Deal {
  id: string;
  title: string;
  pipelineId: string;
  stageId: string;
  value: string | number;
  currency: string;
  customerId: string | null;
  closedAt: string | null;
  expectedCloseDate: string | null;
}

interface PipelineStage {
  id: string;
  name: string;
  stageType: 'open' | 'won' | 'lost';
  probability: string | number;
  color: string | null;
}

interface PipelineDetail {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  total: string | number;
  placedAt: string | null;
}

interface QuoteSummary {
  id: string;
  quoteNumber: string;
  status: string;
  currency: string;
  total: string | number;
  validUntil: string | null;
}

interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

interface ActivityRow {
  id: string;
  type: string;
  description: string | null;
  occurredAt: string;
}

// Detail content for a CRM deal. Mounted by the full-page route and by the
// dashboard shell's drawer / modal. The full-page chrome (back-to-pipeline
// link, Container width) lives in page.tsx.

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function DealDetailContent({ id }: Props) {
  let deal: Deal;
  try {
    deal = await api.get<Deal>(`/v1/crm/deals/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const customerFilter = deal.customerId ? `&customer_id=${deal.customerId}` : '';
  const [
    pipeline,
    attachedOrders,
    attachedQuotes,
    activities,
    customer,
    candidateOrdersResp,
    candidateQuotesResp,
  ] = await Promise.all([
    api.get<PipelineDetail>(`/v1/crm/pipelines/${deal.pipelineId}`),
    api.get<OrderSummary[]>(`/v1/crm/deals/${deal.id}/orders`),
    api.get<QuoteSummary[]>(`/v1/crm/deals/${deal.id}/quotes`),
    api.get<ActivityRow[]>(`/v1/crm/activities?deal_id=${deal.id}&limit=20`),
    deal.customerId
      ? api.get<CustomerSummary>(`/v1/crm/customers/${deal.customerId}`).catch(() => null)
      : Promise.resolve(null),
    api.getPaged<OrderSummary[]>(`/v1/crm/orders?take=100&sort_by=placedAt${customerFilter}`),
    api.getPaged<QuoteSummary[]>(`/v1/crm/quotes?take=100&sort_by=createdAt${customerFilter}`),
  ]);
  const candidateOrders = candidateOrdersResp.data;
  const candidateQuotes = candidateQuotesResp.data;
  const stage = pipeline.stages.find((s) => s.id === deal.stageId);

  return (
    // @container so the body responds to its OWN width — full-page (wide) vs. the
    // detail drawer (narrow), where viewport breakpoints would crush the columns.
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{deal.title}</h1>
          {stage && (
            <Badge
              variant="outline"
              style={{ borderColor: stageColor(stage), color: stageColor(stage) }}
            >
              {stage.name} · {Number(stage.probability)}%
            </Badge>
          )}
          {!deal.closedAt && (
            <StagePicker
              dealId={deal.id}
              currentStageId={deal.stageId}
              stages={pipeline.stages.map((s) => ({
                id: s.id,
                name: s.name,
                probability: Number(s.probability),
              }))}
            />
          )}
          {deal.closedAt && (
            <Badge color={stage?.stageType === 'won' ? 'success' : 'warning'}>
              Closed {new Date(deal.closedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>
        <div className="flex flex-row flex-wrap gap-4">
          <div className="flex flex-row items-center gap-1">
            <Briefcase className="text-base-content/50 h-3.5 w-3.5" />
            <p className="text-base-content/70 text-sm">
              {deal.currency} {Number(deal.value).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-row items-center gap-1">
            <Calendar className="text-base-content/50 h-3.5 w-3.5" />
            <p className="text-base-content/70 text-sm">
              {deal.expectedCloseDate
                ? `Expected ${new Date(deal.expectedCloseDate).toLocaleDateString()}`
                : 'No expected close'}
            </p>
          </div>
          {customer && (
            <div className="flex flex-row items-center gap-1">
              <User className="text-base-content/50 h-3.5 w-3.5" />
              <Link
                href={`/crm/customers/${customer.id}`}
                className="hover:text-module text-sm hover:underline"
              >
                {[customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                  (customer.company ?? customer.email)}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 @[820px]:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardBody>
              <div className="flex flex-row items-center justify-between gap-4">
                <CardTitle>
                  <div className="flex flex-row items-center gap-2">
                    <Receipt className="h-4 w-4" /> Attached orders
                    <Badge color="neutral" variant="soft" size="sm">
                      {attachedOrders.length}
                    </Badge>
                  </div>
                </CardTitle>
                <AttachOrderPopover
                  dealId={deal.id}
                  attachedIds={attachedOrders.map((o) => o.id)}
                  candidates={candidateOrders.map((o) => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    total: o.total.toString(),
                    currency: o.currency,
                  }))}
                />
              </div>
              {attachedOrders.length === 0 ? (
                <EmptyState
                  title="No attached orders"
                  description="Orders attached to this deal show up here. Use the Attach order button above."
                />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                      <th>Placed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachedOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link
                            href={`/crm/orders/${o.id}`}
                            className="hover:text-module text-sm font-medium hover:underline"
                          >
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <Badge color={statusTone(o.status)} variant="soft" size="sm">
                            {statusLabel(o.status)}
                          </Badge>
                        </td>
                        <td className="text-right tabular-nums">
                          {o.currency} {Number(o.total).toLocaleString()}
                        </td>
                        <td>
                          <p className="text-base-content/70 text-sm">
                            {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}
                          </p>
                        </td>
                        <td className="text-right">
                          <DetachOrderButton dealId={deal.id} orderId={o.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex flex-row items-center justify-between gap-4">
                <CardTitle>
                  <div className="flex flex-row items-center gap-2">
                    <FileText className="h-4 w-4" /> Attached quotes
                    <Badge color="neutral" variant="soft" size="sm">
                      {attachedQuotes.length}
                    </Badge>
                  </div>
                </CardTitle>
                <AttachQuotePopover
                  dealId={deal.id}
                  attachedIds={attachedQuotes.map((q) => q.id)}
                  candidates={candidateQuotes.map((q) => ({
                    id: q.id,
                    quoteNumber: q.quoteNumber,
                    status: q.status,
                    total: q.total.toString(),
                    currency: q.currency,
                  }))}
                />
              </div>
              {attachedQuotes.length === 0 ? (
                <EmptyState
                  title="No attached quotes"
                  description="Quotes attached to this deal show up here. Use the Attach quote button above."
                />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                      <th>Valid until</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachedQuotes.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <Link
                            href={`/crm/quotes/${q.id}`}
                            className="hover:text-module text-sm font-medium hover:underline"
                          >
                            {q.quoteNumber}
                          </Link>
                        </td>
                        <td>
                          <Badge color={statusTone(q.status)} variant="soft" size="sm">
                            {statusLabel(q.status)}
                          </Badge>
                        </td>
                        <td className="text-right tabular-nums">
                          {q.currency} {Number(q.total).toLocaleString()}
                        </td>
                        <td>
                          <p className="text-base-content/70 text-sm">
                            {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}
                          </p>
                        </td>
                        <td className="text-right">
                          <DetachQuoteButton dealId={deal.id} quoteId={q.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <CardTitle>Activity</CardTitle>
            {activities.length === 0 ? (
              <p className="text-base-content/70 text-sm">No activity yet on this deal.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex flex-col gap-1">
                    <div className="flex flex-row items-center justify-between gap-4">
                      <Badge color="neutral" variant="soft" size="sm">
                        {statusLabel(a.type)}
                      </Badge>
                      <p className="text-base-content/70 text-xs">
                        {new Date(a.occurredAt).toLocaleDateString()}
                      </p>
                    </div>
                    {a.description && <p className="text-sm">{a.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
