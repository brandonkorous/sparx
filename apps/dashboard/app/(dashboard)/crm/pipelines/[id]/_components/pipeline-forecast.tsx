// Pipeline forecast view — weighted pipeline value by expected-close
// month, computed by dealService.forecast (which the MCP get_forecast tool
// also wraps, so REST/UI/AI all see identical numbers).

import { Badge, Card, CardBody, CardTitle, Table } from '@wizeworks/silicaui-react';
import { Stat } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

interface ForecastBucket {
  month: string;
  dealCount: number;
  openValue: number;
  closedWonValue: number;
  weightedValue: number;
}

interface ForecastResponse {
  totalWeighted: number;
  startMonth: string;
  endMonth: string;
  buckets: ForecastBucket[];
}

interface PipelineForecastProps {
  pipelineId: string;
}

export async function PipelineForecast({ pipelineId }: PipelineForecastProps) {
  const result = await api.get<ForecastResponse>(
    `/v1/crm/deals/forecast?pipeline_id=${pipelineId}`
  );
  const maxBucket = result.buckets.reduce((m, b) => Math.max(m, b.weightedValue), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row flex-wrap gap-4">
        <Card className="bg-module bg-soft min-w-[200px]">
          <CardBody className="py-4">
            <Stat label="Total weighted" value={`$${result.totalWeighted.toLocaleString()}`} />
          </CardBody>
        </Card>
        <Card className="min-w-[200px]">
          <CardBody className="py-4">
            <Stat label="Window" value={`${result.startMonth} → ${result.endMonth}`} />
          </CardBody>
        </Card>
        <Card className="min-w-[200px]">
          <CardBody className="py-4">
            <Stat
              label="Closed-won (window)"
              value={`$${result.buckets
                .reduce((s, b) => s + b.closedWonValue, 0)
                .toLocaleString()}`}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0">
          <CardTitle>Forecast by month</CardTitle>
          <div className="flex flex-col gap-3">
            {result.buckets.map((b) => (
              <div key={b.month} className="flex flex-col gap-1">
                <div className="flex flex-row items-center justify-between">
                  <div className="flex flex-row items-center gap-2">
                    <p className="text-sm font-medium">{b.month}</p>
                    <Badge color="neutral" variant="soft" size="sm">
                      {b.dealCount} deal{b.dealCount === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <p className="text-sm tabular-nums">${b.weightedValue.toLocaleString()}</p>
                </div>
                <div className="bg-base-200 h-2 rounded-full">
                  <div
                    className="bg-module h-full rounded-full"
                    style={{
                      width: `${maxBucket > 0 ? (b.weightedValue / maxBucket) * 100 : 0}%`,
                    }}
                  />
                </div>
                {b.closedWonValue > 0 && (
                  <p className="text-base-content/70 text-xs">
                    Closed-won: ${b.closedWonValue.toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <CardTitle>Breakdown</CardTitle>
          <Table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">Deals</th>
                <th className="text-right">Open (weighted)</th>
                <th className="text-right">Closed-won</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.buckets.map((b) => (
                <tr key={b.month}>
                  <td>{b.month}</td>
                  <td className="text-right tabular-nums">{b.dealCount}</td>
                  <td className="text-right tabular-nums">${b.openValue.toLocaleString()}</td>
                  <td className="text-right tabular-nums">${b.closedWonValue.toLocaleString()}</td>
                  <td className="text-right tabular-nums">${b.weightedValue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
