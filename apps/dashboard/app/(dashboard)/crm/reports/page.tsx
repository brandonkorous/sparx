import Link from 'next/link';
import { BarChart3, TrendingUp, Users, AlertCircle } from 'lucide-react';

import { PageHeader, Stat } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle, Table } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';

import { stageColor } from '../pipelines/[id]/_components/kanban-types';

interface TenantSnapshot {
  customers: number;
  b2bAccounts: number;
  openDeals: number;
  pipelineValue: number;
  openTasks: number;
  overdueTasks: number;
}

interface PipelineLite {
  id: string;
  name: string;
  isDefault: boolean;
}

interface FunnelBucket {
  stageId: string;
  stageName: string;
  stageType: 'open' | 'won' | 'lost';
  count: number;
  totalValue: number;
}

interface WinLossRow {
  repId: string | null;
  won: number;
  lost: number;
  open: number;
  winRate: number;
  totalWonValue: number;
}

interface AcquisitionPoint {
  month: string;
  newCustomers: number;
}

interface TenantUser {
  id: string;
  name: string | null;
  email: string | null;
}

// CRM reports landing — tenant snapshot + funnel for the default pipeline
// + recent acquisition. Each report is a server-rendered card calling
// reportingService directly (no rollup yet — Phase 6 follow-up).

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [snapshot, pipelines, winLoss, acquisition, users] = await Promise.all([
    api.get<TenantSnapshot>('/v1/crm/reports/snapshot'),
    // List paginates (default 50); reports need every pipeline — max page.
    api.get<PipelineLite[]>('/v1/crm/pipelines?take=250'),
    api.get<WinLossRow[]>('/v1/crm/reports/win-loss'),
    api.get<AcquisitionPoint[]>('/v1/crm/reports/acquisition?months=12'),
    // Resolve assigned-rep ids → names so the win/loss table reads as people.
    api.get<TenantUser[]>('/v1/users?take=200'),
  ]);

  const repNameById = new Map(users.map((u) => [u.id, u.name ?? u.email ?? null]));

  const defaultPipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const funnel = defaultPipeline
    ? await api.get<FunnelBucket[]>(
        `/v1/crm/reports/pipeline-funnel?pipeline_id=${defaultPipeline.id}`
      )
    : [];

  const maxAcquisition = acquisition.reduce((m, p) => Math.max(m, p.newCustomers), 0);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports"
          description="Live tenant metrics. Numbers are derived from the source tables — a nightly rollup (Phase 6 follow-up) will back this page once daily aggregates are big enough to matter."
        />

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-module bg-soft">
            <CardBody className="py-4">
              <Stat label="Customers" value={snapshot.customers.toLocaleString()} />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-4">
              <Stat label="B2B accounts" value={snapshot.b2bAccounts.toLocaleString()} />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-4">
              <Stat
                label="Open deals"
                value={snapshot.openDeals.toLocaleString()}
                hint={`$${snapshot.pipelineValue.toLocaleString()} pipeline`}
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-4">
              <Stat
                label="Open tasks"
                value={snapshot.openTasks.toLocaleString()}
                hint={snapshot.overdueTasks > 0 ? `${snapshot.overdueTasks} overdue` : 'on track'}
              />
            </CardBody>
          </Card>
        </div>

        {defaultPipeline && funnel.length > 0 && (
          <Card>
            <CardBody>
              <CardTitle>
                <div className="flex flex-row items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Pipeline funnel — {defaultPipeline.name}
                </div>
              </CardTitle>
              <div className="flex flex-col gap-3">
                {funnel.map((b) => {
                  const max = Math.max(...funnel.map((x) => x.count), 1);
                  return (
                    <div key={b.stageId} className="flex flex-col gap-1">
                      <div className="flex flex-row justify-between">
                        <div className="flex flex-row items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: stageColor({
                                color: null,
                                stageType: b.stageType,
                              }),
                            }}
                          />
                          <p className="text-sm font-medium">{b.stageName}</p>
                          <Badge color="neutral" variant="soft" size="sm">
                            {b.count}
                          </Badge>
                        </div>
                        <p className="text-base-content/70 text-sm tabular-nums">
                          ${b.totalValue.toLocaleString()}
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--color-surface-subtle)]">
                        <div
                          className="h-full rounded-full bg-[var(--module-active)]"
                          style={{ width: `${(b.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <CardTitle>
              <div className="flex flex-row items-center gap-2">
                <Users className="h-4 w-4" /> Win/loss by rep
              </div>
            </CardTitle>
            {winLoss.length === 0 ? (
              <p className="text-base-content/70 text-sm">No assigned-rep data yet.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th className="text-right">Won</th>
                    <th className="text-right">Lost</th>
                    <th className="text-right">Open</th>
                    <th className="text-right">Win rate</th>
                    <th className="text-right">Won value</th>
                  </tr>
                </thead>
                <tbody>
                  {winLoss.map((r, idx) => (
                    <tr key={r.repId ?? `unassigned-${idx}`}>
                      <td>
                        {!r.repId ? (
                          <p className="text-base-content/70 text-sm">Unassigned</p>
                        ) : repNameById.get(r.repId) ? (
                          <p className="text-sm">{repNameById.get(r.repId)}</p>
                        ) : (
                          <code className="text-xs">{r.repId.slice(0, 8)}</code>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{r.won}</td>
                      <td className="text-right tabular-nums">{r.lost}</td>
                      <td className="text-right tabular-nums">{r.open}</td>
                      <td className="text-right tabular-nums">{(r.winRate * 100).toFixed(0)}%</td>
                      <td className="text-right tabular-nums">
                        ${r.totalWonValue.toLocaleString()}
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
            <CardTitle>Customer acquisition (last 12 months)</CardTitle>
            <div className="flex flex-col gap-2">
              {acquisition.map((p) => (
                <div key={p.month} className="flex flex-col gap-1">
                  <div className="flex flex-row justify-between">
                    <p className="text-sm">{p.month}</p>
                    <p className="text-sm tabular-nums">{p.newCustomers}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-surface-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--module-active)]"
                      style={{
                        width: `${
                          maxAcquisition > 0 ? (p.newCustomers / maxAcquisition) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {snapshot.overdueTasks > 0 && (
          <Card>
            <CardBody>
              <div className="flex flex-row items-center gap-3">
                <AlertCircle className="h-5 w-5 text-[var(--color-warning-500)]" />
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-base font-medium">
                    {snapshot.overdueTasks} overdue tasks across the team
                  </p>
                  <p className="text-base-content/70 text-sm">
                    <Link href="/crm/tasks?scope=all" className="hover:underline">
                      Review and reassign →
                    </Link>
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
