'use client';

import * as React from 'react';
import { Download } from 'lucide-react';

import { Button } from 'silicaui-react';

import { exportReportCsv } from '../_lib/report-actions';
import type { ReportKind } from './types';

// Client download button — calls the CSV export server action, then turns the
// returned text into a browser download (the api token stays server-side).
export function ExportCsvButton({
  kind,
  query,
  label,
}: {
  kind: ReportKind;
  query?: Record<string, string>;
  label?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function download() {
    setError(null);
    startTransition(async () => {
      const result = await exportReportCsv(kind, query ?? {});
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${kind}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
      <Button
        variant="outline"
        size="sm"
        onClick={download}
        disabled={pending}
        iconStart={<Download className="size-4" />}
      >
        {pending ? 'Exporting…' : (label ?? 'Export CSV')}
      </Button>
    </span>
  );
}
