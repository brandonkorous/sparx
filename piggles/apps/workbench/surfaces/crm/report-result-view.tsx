'use client';

// The report builder's answer: a single number, a chart, or a table (docs/144 §8).

import { useMemo } from 'react';
import { Card, Text } from '@wizeworks/silicaui-react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';

import { Table } from '../../components/table';
import type { ReportResult, Visualization } from './report-builder-types';
import { formatCell, groupText, type GroupNaming as Naming } from './report-group-words';

function previewOption(
  result: ReportResult,
  visualization: Visualization,
  accent: string | undefined,
  naming: Naming
): EChartsOption | null {
  if (!result.grouped || result.rows.length === 0) return null;
  const [group, ...measures] = result.columns;
  if (!group) return null;
  const labels = result.rows.map((row) => groupText(row[group.key], naming));
  const series = measures.map((column) => ({
    name: column.label,
    type: visualization === 'line' ? ('line' as const) : ('bar' as const),
    data: result.rows.map((row) => Number(row[column.key] ?? 0)),
    itemStyle: { color: accent, borderRadius: visualization === 'bar' ? 4 : 0 },
    smooth: visualization === 'line',
    areaStyle: undefined,
  }));

  if (visualization === 'pie' || visualization === 'funnel') {
    const first = measures[0];
    if (!first) return null;
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: visualization === 'pie' ? 'pie' : 'funnel',
          radius: visualization === 'pie' ? ['45%', '72%'] : undefined,
          data: result.rows.map((row) => ({
            name: groupText(row[group.key], naming),
            value: Number(row[first.key] ?? 0),
          })),
        },
      ],
    };
  }

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLabel: { hideOverlap: true },
    },
    yAxis: { type: 'value', splitNumber: 3, minInterval: 1 },
    series,
  };
}

function ResultTable({ result, naming }: { result: ReportResult; naming: Naming }) {
  return (
    <Card className="p-0">
      <Table size="sm">
        <thead>
          <tr>
            {result.columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr key={index}>
              {result.columns.map((column, at) => (
                <td key={column.key}>
                  {result.grouped && at === 0
                    ? groupText(row[column.key], naming)
                    : formatCell(row[column.key], { kind: column.kind, currency: result.currency })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

/** One row, one measure: a single number is the honest rendering. */
function ResultNumber({ result }: { result: ReportResult }) {
  const column = result.columns[0];
  const row = result.rows[0];
  return (
    <div className="border-base-300 rounded-box flex flex-col gap-1 border p-8 text-center">
      <span className="text-5xl font-semibold">
        {column && row
          ? formatCell(row[column.key], { kind: column.kind, currency: result.currency })
          : '—'}
      </span>
      <Text>{column?.label ?? ''}</Text>
    </div>
  );
}

export function ResultView({
  result,
  visualization,
  accent,
  objectKey,
  groupField,
  empty,
}: {
  result: ReportResult;
  visualization: Visualization;
  accent: string | undefined;
  /** What the breakdown is OF, so each group can be named (issue 247). */
  objectKey: string;
  groupField: string | undefined;
  /** What to say when nothing came back; see `emptyAnswer`. */
  empty: string;
}) {
  const naming = useMemo(
    () => ({ objectKey, field: groupField, groupLabels: result.groupLabels }),
    [objectKey, groupField, result.groupLabels]
  );
  const option = useMemo<EChartsOption | null>(() => {
    // "A table" is drawn as the table below, never as bars (issue 248).
    if (visualization === 'table') return null;
    return previewOption(result, visualization, accent, naming);
  }, [result, visualization, accent, naming]);

  if (result.rows.length === 0) {
    return (
      <div className="border-base-300 rounded-box border p-8 text-center">
        <Text>{empty}</Text>
      </div>
    );
  }
  if (visualization === 'number') return <ResultNumber result={result} />;
  if (option) {
    return (
      <Card className="p-4">
        <Chart option={option} className="h-72 w-full" aria-label="Report preview" />
      </Card>
    );
  }
  return <ResultTable result={result} naming={naming} />;
}
