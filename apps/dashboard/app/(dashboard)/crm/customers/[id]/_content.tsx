import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, Mail, Phone, CreditCard, CheckSquare, CalendarClock } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Tabs,
  TabsList,
  TabsTab,
  TabsPanel,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { resolveSiteScope } from '@/lib/sites';

import { ActivityTimeline } from '../_components/activity-timeline';
import { RecordActivityForm } from '../_components/record-activity-form';
import { CustomerSiteSelect } from './_customer-site-select';

interface Customer {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  doNotContact: boolean;
  mergedIntoCustomerId: string | null;
  preferredContactMethod: string | null;
  tags: string[];
  orderCount: number;
  totalSpent: string | number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  createdAt: string;
  b2bAccountId: string | null;
  propertyId: string | null;
}

interface CustomerActivity {
  id: string;
  type: string;
  description: string | null;
  occurredAt: string;
  actorType: string;
  correctsActivityId: string | null;
}

interface CustomerTask {
  id: string;
  title: string;
  priority: string;
  dueAt: string | null;
}

interface B2bAccountSummary {
  id: string;
  companyName: string;
  pricingTier: string | null;
  creditLimit: string | number;
  creditUsed: string | number;
  paymentTerms: string | null;
  status: string;
}

// Per-customer booking reliability (Scheduling module). Best-effort: the fetch
// returns null when Scheduling is inactive, so the card only shows for tenants
// that book this customer.
interface CustomerBookingStats {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  noShowRatePct: number;
}

// Detail content for a CRM customer. Mounted by both the full-page route
// (crm/customers/[id]/page.tsx) and the dashboard shell's drawer / modal
// panel. Container width + back chrome live in the route wrapper.

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export async function CustomerDetailContent({ id }: Props) {
  let customer: Customer;
  try {
    customer = await api.get<Customer>(`/v1/crm/customers/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [activities, openTasks, b2bAccount, siteScope, bookingStats] = await Promise.all([
    api.get<CustomerActivity[]>(`/v1/crm/activities?customer_id=${id}&limit=100`),
    api.get<CustomerTask[]>(`/v1/crm/tasks?customer_id=${id}&status=open&take=25`),
    customer.b2bAccountId
      ? api
          .get<B2bAccountSummary>(`/v1/crm/b2b-accounts/${customer.b2bAccountId}`)
          .catch(() => null)
      : Promise.resolve(null),
    resolveSiteScope(),
    api.get<CustomerBookingStats>(`/v1/scheduling/customers/${id}/booking-stats`).catch(() => null),
  ]);

  const displayName =
    [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() ||
    (customer.company ?? customer.email ?? 'Unnamed customer');

  const totalSpent = Number(customer.totalSpent);
  const aov = customer.orderCount > 0 ? totalSpent / customer.orderCount : 0;
  const lifetimeDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / 86_400_000)
  );

  return (
    // @container so the two-column body responds to its OWN width — the same
    // content mounts full-page (wide → 3-col) and in the detail drawer (narrow →
    // stacked), so the rail never gets crushed into a horizontal scroll.
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{displayName}</h1>
          <Badge color="module" variant="soft" size="sm">
            {statusLabel(customer.type)}
          </Badge>
          {customer.doNotContact && (
            <Badge color="warning" variant="soft" size="sm">
              Do not contact
            </Badge>
          )}
          {customer.mergedIntoCustomerId && (
            <Badge color="neutral" variant="soft" size="sm">
              Merged into another record
            </Badge>
          )}
        </div>
        {customer.company && (
          <div className="flex flex-row items-center gap-2">
            <Building2 className="text-base-content/50 h-4 w-4" />
            <p className="text-base-content/70">{customer.company}</p>
            {customer.jobTitle && (
              <p className="text-base-content/70 text-sm">· {customer.jobTitle}</p>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap gap-8">
            <StatItem label="Total spent" value={`$${totalSpent.toLocaleString()}`} />
            <StatItem label="Orders" value={customer.orderCount.toString()} />
            <StatItem
              label="Average order"
              value={customer.orderCount > 0 ? `$${aov.toFixed(2)}` : '—'}
            />
            <StatItem
              label="Lifetime"
              value={`${lifetimeDays} day${lifetimeDays === 1 ? '' : 's'}`}
            />
            <StatItem
              label="First order"
              value={
                customer.firstOrderAt ? new Date(customer.firstOrderAt).toLocaleDateString() : '—'
              }
            />
            <StatItem
              label="Last order"
              value={
                customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : '—'
              }
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 @[820px]:grid-cols-3">
        <div className="@[820px]:col-span-2">
          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTab value="activity">
                Activity{' '}
                {activities.length > 0 && (
                  <Badge color="neutral" variant="soft" size="sm">
                    {activities.length}
                  </Badge>
                )}
              </TabsTab>
              <TabsTab value="tasks">
                Tasks {openTasks.length > 0 && <Badge color="warning">{openTasks.length}</Badge>}
              </TabsTab>
              <TabsTab value="deals">Deals</TabsTab>
              <TabsTab value="notes">Notes</TabsTab>
            </TabsList>

            <TabsPanel value="activity">
              <Card>
                <CardBody>
                  <CardTitle>Activity</CardTitle>
                  {activities.length === 0 ? (
                    <p className="text-base-content/70 text-sm">
                      No activity recorded yet. Orders, emails, and notes will appear here as they
                      happen.
                    </p>
                  ) : (
                    <ActivityTimeline activities={activities} />
                  )}
                </CardBody>
              </Card>
            </TabsPanel>

            <TabsPanel value="tasks">
              <Card>
                <CardBody>
                  <div className="flex flex-row items-center justify-between gap-4">
                    <CardTitle>Open tasks</CardTitle>
                    <Button
                      size="sm"
                      color="module"
                      variant="outline"
                      render={<Link href={`/crm/tasks/new?customerId=${customer.id}`} />}
                    >
                      New task
                    </Button>
                  </div>
                  {openTasks.length === 0 ? (
                    <p className="text-base-content/70 text-sm">No open tasks for this customer.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {openTasks.map((task) => (
                        <div
                          key={task.id}
                          className="border-base-300 flex flex-row items-center justify-between gap-4 rounded-md border p-3"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-row items-center gap-2">
                              <CheckSquare className="text-base-content/50 h-3.5 w-3.5" />
                              <p className="text-sm">{task.title}</p>
                              <Badge color={taskPriorityVariant(task.priority)}>
                                {task.priority}
                              </Badge>
                            </div>
                            {task.dueAt && (
                              <p className="text-base-content/70 text-xs">
                                Due {new Date(task.dueAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </TabsPanel>

            <TabsPanel value="deals">
              <Card>
                <CardBody>
                  <p className="text-base-content/70 text-sm">
                    Deal list lands in Phase 3 (sales pipeline). Until then, deals attached to this
                    customer can be opened from the Pipeline view.
                  </p>
                </CardBody>
              </Card>
            </TabsPanel>

            <TabsPanel value="notes">
              <Card>
                <CardBody>
                  <div className="flex flex-col gap-4">
                    <p className="text-base-content/70 text-sm">
                      Notes are recorded as activities of type{' '}
                      <Badge color="neutral" variant="soft" size="sm">
                        note
                      </Badge>
                      . Use the right rail to add one.
                    </p>
                    <ActivityTimeline activities={activities.filter((a) => a.type === 'note')} />
                  </div>
                </CardBody>
              </Card>
            </TabsPanel>
          </Tabs>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="bg-module bg-soft">
            <CardBody>
              <CardTitle>Contact</CardTitle>
              <div className="flex flex-col gap-3">
                {customer.email ? (
                  <div className="flex flex-row items-center gap-2">
                    <Mail className="text-base-content/50 h-4 w-4" />
                    <p className="text-sm">{customer.email}</p>
                  </div>
                ) : (
                  <p className="text-base-content/70 text-sm">No email on file.</p>
                )}
                {customer.phone && (
                  <div className="flex flex-row items-center gap-2">
                    <Phone className="text-base-content/50 h-4 w-4" />
                    <p className="text-sm">{customer.phone}</p>
                  </div>
                )}
                {customer.preferredContactMethod && (
                  <p className="text-base-content/70 text-xs">
                    Preferred: {customer.preferredContactMethod}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {siteScope.multiSite && (
            <Card>
              <CardBody>
                <CardTitle>Site</CardTitle>
                <CustomerSiteSelect
                  customerId={customer.id}
                  value={customer.propertyId}
                  sites={siteScope.sites.map((s) => ({ id: s.id, name: s.name }))}
                />
              </CardBody>
            </Card>
          )}

          {b2bAccount && <B2BAccountCard account={b2bAccount} />}

          {bookingStats && bookingStats.total > 0 && (
            <BookingReliabilityCard stats={bookingStats} />
          )}

          <Card>
            <CardBody>
              <CardTitle>Record activity</CardTitle>
              <RecordActivityForm customerId={customer.id} />
            </CardBody>
          </Card>

          {customer.tags.length > 0 && (
            <Card>
              <CardBody>
                <CardTitle>Tags</CardTitle>
                <div className="flex flex-row flex-wrap gap-2">
                  {customer.tags.map((t) => (
                    <Badge key={t} color="neutral" variant="soft" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content/70 text-xs">{label}</p>
      <h3 className="text-xl font-semibold">{value}</h3>
    </div>
  );
}

// Scheduling reliability — the "problematic client" view from the CRM side. Wears
// the scheduling accent via a nested ModuleProvider (color-follows-functionality)
// and flags repeated no-shows.
function BookingReliabilityCard({ stats }: { stats: CustomerBookingStats }) {
  const unreliable = stats.noShow >= 2 && stats.noShowRatePct >= 25;
  return (
    <ModuleProvider module="scheduling">
      <Card>
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-row items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              <CardTitle>Bookings</CardTitle>
            </div>
            {unreliable && (
              <Badge color="warning" variant="soft" size="sm">
                High no-show rate
              </Badge>
            )}
          </div>
          <div className="flex flex-row flex-wrap gap-6">
            <StatItem label="Total" value={String(stats.total)} />
            <StatItem label="Completed" value={String(stats.completed)} />
            <StatItem label="No-shows" value={String(stats.noShow)} />
            <StatItem label="Cancelled" value={String(stats.cancelled)} />
            <StatItem label="Upcoming" value={String(stats.upcoming)} />
          </div>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}

function B2BAccountCard({
  account,
}: {
  account: {
    id: string;
    companyName: string;
    pricingTier: string | null;
    creditLimit: unknown;
    creditUsed: unknown;
    paymentTerms: string | null;
    status: string;
  };
}) {
  const limit = Number(account.creditLimit ?? 0);
  const used = Number(account.creditUsed ?? 0);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row items-center gap-2">
          <Building2 className="h-4 w-4" />
          <CardTitle>B2B account</CardTitle>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm">{account.companyName}</p>
            <div className="flex flex-row gap-2">
              {account.pricingTier && (
                <Badge color="neutral" variant="soft" size="sm">
                  {account.pricingTier}
                </Badge>
              )}
              <Badge color={statusTone(account.status)} variant="soft" size="sm">
                {statusLabel(account.status)}
              </Badge>
            </div>
          </div>
          {limit > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-row justify-between gap-4">
                <p className="text-base-content/70 text-xs">
                  <CreditCard className="mr-1 inline h-3 w-3" />
                  Credit
                </p>
                <p className="text-xs">
                  ${used.toLocaleString()} / ${limit.toLocaleString()}
                </p>
              </div>
              <div className="bg-base-200 h-1.5 w-full overflow-hidden rounded-full">
                <div className="bg-module h-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {account.paymentTerms && (
            <p className="text-base-content/70 text-xs">Terms: {account.paymentTerms}</p>
          )}
          <Button
            size="sm"
            color="module"
            variant="outline"
            render={<Link href={`/crm/b2b/${account.id}`} />}
          >
            Open account
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function taskPriorityVariant(priority: string): 'neutral' | 'warning' | 'danger' {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  return 'neutral';
}
