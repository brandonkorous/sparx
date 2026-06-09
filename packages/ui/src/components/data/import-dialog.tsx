'use client';

import * as React from 'react';
import { Upload, CheckCircle2, XCircle, AlertTriangle, FileText, Download } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter } from '../overlay/modal';
import { Button } from '../primitives/button';
import { Text } from '../primitives/text';
import { Badge } from '../primitives/badge';
import { Stack } from '../layout/stack';
import { Switch } from '../primitives/switch';
import { Label } from '../primitives/label';
import { Progress } from './progress';
import { cn } from '../../utils/cn';

// ImportDialog — three-phase modal for bulk CSV import (docs/68 §8).
//
// Phase 1 (upload): drag-drop or file picker → client-side parse → header
//   validation + row count shown.
// Phase 2 (preview): first 5 rows table + upsert toggle.
// Phase 3 (result): polls job status, shows per-row counts, error download.
//
// The consumer provides:
//   - entityType: display label for the entity (e.g. "products")
//   - requiredColumns: columns that MUST be present in the CSV
//   - templateCsvUrl: optional link to a template CSV the user can download
//   - onSubmit(rows, options): posts rows to API, returns { jobId }
//   - onPollStatus(jobId): returns { status, importedCount, updatedCount, errorCount, rows }

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportJobRow {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  naturalKey?: string | null;
  errorMsg?: string | null;
}

export interface ImportJobResult {
  status: ImportJobStatus;
  importedCount: number;
  updatedCount: number;
  errorCount: number;
  rowCount: number;
  rows: ImportJobRow[];
}

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityLabel: string;
  requiredColumns: string[];
  templateCsvContent?: string;
  templateFileName?: string;
  /** When provided, .xlsx files are accepted and parsed server-side via this callback. */
  onParseXlsx?: (file: File) => Promise<{ headers: string[]; rows: Record<string, string>[] }>;
  onSubmit: (
    rows: Record<string, string>[],
    options: { upsert: boolean; fileName: string }
  ) => Promise<{ jobId: string }>;
  onPollStatus: (jobId: string) => Promise<ImportJobResult>;
}

type Phase = 'upload' | 'preview' | 'progress' | 'result';

// ─── Minimal CSV parser ───────────────────────────────────────────────────────
// Handles quoted fields and embedded commas/newlines (RFC 4180 subset).
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuote && next === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && next === '\n') i++;
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      const nx = line[i + 1];
      if (ch === '"') {
        if (q && nx === '"') {
          field += '"';
          i++;
        } else q = !q;
      } else if (ch === ',' && !q) {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field);
    return fields;
  };

  const headers = splitLine(nonEmpty[0]!).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = nonEmpty.slice(1).map((line) => {
    const values = splitLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] ?? '').trim();
    });
    return obj;
  });

  return { headers, rows };
}

function downloadBlob(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDialog({
  open,
  onOpenChange,
  entityType,
  entityLabel,
  requiredColumns,
  templateCsvContent,
  templateFileName,
  onParseXlsx,
  onSubmit,
  onPollStatus,
}: ImportDialogProps) {
  const [phase, setPhase] = React.useState<Phase>('upload');
  const [dragOver, setDragOver] = React.useState(false);
  const [fileName, setFileName] = React.useState('');
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [headerErrors, setHeaderErrors] = React.useState<string[]>([]);
  const [upsert, setUpsert] = React.useState(true);
  const activeJobIdRef = React.useRef<string | null>(null);
  const [result, setResult] = React.useState<ImportJobResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  function reset() {
    setPhase('upload');
    setDragOver(false);
    setFileName('');
    setHeaders([]);
    setRows([]);
    setHeaderErrors([]);
    setUpsert(true);
    activeJobIdRef.current = null;
    setResult(null);
    setSubmitting(false);
    setErrorMsg(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function loadFile(file: File) {
    setFileName(file.name);
    const isXlsx =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (isXlsx) {
      if (!onParseXlsx) {
        setHeaderErrors(['Excel files are not supported for this import.']);
        return;
      }
      void onParseXlsx(file)
        .then(({ headers: h, rows: r }) => {
          setHeaders(h);
          setRows(r);
          const missing = requiredColumns.filter((col) => !h.includes(col));
          setHeaderErrors(
            missing.length > 0 ? [`Missing required columns: ${missing.join(', ')}`] : []
          );
        })
        .catch(() => {
          setHeaderErrors(['Failed to parse Excel file. Please check the file and try again.']);
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);
      const missing = requiredColumns.filter((col) => !h.includes(col));
      setHeaderErrors(
        missing.length > 0 ? [`Missing required columns: ${missing.join(', ')}`] : []
      );
    };
    reader.readAsText(file, 'utf-8');
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  async function submit() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { jobId: id } = await onSubmit(rows, { upsert, fileName });
      activeJobIdRef.current = id;
      setPhase('progress');
      pollRef.current = setInterval(() => {
        void onPollStatus(id)
          .then((r) => {
            if (r.status === 'completed' || r.status === 'failed') {
              clearInterval(pollRef.current!);
              setResult(r);
              setPhase('result');
            }
          })
          .catch(() => {
            // transient error — keep polling
          });
      }, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function downloadErrorReport() {
    if (!result) return;
    const errorRows = result.rows.filter((r) => r.status === 'error');
    if (errorRows.length === 0) return;
    const lines = [
      'row_index,natural_key,error',
      ...errorRows.map(
        (r) => `${r.rowIndex},${r.naturalKey ?? ''},${JSON.stringify(r.errorMsg ?? '')}`
      ),
    ];
    downloadBlob(lines.join('\r\n'), `import-errors-${entityType}.csv`, 'text/csv');
  }

  const previewRows = rows.slice(0, 5);
  const previewHeaders = headers.slice(0, 8);

  const canProceed = rows.length > 0 && headerErrors.length === 0;

  return (
    <Modal open={open} onOpenChange={handleClose}>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>Import {entityLabel}</ModalTitle>
        </ModalHeader>

        {/* ── Phase: upload ── */}
        {phase === 'upload' && (
          <Stack gap={5} className="mt-4">
            <div
              className={cn(
                'flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors',
                dragOver
                  ? 'border-[var(--module-active)] bg-[var(--module-active-tint)]'
                  : 'border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]'
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('import-file-input')?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  document.getElementById('import-file-input')?.click();
              }}
              aria-label={`Upload ${onParseXlsx ? 'CSV or Excel' : 'CSV'} file`}
            >
              <Upload className="h-8 w-8 text-[var(--color-text-muted)]" />
              <Stack gap={1} className="text-center">
                <Text size="sm" className="font-medium">
                  Drop a {onParseXlsx ? 'CSV or Excel' : 'CSV'} file here, or click to browse
                </Text>
                <Text size="xs" variant="muted">
                  {onParseXlsx ? 'CSV or .xlsx' : 'UTF-8 CSV'}, up to 10,000 rows
                </Text>
              </Stack>
              <input
                id="import-file-input"
                type="file"
                accept={
                  onParseXlsx
                    ? '.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : '.csv,text/csv'
                }
                className="sr-only"
                onChange={onFileInput}
              />
            </div>

            {fileName && (
              <Stack direction="row" align="center" gap={2}>
                <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                <Text size="sm" className="truncate font-medium">
                  {fileName}
                </Text>
                {rows.length > 0 && (
                  <Badge color="success" className="ml-auto shrink-0">
                    {rows.length} rows
                  </Badge>
                )}
              </Stack>
            )}

            {headerErrors.length > 0 && (
              <Stack gap={1} className="rounded-md bg-[var(--color-danger-tint)] p-3">
                {headerErrors.map((e) => (
                  <Stack key={e} direction="row" align="start" gap={2}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
                    <Text size="sm" variant="danger">
                      {e}
                    </Text>
                  </Stack>
                ))}
              </Stack>
            )}

            {requiredColumns.length > 0 && (
              <Stack gap={1}>
                <Text size="xs" variant="muted" className="font-medium">
                  Required columns
                </Text>
                <Stack direction="row" gap={2} className="flex-wrap">
                  {requiredColumns.map((col) => (
                    <Badge
                      key={col}
                      color={headers.includes(col) ? 'success' : 'outline'}
                      className="font-mono text-xs"
                    >
                      {col}
                    </Badge>
                  ))}
                </Stack>
              </Stack>
            )}

            {templateCsvContent && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Download className="h-4 w-4" />}
                onClick={(e) => {
                  e.stopPropagation();
                  downloadBlob(
                    templateCsvContent,
                    templateFileName ?? `${entityType}-template.csv`,
                    'text/csv'
                  );
                }}
              >
                Download template CSV
              </Button>
            )}
          </Stack>
        )}

        {/* ── Phase: preview ── */}
        {phase === 'preview' && (
          <Stack gap={5} className="mt-4">
            <Stack direction="row" align="center" justify="between">
              <Text size="sm" className="font-medium">
                {rows.length} rows ready to import
              </Text>
              <Stack direction="row" align="center" gap={2}>
                <Label htmlFor="upsert-toggle" className="text-sm">
                  Update existing records
                </Label>
                <Switch id="upsert-toggle" checked={upsert} onCheckedChange={setUpsert} />
              </Stack>
            </Stack>

            <Text size="xs" variant="muted">
              {upsert
                ? 'Existing records matching the natural key (e.g. SKU, email) will be updated. New records will be created.'
                : 'Only new records will be created. Existing records that match will be skipped.'}
            </Text>

            <div className="overflow-x-auto rounded-lg border border-[var(--color-border-default)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-bg-subtle)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
                      #
                    </th>
                    {previewHeaders.map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]"
                      >
                        {h}
                      </th>
                    ))}
                    {headers.length > 8 && (
                      <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
                        +{headers.length - 8} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-[var(--color-border-default)]">
                      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{i + 1}</td>
                      {previewHeaders.map((h) => (
                        <td key={h} className="max-w-[120px] truncate px-3 py-1.5" title={row[h]}>
                          {row[h] ?? <span className="text-[var(--color-text-muted)]">—</span>}
                        </td>
                      ))}
                      {headers.length > 8 && <td />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 5 && (
              <Text size="xs" variant="muted">
                Showing first 5 of {rows.length} rows.
              </Text>
            )}

            {errorMsg && (
              <Stack
                direction="row"
                align="start"
                gap={2}
                className="rounded-md bg-[var(--color-danger-tint)] p-3"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
                <Text size="sm" variant="danger">
                  {errorMsg}
                </Text>
              </Stack>
            )}
          </Stack>
        )}

        {/* ── Phase: progress ── */}
        {phase === 'progress' && (
          <Stack gap={6} className="mt-4 items-center py-8">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border-default)] border-t-[var(--module-active)]" />
            <Stack gap={2} className="w-full max-w-xs text-center">
              <Text size="sm" className="font-medium">
                Importing {rows.length} rows…
              </Text>
              <Text size="xs" variant="muted">
                This runs in the background. You can close this dialog.
              </Text>
            </Stack>
            <Progress value={undefined} className="w-full max-w-xs" />
          </Stack>
        )}

        {/* ── Phase: result ── */}
        {phase === 'result' && result && (
          <Stack gap={5} className="mt-4">
            {result.status === 'completed' ? (
              <Stack direction="row" align="center" gap={2}>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-success)]" />
                <Text size="sm" className="font-medium">
                  Import complete
                </Text>
              </Stack>
            ) : (
              <Stack direction="row" align="center" gap={2}>
                <XCircle className="h-5 w-5 shrink-0 text-[var(--color-danger)]" />
                <Text size="sm" className="font-medium">
                  Import failed
                </Text>
              </Stack>
            )}

            <Stack direction="row" gap={4} className="flex-wrap">
              <Stack gap={1} className="text-center">
                <Text className="text-2xl font-bold tabular-nums">{result.importedCount}</Text>
                <Text size="xs" variant="muted">
                  Created
                </Text>
              </Stack>
              <Stack gap={1} className="text-center">
                <Text className="text-2xl font-bold tabular-nums">{result.updatedCount}</Text>
                <Text size="xs" variant="muted">
                  Updated
                </Text>
              </Stack>
              {result.errorCount > 0 && (
                <Stack gap={1} className="text-center">
                  <Text className="text-2xl font-bold text-[var(--color-danger)] tabular-nums">
                    {result.errorCount}
                  </Text>
                  <Text size="xs" variant="muted">
                    Errors
                  </Text>
                </Stack>
              )}
            </Stack>

            {result.errorCount > 0 && (
              <Stack gap={3}>
                <Text size="sm" className="font-medium">
                  Errors
                </Text>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--color-border-default)]">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--color-bg-subtle)]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
                          Key
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows
                        .filter((r) => r.status === 'error')
                        .map((r) => (
                          <tr
                            key={r.rowIndex}
                            className="border-t border-[var(--color-border-default)]"
                          >
                            <td className="px-3 py-1.5 tabular-nums">{r.rowIndex + 1}</td>
                            <td className="max-w-[100px] truncate px-3 py-1.5">
                              {r.naturalKey ?? '—'}
                            </td>
                            <td className="px-3 py-1.5 text-[var(--color-danger)]">
                              {r.errorMsg ?? '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={downloadErrorReport}
                >
                  Download error report
                </Button>
              </Stack>
            )}
          </Stack>
        )}

        <ModalFooter className="mt-6">
          {phase === 'upload' && (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button color="primary" disabled={!canProceed} onClick={() => setPhase('preview')}>
                Preview import
              </Button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setPhase('upload')}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button color="primary" loading={submitting} onClick={() => void submit()}>
                Import {rows.length} rows
              </Button>
            </>
          )}
          {phase === 'progress' && (
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Close — import continues in background
            </Button>
          )}
          {phase === 'result' && (
            <Button color="primary" onClick={() => handleClose(false)}>
              Done
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
