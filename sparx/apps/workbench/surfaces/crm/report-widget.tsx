'use client';

// One report on a dashboard (docs/144 §8).
//
// Runs its own query and owns its own loading, empty and error states — so one
// slow or broken report is one quiet card, never a blank board. That isolation is
// the reason a dashboard can hold a dozen widgets without becoming an
// all-or-nothing page.
//
// A shared board can hold a card for a report its maker kept to herself (persona
// issue 264). Everybody else gets that card without its name or numbers, says
// why, and can still move or remove it; it never runs the report.

import { useMemo } from 'react';
import { Alert, Badge, Button, Card, Select, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import { Lock, Maximize2, Pencil, X } from 'lucide-react';

import { useModuleColor } from '../analytics/charts';
import {
  PRIVATE_CARD_WORDS,
  useRunReport,
  type DashboardWidget,
  type SavedReport,
} from './report-builder-data';
import { readFailureMessage } from '../../lib/api/write-failure';
import { formatCell, groupText } from './report-group-words';

const WIDTHS = { '4': 'A third', '6': 'Half', '8': 'Two thirds', '12': 'Full width' };

interface WidgetActions {
  widget: DashboardWidget;
  onOpen: () => void;
  onRename: () => void;
  onRemove: () => void;
  onResize: (w: number) => void;
}

/** How wide, what it is called, open it, take it off. Renaming and opening are
 *  left off a card whose report this person cannot see. */
function WidgetControls({
  widget,
  onOpen,
  onRename,
  onRemove,
  onResize,
}: Pick<WidgetActions, 'widget' | 'onRemove' | 'onResize'> &
  Partial<Pick<WidgetActions, 'onOpen' | 'onRename'>>) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Select
        color="neutral"
        size="sm"
        aria-label="How wide"
        value={String(widget.w)}
        items={WIDTHS}
        onValueChange={(next) => onResize(Number(next))}
      />
      {onRename ? (
        <Button
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="What this card is called"
          onClick={onRename}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      ) : null}
      {onOpen ? (
        <Button
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Open this report"
          onClick={onOpen}
        >
          <Maximize2 className="size-4" aria-hidden />
        </Button>
      ) : null}
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
  );
}

/** A card for a report its maker kept to herself, as everybody else sees it. */
function PrivateReportCard({ widget, onRemove, onResize }: WidgetActions) {
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-48 flex-1 items-start gap-2">
          <Lock className="mt-1 size-4 shrink-0" aria-hidden />
          <Text>{PRIVATE_CARD_WORDS}</Text>
        </div>
        <WidgetControls widget={widget} onRemove={onRemove} onResize={onResize} />
      </div>
    </Card>
  );
}

export function ReportWidget(props: WidgetActions) {
  const report = props.widget.report;
  if (props.widget.privateReport || !report) return <PrivateReportCard {...props} />;
  return <LiveReportWidget {...props} report={report} />;
}

function LiveReportWidget({
  widget,
  report,
  onOpen,
  onRename,
  onRemove,
  onResize,
}: WidgetActions & { report: SavedReport }) {
  const { data, isPending, isError, error } = useRunReport(widget.reportId);
  const { ref: accentRef, color: accent } = useModuleColor();
  // Each group named the same way the builder names it (persona issue 247).
  const naming = useMemo(
    () => ({
      objectKey: report.objectKey,
      field: report.groupBy?.field,
      groupLabels: data?.groupLabels,
    }),
    [report.objectKey, report.groupBy?.field, data?.groupLabels]
  );

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
              name: groupText(row[group.key], naming),
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
        data: data.rows.map((row) => groupText(row[group.key], naming)),
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
  }, [data, report.visualization, accent, naming]);

  return (
    <Card className="flex h-full flex-col gap-3 p-4" ref={accentRef}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-48 flex-1 flex-col gap-0.5">
          <strong>{widget.title ?? report.name}</strong>
          {report.description ? <Text>{report.description}</Text> : null}
        </div>
        <WidgetControls
          widget={widget}
          onOpen={onOpen}
          onRename={onRename}
          onRemove={onRemove}
          onResize={onResize}
        />
      </div>

      {isPending ? (
        <div className="skeleton h-40 w-full" />
      ) : isError ? (
        <Alert color="warning">
          {readFailureMessage(error, 'This report could not be worked out.')}
        </Alert>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Text>Nothing matches yet.</Text>
        </div>
      ) : report.visualization === 'number' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <span className="text-4xl font-semibold">
            {formatCell(data.rows[0]?.[data.columns[0]?.key ?? ''], {
              kind: data.columns[0]?.kind,
              currency: data.currency,
            })}
          </span>
          <Text>{data.columns[0]?.label ?? ''}</Text>
        </div>
      ) : option ? (
        <Chart option={option} className="h-48 w-full" aria-label={report.name} />
      ) : (
        <div className="overflow-auto">
          <Table size="sm">
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {data.columns.map((column, at) => (
                    <td data-label={column.label} key={column.key}>
                      {data.grouped && at === 0
                        ? groupText(row[column.key], naming)
                        : formatCell(row[column.key], {
                            kind: column.kind,
                            currency: data.currency,
                          })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
          {data.rows.length > 8 ? (
            <Badge color="neutral" variant="soft">
              +{data.rows.length - 8} more. Open the report
            </Badge>
          ) : null}
        </div>
      )}
    </Card>
  );
}
