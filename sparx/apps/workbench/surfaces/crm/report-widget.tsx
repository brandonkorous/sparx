'use client';

// One report on a dashboard (docs/144 §8).
//
// Runs its own query and owns its own loading, empty and error states — so one
// slow or broken report is one quiet card, never a blank board. That isolation is
// the reason a dashboard can hold a dozen widgets without becoming an
// all-or-nothing page.

import { useMemo } from 'react';
import { Alert, Badge, Button, Card, Select, Text } from '@wizeworks/silicaui-react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import { Maximize2, Pencil, X } from 'lucide-react';

import { useModuleColor } from '../analytics/charts';
import { useRunReport, type DashboardWidget } from './report-builder-data';

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  if (typeof value === 'bigint') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // A grouped custom property comes back as whatever was in the JSONB bag, which
  // is not always a scalar. `String({})` is "[object Object]" — a cell that looks
  // like data and is not, so it is rendered as absent instead.
  if (typeof value !== 'string') return '—';
  const text = value;
  const asDate = /^\d{4}-\d{2}-\d{2}T/.exec(text) ? new Date(text) : null;
  return asDate ? asDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : text;
}

const WIDTHS = { '4': 'A third', '6': 'Half', '8': 'Two thirds', '12': 'Full width' };

export function ReportWidget({
  widget,
  onOpen,
  onRename,
  onRemove,
  onResize,
}: {
  widget: DashboardWidget;
  onOpen: () => void;
  onRename: () => void;
  onRemove: () => void;
  onResize: (w: number) => void;
}) {
  const { data, isPending, isError, error } = useRunReport(widget.reportId);
  const { ref: accentRef, color: accent } = useModuleColor();
  const report = widget.report;

  const option = useMemo<EChartsOption | null>(() => {
    if (!data || !data.grouped || data.rows.length === 0) return null;
    const [group, ...measures] = data.columns;
    const first = measures[0];
    if (!group || !first) return null;

    if (report.visualization === 'pie' || report.visualization === 'funnel') {
      return {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: report.visualization === 'pie' ? 'pie' : 'funnel',
            radius: report.visualization === 'pie' ? ['45%', '72%'] : undefined,
            data: data.rows.map((row) => ({
              name: formatCell(row[group.key]),
              value: Number(row[first.key] ?? 0),
            })),
          },
        ],
      };
    }
    if (report.visualization !== 'bar' && report.visualization !== 'line') return null;

    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 8, top: 20, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.rows.map((row) => formatCell(row[group.key])),
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', splitNumber: 3, minInterval: 1 },
      series: measures.map((column) => ({
        name: column.label,
        type: report.visualization === 'line' ? ('line' as const) : ('bar' as const),
        data: data.rows.map((row) => Number(row[column.key] ?? 0)),
        itemStyle: { color: accent, borderRadius: report.visualization === 'bar' ? 4 : 0 },
        smooth: report.visualization === 'line',
      })),
    };
  }, [data, report.visualization, accent]);

  return (
    <Card className="flex h-full flex-col gap-3 p-4" ref={accentRef}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <strong>{widget.title ?? report.name}</strong>
          {report.description ? <Text>{report.description}</Text> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Select
            color="neutral"
            size="sm"
            aria-label="How wide"
            value={String(widget.w)}
            items={WIDTHS}
            onValueChange={(next) => onResize(Number(next))}
          />
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="What this card is called"
            onClick={onRename}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Open this report"
            onClick={onOpen}
          >
            <Maximize2 className="size-4" aria-hidden />
          </Button>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Take this off the board"
            onClick={onRemove}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="skeleton h-40 w-full" />
      ) : isError ? (
        <Alert color="warning">
          {error instanceof Error ? error.message : 'This report could not be worked out.'}
        </Alert>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Text>Nothing matches yet.</Text>
        </div>
      ) : report.visualization === 'number' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <span className="text-4xl font-semibold">
            {formatCell(data.rows[0]?.[data.columns[0]?.key ?? ''])}
          </span>
          <Text>{data.columns[0]?.label ?? ''}</Text>
        </div>
      ) : option ? (
        <Chart option={option} className="h-48 w-full" aria-label={report.name} />
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column.key} className="pb-1">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {data.columns.map((column) => (
                    <td key={column.key} className="py-0.5">
                      {formatCell(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 8 ? (
            <Badge color="neutral" variant="soft">
              +{data.rows.length - 8} more — open the report
            </Badge>
          ) : null}
        </div>
      )}
    </Card>
  );
}
