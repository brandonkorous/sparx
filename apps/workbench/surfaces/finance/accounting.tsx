'use client';

// ACCOUNTING — getting your numbers into whoever actually keeps the books.
//
// sparx does not do bookkeeping and never will: no ledger, no chart of accounts,
// no reconciliation, no tax filing. That is a permanent product position, not a
// gap waiting to be filled, and this screen is where it is honoured rather than
// apologised for. The promise is that everything recorded here leaves cleanly for
// QuickBooks, Sage 50, Xero, or an accountant who just wants the spreadsheet.
//
// SO THE SCREEN LEADS WITH THE EXPORT, not with a list of integrations that are
// mostly not built yet. The export works today, for every package, and it is the
// thing someone came here to do. Direct sync is listed underneath with an honest
// label on each — "does sparx work with Xero?" deserves an answer, and "not yet,
// and here is what works today instead" is a better one than an empty list.
//
// IMPORT NEVER WRITES BEFORE IT SHOWS. A CSV is previewed row by row, with the
// errors named and the total spelled out, and only then committed. An import that
// wrote 300 rows and then reported what it did is unrecoverable in practice.
//
// "BOOKS CLOSED ON" IS THE MOST IMPORTANT FIELD HERE. Nothing before that date is
// ever exported again, which is what stops a re-export re-posting a period the
// accountant has already closed — the single thing that would make a bookkeeper
// stop trusting the feed.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Table,
  Text,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { Check, Download, Link2, Plug, Save, Trash2, Upload } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import {
  downloadAccountingExport,
  spendErrorMessage,
  useAccounting,
  useCommitImport,
  useDeleteConnection,
  useExpenseCategories,
  useImportPreview,
  useMappings,
  useSaveConnection,
  useSaveMappings,
  useSyncRuns,
  type AccountingConnection,
  type AccountingProvider,
  type ImportPreview,
} from './spend-data';
import { PERIOD_OPTIONS, rangeFor, type PeriodKey } from './period';
import { formatCents, formatDate, formatDateTime, kindColor } from './format';

/* ── Export ─────────────────────────────────────────────────────────────────*/

function ExportPanel({
  catalog,
  connections,
}: {
  catalog: AccountingProvider[];
  connections: AccountingConnection[];
}) {
  const toast = useToast();
  const [period, setPeriod] = useState<PeriodKey>('last_month');
  const [provider, setProvider] = useState('csv');
  const [connectionId, setConnectionId] = useState('');
  const [markSent, setMarkSent] = useState(true);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => rangeFor(period), [period]);
  const descriptor = catalog.find((entry) => entry.provider === provider);
  const usable = catalog.filter((entry) => entry.availability === 'available');

  const run = async () => {
    setBusy(true);
    try {
      const result = await downloadAccountingExport({
        provider,
        from: range.from,
        to: range.to,
        connectionId: connectionId === '' ? null : connectionId,
        markSent,
      });
      afterPaneChange(() => {
        toast.add({
          title: `${result.filename} downloaded`,
          // Rows the server left out are surfaced, never dropped — a download
          // cannot carry a warning, and silence would read as "all of it".
          description:
            result.skipped > 0
              ? `${String(result.skipped)} ${result.skipped === 1 ? 'cost was' : 'costs were'} left out — usually because they fall before your books-closed date.`
              : 'Every cost in that period is in the file.',
          type: result.skipped > 0 ? 'warning' : 'success',
        });
      });
    } catch (error) {
      toast.add({
        title: 'Could not build the export',
        description: spendErrorMessage(error, 'Nothing was downloaded or changed.'),
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSection
      title="Send your spending to your accountant"
      description="A file with every cost in the period, one row each, with the columns your accounting package expects. This works today with every package on the list."
    >
      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Period</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                color="module"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value as PeriodKey);
                }}
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            }
          />
          <FieldDescription>
            {formatDate(range.from)} to {formatDate(range.to)}
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Laid out for</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                color="module"
                value={provider}
                onChange={(event) => {
                  setProvider(event.target.value);
                }}
              >
                {usable.map((entry) => (
                  <option key={entry.provider} value={entry.provider}>
                    {entry.name}
                  </option>
                ))}
              </NativeSelect>
            }
          />
        </Field>

        {connections.length > 0 ? (
          <Field className="@md:col-span-2">
            <FieldLabel>Use the settings from</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  color="module"
                  value={connectionId}
                  onChange={(event) => {
                    setConnectionId(event.target.value);
                  }}
                >
                  <option value="">Just the category names</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.displayName ?? connection.provider}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
            <FieldDescription>
              Uses that connection&apos;s account codes and respects its books-closed date.
            </FieldDescription>
          </Field>
        ) : null}
      </div>

      {descriptor ? (
        <div className="border-base-300 flex flex-col gap-2 rounded-lg border p-3">
          <Text className="text-sm font-medium">Columns in the file</Text>
          <div className="flex flex-wrap gap-1.5">
            {descriptor.exportColumns.map((column) => (
              <Badge key={column} color="neutral" variant="soft" size="sm">
                {column}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Checkbox
          id="accounting-mark-sent"
          color="module"
          className="mt-0.5"
          checked={markSent}
          onChange={(event) => {
            setMarkSent(event.target.checked);
          }}
        />
        <label htmlFor="accounting-mark-sent" className="flex flex-col">
          <span className="font-medium">Mark these as sent</span>
          <span className="text-sm">
            Stamps each cost so you can tell later what has already gone to your accountant and what
            has not. Leave it off for a scratch copy you are not going to send.
          </span>
        </label>
      </div>

      <div>
        <Button size="sm" color="module" loading={busy} onClick={() => void run()}>
          <Download className="size-4" aria-hidden />
          Download the file
        </Button>
      </div>
    </FormSection>
  );
}

/* ── Import ─────────────────────────────────────────────────────────────────*/

const COLUMN_FIELDS = [
  { key: 'date', label: 'Date', required: true, hint: 'When the cost happened' },
  { key: 'description', label: 'What it was for', required: true, hint: 'The description column' },
  { key: 'amount', label: 'Amount', required: true, hint: 'The money column' },
  { key: 'vendor', label: 'Who you paid', required: false, hint: 'Optional' },
  { key: 'reference', label: 'Reference', required: false, hint: 'Optional' },
  { key: 'category', label: 'Category', required: false, hint: 'Optional' },
] as const;

function ImportPanel({ categories }: { categories: { id: string; name: string }[] }) {
  const toast = useToast();
  const preview = useImportPreview();
  const commit = useCommitImport();

  const [csv, setCsv] = useState('');
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [fallbackCategoryId, setFallbackCategoryId] = useState('');
  const [invertAmounts, setInvertAmounts] = useState(false);
  const [sourceKey, setSourceKey] = useState('');
  const [result, setResult] = useState<ImportPreview | null>(null);

  // Header names come from the pasted file itself — a dropdown of real column
  // names beats asking someone to type "Transaction Date" exactly.
  const headers = useMemo(() => {
    const firstLine = csv.split(/\r?\n/)[0] ?? '';
    if (firstLine.trim() === '') return [];
    return firstLine.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  }, [csv]);

  const mappedOk =
    (columns.date ?? '') !== '' &&
    (columns.description ?? '') !== '' &&
    (columns.amount ?? '') !== '';
  const canPreview = csv.trim() !== '' && mappedOk && fallbackCategoryId !== '';

  const body = () => ({
    csv,
    columns: {
      date: columns.date ?? '',
      description: columns.description ?? '',
      amount: columns.amount ?? '',
      ...(columns.vendor ? { vendor: columns.vendor } : {}),
      ...(columns.reference ? { reference: columns.reference } : {}),
      ...(columns.category ? { category: columns.category } : {}),
    },
    fallbackCategoryId,
    invertAmounts,
    sourceKey:
      sourceKey.trim() === ''
        ? `import-${new Date().toISOString().slice(0, 10)}`
        : sourceKey.trim(),
  });

  const runPreview = () => {
    if (!canPreview) return;
    preview.mutate(body(), {
      onSuccess: setResult,
      onError: (error) => {
        toast.add({
          title: 'Could not read that file',
          description: spendErrorMessage(error, 'Nothing was imported.'),
          type: 'error',
        });
      },
    });
  };

  const runCommit = () => {
    commit.mutate(body(), {
      onSuccess: (outcome) => {
        setResult(null);
        setCsv('');
        afterPaneChange(() => {
          toast.add({
            title: `${String(outcome.imported)} ${outcome.imported === 1 ? 'cost' : 'costs'} imported`,
            description:
              outcome.skipped > 0
                ? `${String(outcome.skipped)} were skipped because they had already been imported.`
                : 'They are in your spending list now.',
            type: 'success',
          });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not import that file',
          description: spendErrorMessage(error, 'Nothing was imported.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <FormSection
      title="Bring spending in from somewhere else"
      description="Paste a spreadsheet export from your bank or your old system. Nothing is written until you have seen exactly what it will do."
    >
      <Field>
        <FieldLabel>The file</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={6}
              value={csv}
              spellCheck={false}
              placeholder={'Date,Description,Amount\n2026-01-04,Fuel,54.20'}
              className="font-mono text-sm"
              onChange={(event) => {
                setCsv(event.target.value);
                setResult(null);
              }}
            />
          }
        />
        <FieldDescription>
          Open the CSV in a spreadsheet, select everything including the header row, and paste it
          here.
        </FieldDescription>
      </Field>

      {headers.length > 0 ? (
        <>
          <div className="grid gap-3 @md:grid-cols-2">
            {COLUMN_FIELDS.map((field) => (
              <Field key={field.key}>
                <FieldLabel required={field.required}>{field.label}</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      color="module"
                      value={columns[field.key] ?? ''}
                      onChange={(event) => {
                        setColumns((current) => ({ ...current, [field.key]: event.target.value }));
                        setResult(null);
                      }}
                    >
                      <option value="">Not in the file</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
                <FieldDescription>{field.hint}</FieldDescription>
              </Field>
            ))}

            <Field>
              <FieldLabel required>File anything unmatched under</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect
                    color="module"
                    value={fallbackCategoryId}
                    onChange={(event) => {
                      setFallbackCategoryId(event.target.value);
                      setResult(null);
                    }}
                  >
                    <option value="">Choose a category…</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </NativeSelect>
                }
              />
              <FieldDescription>
                Rows whose category does not match one of yours land here, so nothing is dropped.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Name this import</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={sourceKey}
                    spellCheck={false}
                    placeholder="bank-january"
                    onChange={(event) => {
                      setSourceKey(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                Used to spot rows you have already imported, so running the same file twice does not
                double your costs.
              </FieldDescription>
            </Field>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="import-invert-amounts"
              color="module"
              className="mt-0.5"
              checked={invertAmounts}
              onChange={(event) => {
                setInvertAmounts(event.target.checked);
                setResult(null);
              }}
            />
            <label htmlFor="import-invert-amounts" className="flex flex-col">
              <span className="font-medium">Amounts are negative in this file</span>
              <span className="text-sm">
                Bank exports usually show money going out as a negative. Tick this and they come in
                as costs rather than as refunds.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              disabled={!canPreview}
              loading={preview.isPending}
              onClick={runPreview}
            >
              <Upload className="size-4" aria-hidden />
              Check the file
            </Button>
            {result ? (
              <Button
                size="sm"
                color="module"
                disabled={result.validCount === 0}
                loading={commit.isPending}
                onClick={runCommit}
              >
                <Check className="size-4" aria-hidden />
                Import {String(result.validCount)} {result.validCount === 1 ? 'cost' : 'costs'}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="success" variant="soft">
              {String(result.validCount)} ready
            </Badge>
            {result.errorCount > 0 ? (
              <Badge color="danger" variant="soft">
                {String(result.errorCount)} cannot be read
              </Badge>
            ) : null}
            <Text className="text-sm">
              Totalling {formatCents(result.totalCents)} — nothing has been saved yet.
            </Text>
          </div>

          {result.errorCount > 0 ? (
            <Alert color="warning" variant="soft">
              <AlertContent>
                <AlertTitle>Some rows will be left out</AlertTitle>
                <AlertDescription>
                  Importing brings in the rows that can be read and skips the rest. Fix them in the
                  spreadsheet and paste it again if you need all of it.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <Card className="overflow-hidden">
            <Table size="sm">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Date</th>
                  <th>What for</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 25).map((row) => (
                  <tr key={row.line}>
                    <td className="tabular-nums">{row.line}</td>
                    <td className="whitespace-nowrap">
                      {row.error ? (
                        <Badge color="danger" variant="soft" size="sm">
                          {row.error}
                        </Badge>
                      ) : (
                        formatDate(row.incurredAt)
                      )}
                    </td>
                    <td className="max-w-56 truncate">{row.description}</td>
                    <td className="text-right tabular-nums">
                      {row.amountCents === null ? '—' : formatCents(row.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {result.rows.length > 25 ? (
            <Text className="text-sm">
              Showing the first 25 of {String(result.rows.length)} rows.
            </Text>
          ) : null}
        </div>
      ) : null}
    </FormSection>
  );
}

/* ── Connections ────────────────────────────────────────────────────────────*/

/**
 * Category → their account code.
 *
 * The whole reason the export is worth anything to a bookkeeper. Without it,
 * every cost lands in their books under whatever sparx happened to call the
 * category ("Fuel"), and someone re-files all of it by hand every month. With
 * it, "Fuel" arrives as `6420` and posts straight to the right account.
 *
 * Left blank is a REAL and fine answer, not an unfinished row: `accountFor`
 * falls back to the category's export code and then to its name, so an unmapped
 * category still exports something a human recognises rather than a blank column
 * or a failed row. The screen says so, because otherwise a half-filled table
 * looks like a job someone abandoned.
 */
function MappingTable({ connectionId }: { connectionId: string }) {
  const toast = useToast();
  const categories = useExpenseCategories();
  const saved = useMappings(connectionId);
  const saveMappings = useSaveMappings(connectionId);

  // Category id → the code typed against it. Seeded from the server once loaded;
  // `dirty` guards the seed so typing is never overwritten by a background refetch.
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty || !saved.data) return;
    const next: Record<string, string> = {};
    for (const mapping of saved.data) {
      if (mapping.sparxType !== 'expense_category') continue;
      next[mapping.sparxId] = mapping.externalCode ?? mapping.externalName ?? '';
    }
    setCodes(next);
  }, [saved.data, dirty]);

  const rows = (categories.data ?? []).filter((category) => category.archivedAt === null);

  const onSave = () => {
    saveMappings.mutate(
      rows
        // Only send rows that carry a code. A blank is "no mapping", and writing
        // an empty mapping row would be indistinguishable from one at read time
        // while still counting as a saved decision.
        .filter((category) => (codes[category.id] ?? '').trim() !== '')
        .map((category) => ({
          sparxType: 'expense_category' as const,
          sparxId: category.id,
          categoryId: category.id,
          externalId: codes[category.id]!.trim(),
          externalCode: codes[category.id]!.trim(),
          externalName: category.name,
        })),
      {
        onSuccess: (result) => {
          setDirty(false);
          afterPaneChange(() => {
            toast.add({
              title:
                result.saved === 0
                  ? 'Nothing mapped yet'
                  : `${String(result.saved)} ${result.saved === 1 ? 'category' : 'categories'} mapped`,
              description:
                result.saved === 0
                  ? 'Exports will use your own category names, which still works.'
                  : 'Your next export will use these codes.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save the mapping',
            description: spendErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  if (rows.length === 0) return null;

  const mappedCount = rows.filter((c) => (codes[c.id] ?? '').trim() !== '').length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text className="text-sm font-medium">Where each cost lands in their books</Text>
        <Badge color={mappedCount === 0 ? 'neutral' : 'module'} variant="soft" size="sm">
          {mappedCount} of {rows.length} mapped
        </Badge>
      </div>

      <Text className="text-sm">
        Type the account code your accountant uses for each kind of cost. Leave any of them blank
        and the export sends the category name instead — that still works, it just means someone
        files it at the other end.
      </Text>

      <Card className="overflow-hidden">
        <Table size="sm">
          <thead>
            <tr>
              <th>Your category</th>
              <th>Their account code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((category) => (
              <tr key={category.id}>
                <td>
                  <Badge color={kindColor(category.kind)} variant="soft" size="sm">
                    {category.name}
                  </Badge>
                </td>
                <td>
                  <Input
                    color="module"
                    size="sm"
                    spellCheck={false}
                    aria-label={`Account code for ${category.name}`}
                    placeholder={category.exportCode ?? 'e.g. 6420'}
                    value={codes[category.id] ?? ''}
                    onChange={(event) => {
                      setDirty(true);
                      setCodes((current) => ({ ...current, [category.id]: event.target.value }));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div>
        <Button
          size="sm"
          color="module"
          disabled={!dirty}
          loading={saveMappings.isPending}
          onClick={onSave}
        >
          <Save className="size-4" aria-hidden />
          Save the mapping
        </Button>
      </div>
    </div>
  );
}

function ConnectionCard({ connection }: { connection: AccountingConnection }) {
  const toast = useToast();
  const confirm = useConfirm();
  const save = useSaveConnection();
  const disconnect = useDeleteConnection();
  const runs = useSyncRuns(connection.id);

  const [closedOn, setClosedOn] = useState(
    connection.syncFromDate ? connection.syncFromDate.slice(0, 10) : ''
  );

  const saveClosedOn = () => {
    save.mutate(
      {
        provider: connection.provider,
        displayName: connection.displayName,
        syncCadence: connection.syncCadence as 'manual' | 'daily' | 'weekly',
        syncFromDate: closedOn === '' ? null : new Date(`${closedOn}T00:00:00.000Z`).toISOString(),
      },
      {
        onSuccess: () => {
          afterPaneChange(() => {
            toast.add({ title: 'Saved', type: 'success' });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save that',
            description: spendErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const onDisconnect = async () => {
    const ok = await confirm({
      title: `Disconnect ${connection.displayName ?? connection.provider}?`,
      description:
        'Exports stop using its account codes and books-closed date. Nothing already sent is recalled, and none of your spending is deleted.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    disconnect.mutate(connection.id, {
      onSuccess: () => {
        afterPaneChange(() => {
          toast.add({ title: 'Disconnected', type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not disconnect',
          description: spendErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text className="font-medium">{connection.displayName ?? connection.provider}</Text>
            <Badge
              color={connection.status === 'connected' ? 'success' : 'warning'}
              variant="soft"
              size="sm"
            >
              {connection.status === 'connected' ? 'Connected' : connection.status}
            </Badge>
          </div>
          <Text className="text-sm">
            {connection.lastSyncAt
              ? `Last sent ${formatDateTime(connection.lastSyncAt)}`
              : 'Nothing sent through this yet'}
          </Text>
        </div>
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          shape="square"
          aria-label="Disconnect"
          onClick={() => {
            void onDisconnect();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      <Field>
        <FieldLabel>Books closed on</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <FieldControl
            render={
              <Input
                color="module"
                type="date"
                value={closedOn}
                className="max-w-48"
                onChange={(event) => {
                  setClosedOn(event.target.value);
                }}
              />
            }
          />
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            loading={save.isPending}
            onClick={saveClosedOn}
          >
            Save
          </Button>
        </div>
        <FieldDescription>
          Nothing dated before this is ever sent again, however many times you export. This is what
          stops a re-send re-posting a period your accountant has already closed.
        </FieldDescription>
      </Field>

      <MappingTable connectionId={connection.id} />

      {(runs.data ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          <Text className="text-sm font-medium">Recent sends</Text>
          <ul className="flex flex-col gap-1">
            {(runs.data ?? []).slice(0, 5).map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{formatDateTime(run.startedAt)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">
                    {String(run.recordsSynced)} sent
                    {run.recordsSkipped > 0 ? ` · ${String(run.recordsSkipped)} left out` : ''}
                  </span>
                  <Badge
                    color={
                      run.recordsFailed > 0
                        ? 'danger'
                        : run.recordsSkipped > 0
                          ? 'warning'
                          : 'success'
                    }
                    variant="soft"
                    size="sm"
                  >
                    {run.recordsFailed > 0 ? 'Problems' : 'Done'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/* ── The pane ───────────────────────────────────────────────────────────────*/

export function AccountingSurface() {
  const toast = useToast();
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAccounting();
  const categories = useExpenseCategories();
  const connect = useSaveConnection();

  const catalog = data?.catalog ?? [];
  const connections = data?.connections ?? [];
  const connectedProviders = new Set(connections.map((connection) => connection.provider));

  const addConnection = (provider: AccountingProvider) => {
    connect.mutate(
      { provider: provider.provider, displayName: provider.name, syncCadence: 'manual' },
      {
        onSuccess: () => {
          afterPaneChange(() => {
            toast.add({
              title: `${provider.name} set up`,
              description: 'Set your books-closed date so nothing already filed gets sent again.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not set that up',
            description: spendErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Accounting controls">
        <span className="inline-flex items-center gap-1.5">
          <Plug className="size-4" aria-hidden />
          <Text as="span" className="text-sm font-medium">
            Your accounting package
          </Text>
        </span>
        <RefreshButton
          className="ml-auto"
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <div className="p-4">
            <Alert color="danger" variant="soft">
              <AlertContent>
                <AlertDescription>
                  Could not load your accounting settings. The server could not be reached.
                </AlertDescription>
              </AlertContent>
              <Button
                size="sm"
                color="danger"
                variant="soft"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            </Alert>
          </div>
        ) : isPending || !data ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {/* The position, said plainly and once, at the top. Someone arriving
                here wondering whether sparx replaces their accountant deserves
                the answer before they start looking for a ledger. */}
            <Card className="p-4">
              <Heading level={2} className="text-lg font-semibold">
                sparx is not your accounting package
              </Heading>
              <Text className="mt-1 text-sm">
                It records what you spend and what each job made, so you can run the business. Your
                books, your tax and your filings stay with QuickBooks, Sage 50, Xero or your
                accountant — and everything here leaves cleanly for them.
              </Text>
            </Card>

            <ExportPanel catalog={catalog} connections={connections} />

            <ImportPanel categories={categories.data ?? []} />

            {connections.length > 0 ? (
              <div className="flex flex-col gap-3">
                <Heading level={2} className="px-1 text-lg font-semibold">
                  Set up
                </Heading>
                {connections.map((connection) => (
                  <ConnectionCard key={connection.id} connection={connection} />
                ))}
              </div>
            ) : null}

            <FormSection
              title="Sending it automatically"
              description="Direct sync means sparx posts each cost for you instead of you moving a file. Where it is not switched on yet, the export above already works with that package today."
            >
              <ul className="flex flex-col gap-2">
                {catalog
                  .filter((entry) => entry.connect === 'oauth' || entry.provider !== 'csv')
                  .map((entry) => {
                    const ready = entry.availability === 'available';
                    return (
                      <li
                        key={entry.provider}
                        className="border-base-300 flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Text className="font-medium">{entry.name}</Text>
                            <Badge color={ready ? 'success' : 'neutral'} variant="soft" size="sm">
                              {ready ? 'Ready' : 'Not yet'}
                            </Badge>
                            {connectedProviders.has(entry.provider) ? (
                              <Badge color="module" variant="soft" size="sm">
                                Set up
                              </Badge>
                            ) : null}
                          </div>
                          <Text className="text-sm">
                            {ready ? entry.blurb : (entry.unavailableReason ?? entry.blurb)}
                          </Text>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          color="neutral"
                          disabled={!ready || connectedProviders.has(entry.provider)}
                          loading={connect.isPending}
                          onClick={() => {
                            addConnection(entry);
                          }}
                        >
                          <Link2 className="size-4" aria-hidden />
                          Connect
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </FormSection>
          </div>
        )}
      </div>
    </div>
  );
}
