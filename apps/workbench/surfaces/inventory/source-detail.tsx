'use client';

// ONE STOCK SOURCE — set one up, keep it running, or take it away.
//
// ── Create and manage are the same pane ──────────────────────────────────
//
// Adding a source and editing one are the same fields in the same places, so
// this is ONE surface in two states: `{id:'new'}` builds a connection, `{id}`
// manages it. Writing a separate "add" form would mean maintaining the same
// fields twice forever.
//
// ── Not EditorLayout ─────────────────────────────────────────────────────
//
// It docks narrow (beside the list it opened from). A completion-ordered form
// with a summary rail would leave an empty rail floating beside a short column,
// so it is one centred column of grouped sections instead.
//
// ── The audience runs a business, not a server ───────────────────────────
//
// The three kinds are named for what they are — a spreadsheet file, a connected
// system, an on-site bridge — never their tier codes, and every technical field
// says what it is FOR in the same breath.
//
// ── The key is never in the browser ──────────────────────────────────────
//
// A connected system's access key is stored on the server and never sent back.
// The field stays blank on an existing source: leave it to keep the saved key,
// type a new one to replace it. So this pane never holds a secret.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Text,
  Textarea,
  Timestamp,
  useImperativeAlertDialog,
  useToast,
} from '@wizeworks/silicaui-react';
import { Cable, FileSpreadsheet, Pause, Play, RefreshCw, Save, Server, Trash2 } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  agentOnline,
  isNotFound,
  relativeTime,
  sourceErrorMessage,
  sourceState,
  sourceTypeDescription,
  sourceTypeLabel,
  syncIntervalLabel,
  SYNC_INTERVALS,
  useCreateSource,
  useDeleteSource,
  useInventorySource,
  useSyncSource,
  useUpdateSource,
  type InventorySource,
  type SourceType,
} from './sources-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

type AuthScheme = 'none' | 'bearer' | 'header';

function asAuthScheme(value: unknown): AuthScheme {
  return value === 'bearer' || value === 'header' ? value : 'none';
}

interface Draft {
  name: string;
  type: SourceType;
  interval: number;
  notes: string;
  csvUrl: string;
  endpoint: string;
  authScheme: AuthScheme;
  apiKey: string;
  headerName: string;
  itemsPath: string;
  skuField: string;
  quantityField: string;
  locationField: string;
  costField: string;
  costUnit: 'cents' | 'dollars';
}

function draftFromSource(source: InventorySource | null): Draft {
  const c = source?.config ?? {};
  return {
    name: source?.name ?? '',
    type: source?.type ?? 'csv',
    interval: source?.syncIntervalSec ?? 0,
    notes: source?.notes ?? '',
    csvUrl: str(c.csvUrl),
    endpoint: str(c.endpoint),
    authScheme: asAuthScheme(c.authScheme),
    // Never populated from the server — the key is redacted on read.
    apiKey: '',
    headerName: str(c.headerName),
    itemsPath: str(c.itemsPath),
    skuField: str(c.skuField),
    quantityField: str(c.quantityField),
    locationField: str(c.locationField),
    costField: str(c.costField),
    costUnit: c.costUnit === 'dollars' ? 'dollars' : 'cents',
  };
}

/** The address a source points at, for the identity line — a connected system's
 *  endpoint or a spreadsheet's web address. An on-site bridge has none. */
function sourceAddress(source: InventorySource): string | null {
  if (source.type === 'csv') return str(source.config.csvUrl) || null;
  if (source.type === 'api') return str(source.config.endpoint) || null;
  return null;
}

function TypeIcon({ type, className }: { type: SourceType; className?: string }) {
  const Icon = type === 'csv' ? FileSpreadsheet : type === 'api' ? Cable : Server;
  return <Icon className={className} aria-hidden />;
}

/* ── The editor ──────────────────────────────────────────────────────────── */

function SourceEditor({
  ctx,
  source,
  onRefresh,
  isFetching,
}: {
  ctx: SurfaceContext;
  source: InventorySource | null;
  /** Re-read this source from the server without remounting — preserves the
   *  in-progress draft. Only present in manage mode. */
  onRefresh?: () => void;
  isFetching?: boolean;
}) {
  const toast = useToast();
  const confirm = useImperativeAlertDialog();
  const create = useCreateSource();
  const update = useUpdateSource();
  const remove = useDeleteSource();
  const sync = useSyncSource();

  const isNew = source === null;
  const initial = useMemo(() => draftFromSource(source), [source]);

  const [name, setName] = useState(initial.name);
  const [type, setType] = useState<SourceType>(initial.type);
  const [interval, setIntervalSec] = useState(initial.interval);
  const [notes, setNotes] = useState(initial.notes);
  const [csvUrl, setCsvUrl] = useState(initial.csvUrl);
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [authScheme, setAuthScheme] = useState<AuthScheme>(initial.authScheme);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [headerName, setHeaderName] = useState(initial.headerName);
  const [itemsPath, setItemsPath] = useState(initial.itemsPath);
  const [skuField, setSkuField] = useState(initial.skuField);
  const [quantityField, setQuantityField] = useState(initial.quantityField);
  const [locationField, setLocationField] = useState(initial.locationField);
  const [costField, setCostField] = useState(initial.costField);
  const [costUnit, setCostUnit] = useState<'cents' | 'dollars'>(initial.costUnit);

  const hasSavedKey = Boolean(source && (source.config.hasApiKey as boolean | undefined));

  useEffect(() => {
    ctx.setTitle(isNew ? 'Add a stock source' : (source?.name ?? 'Stock source'));
  }, [ctx, isNew, source?.name]);

  // Serialise the meaningful fields so dirtiness survives any field changing,
  // without hand-listing a comparison per input.
  const current: Draft = {
    name,
    type,
    interval,
    notes,
    csvUrl,
    endpoint,
    authScheme,
    apiKey,
    headerName,
    itemsPath,
    skuField,
    quantityField,
    locationField,
    costField,
    costUnit,
  };
  const dirty = JSON.stringify(current) !== JSON.stringify(initial);

  const saving = create.isPending || update.isPending;

  useDirtySource(
    dirty && !saving,
    isNew
      ? 'This stock source has not been added yet. Close anyway?'
      : `Changes to ${source?.name ?? 'this source'} have not been saved. Close anyway?`
  );

  // ── What a valid config looks like, per kind ───────────────────────────
  const looksLikeUrl = (value: string) => /^https?:\/\/\S+/i.test(value.trim());
  const needsKey = authScheme !== 'none' && apiKey.trim() === '' && !hasSavedKey;
  const needsHeaderName = authScheme === 'header' && headerName.trim() === '';

  const configValid =
    type === 'csv'
      ? looksLikeUrl(csvUrl)
      : type === 'agent'
        ? true
        : looksLikeUrl(endpoint) &&
          skuField.trim() !== '' &&
          quantityField.trim() !== '' &&
          !needsKey &&
          !needsHeaderName;

  const canSave = name.trim() !== '' && configValid && dirty && !saving;

  function buildConfig(): Record<string, unknown> {
    if (type === 'csv') return { csvUrl: csvUrl.trim() };
    if (type === 'agent') return {};
    const config: Record<string, unknown> = {
      endpoint: endpoint.trim(),
      authScheme,
      itemsPath: itemsPath.trim(),
      skuField: skuField.trim(),
      quantityField: quantityField.trim(),
      costUnit,
    };
    if (apiKey.trim() !== '') config.apiKey = apiKey.trim();
    if (authScheme === 'header') config.headerName = headerName.trim();
    if (locationField.trim() !== '') config.locationField = locationField.trim();
    if (costField.trim() !== '') config.costField = costField.trim();
    return config;
  }

  const save = () => {
    if (!canSave) return;
    const trimmedNotes = notes.trim() === '' ? null : notes.trim();

    // Narrow on `source` itself (not the aliased `isNew`) so the update branch
    // below knows it is non-null.
    if (source === null) {
      create.mutate(
        {
          name: name.trim(),
          type,
          config: buildConfig(),
          syncIntervalSec: interval,
          notes: trimmedNotes,
        },
        {
          onSuccess: (created) => {
            // Becomes the manage view for the source that now exists.
            ctx.open('inventory.sources.detail', { id: created.id }, { target: 'replace' });
            afterPaneChange(() => {
              toast.add({
                title: `${created.name} added`,
                description:
                  created.type === 'agent'
                    ? 'Now install the bridge on your computer and pair it.'
                    : 'You can pull the latest numbers now with Sync now.',
                type: 'success',
              });
            });
          },
          onError: (error) => {
            toast.add({
              title: 'Could not add that source',
              description: sourceErrorMessage(error, 'Nothing was saved.'),
              type: 'error',
            });
          },
        }
      );
      return;
    }

    update.mutate(
      {
        id: source.id,
        name: name.trim(),
        // An on-site bridge has no settings to replace — leave its config alone.
        ...(type === 'agent' ? {} : { config: buildConfig() }),
        syncIntervalSec: interval,
        notes: trimmedNotes,
      },
      {
        onSuccess: () => {
          // Clear the key field so it returns to "keep what's saved".
          setApiKey('');
          toast.add({ title: `${name.trim()} saved`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save that',
            description: sourceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const togglePaused = () => {
    if (!source) return;
    const next = source.status === 'paused' ? 'active' : 'paused';
    update.mutate(
      { id: source.id, status: next },
      {
        onSuccess: () => {
          toast.add({
            title: next === 'paused' ? `${source.name} paused` : `${source.name} turned back on`,
            description:
              next === 'paused'
                ? 'It will stop updating your stock until you turn it back on.'
                : 'It will update your stock again on its schedule.',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not change that',
            description: sourceErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const runSync = () => {
    if (!source) return;
    sync.mutate(source.id, {
      onSuccess: () => {
        toast.add({
          title: `${source.name} is syncing`,
          description: 'We have started pulling the latest numbers.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not start a sync',
          description: sourceErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const removeSource = async () => {
    if (!source) return;
    const ok = await confirm({
      title: `Remove ${source.name}?`,
      description:
        'This stops the connection and takes it off your list. Any stock numbers it has already brought in stay exactly as they are — only the link is removed. You can set it up again later.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(source.id, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${source.name} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove that source',
          description: sourceErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const state = source ? sourceState(source) : null;
  const address = source ? sourceAddress(source) : null;

  return (
    <div className={PANE_SHELL}>
      {isNew ? (
        <PaneToolbar label="Add a stock source actions">
          <Button
            size="sm"
            color="module"
            className="ml-auto"
            loading={create.isPending}
            disabled={!canSave}
            onClick={save}
          >
            <Save className="size-4" aria-hidden />
            Add this source
          </Button>
        </PaneToolbar>
      ) : (
        <PaneToolbar label="Stock source actions" wrap>
          {state ? (
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            color="neutral"
            className="ml-auto shrink-0"
            loading={update.isPending}
            onClick={togglePaused}
          >
            {source?.status === 'paused' ? (
              <>
                <Play className="size-4" aria-hidden />
                <span className="hidden @lg:inline">Turn on</span>
              </>
            ) : (
              <>
                <Pause className="size-4" aria-hidden />
                <span className="hidden @lg:inline">Pause</span>
              </>
            )}
          </Button>

          {type === 'agent' ? null : (
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              className="shrink-0"
              loading={sync.isPending}
              disabled={source?.status === 'paused'}
              onClick={runSync}
            >
              <RefreshCw className="size-4" aria-hidden />
              <span className="hidden @lg:inline">Sync now</span>
            </Button>
          )}

          <Button
            size="sm"
            color="module"
            className="shrink-0"
            loading={update.isPending}
            disabled={!canSave}
            onClick={save}
          >
            <Save className="size-4" aria-hidden />
            Save
          </Button>

          <Button
            size="sm"
            variant="ghost"
            color="danger"
            shape="square"
            className="shrink-0"
            aria-label="Remove this source"
            title="Remove this source"
            loading={remove.isPending}
            onClick={() => {
              void removeSource();
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>

          {/* Re-reads liveness/last-sync from the server without remounting, so
              an in-progress draft survives the refresh. */}
          <RefreshButton
            isFetching={isFetching ?? sync.isPending}
            updatedAt={source ? new Date(source.updatedAt).getTime() : undefined}
            onRefresh={() => {
              onRefresh?.();
            }}
          />
        </PaneToolbar>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Add a stock source
              </Heading>
              <Text>
                Connect something outside sparx that keeps its own count. Once it is set up, its
                numbers flow in and become the stock you sell against.
              </Text>
            </div>
          ) : source ? (
            // The name is an editable field below, so it is NOT repeated as a
            // heading. Identity here is what KIND this is and where it points.
            <div className="flex min-w-0 items-center gap-3">
              <TypeIcon type={source.type} className="text-module size-6 shrink-0" />
              <div className="flex min-w-0 flex-col">
                <Heading level={1} className="min-w-0 truncate text-2xl font-semibold">
                  {sourceTypeLabel(source.type)}
                </Heading>
                {address ? (
                  <Text className="min-w-0 truncate font-mono text-sm">{address}</Text>
                ) : (
                  <Text className="text-sm">A bridge running on your own computers.</Text>
                )}
              </div>
            </div>
          ) : null}

          {/* One specific message: a connected system needs a key for the auth it
              was set to use, which is the one non-obvious rejection. */}
          {type === 'api' && needsKey ? (
            <Alert color="warning" variant="soft">
              <AlertContent>
                <AlertTitle>This connection needs an access key</AlertTitle>
                <AlertDescription>
                  You chose a sign-in method that sends a key, so add the key below — or switch the
                  method to “No key needed” if the system is open.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {isNew ? (
            <FormSection
              title="What kind of source is it?"
              description="Pick how the numbers reach us. You cannot change this later, so it is worth getting right."
            >
              <Field>
                <FieldLabel>Kind of connection</FieldLabel>
                <NativeSelect
                  color="module"
                  value={type}
                  aria-label="Kind of connection"
                  onChange={(event) => {
                    setType(event.target.value as SourceType);
                  }}
                >
                  <option value="csv">{sourceTypeLabel('csv')}</option>
                  <option value="api">{sourceTypeLabel('api')}</option>
                  <option value="agent">{sourceTypeLabel('agent')}</option>
                </NativeSelect>
                <FieldDescription>{sourceTypeDescription(type)}</FieldDescription>
              </Field>
            </FormSection>
          ) : null}

          <FormSection title="Details">
            <Field>
              <FieldLabel>What to call it</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={name}
                    placeholder="Warehouse spreadsheet"
                    onChange={(event) => {
                      setName(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                A name you will recognise on your list — where it comes from or who looks after it.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Notes (optional)</FieldLabel>
              <Textarea
                color="module"
                rows={2}
                value={notes}
                placeholder="Anything worth remembering about this connection"
                onChange={(event) => {
                  setNotes(event.target.value);
                }}
              />
            </Field>
          </FormSection>

          {/* ── Connection settings, by kind ─────────────────────────────── */}
          {type === 'csv' ? (
            <FormSection
              title="Where your spreadsheet lives"
              description="We fetch this file on a schedule and read the stock levels from it."
            >
              <Field>
                <FieldLabel>Web address of the file</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      value={csvUrl}
                      placeholder="https://example.com/stock.csv"
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) => {
                        setCsvUrl(event.target.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  A link we can open that returns the spreadsheet. It needs a column headed “sku”
                  and one headed “quantity”, and may include a “location” column. Publish it
                  somewhere we can reach without a password.
                </FieldDescription>
              </Field>
            </FormSection>
          ) : null}

          {type === 'api' ? (
            <>
              <FormSection
                title="How to reach the system"
                description="Where we fetch from, and how it checks the request is really from you."
              >
                <Field>
                  <FieldLabel>Web address we fetch from</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        color="module"
                        value={endpoint}
                        placeholder="https://api.example.com/inventory"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => {
                          setEndpoint(event.target.value);
                        }}
                      />
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>How it checks it is you</FieldLabel>
                  <NativeSelect
                    color="module"
                    value={authScheme}
                    aria-label="How it checks it is you"
                    onChange={(event) => {
                      setAuthScheme(event.target.value as AuthScheme);
                    }}
                  >
                    <option value="none">No key needed</option>
                    <option value="bearer">A key sent as a bearer token</option>
                    <option value="header">A key sent in a named header</option>
                  </NativeSelect>
                  <FieldDescription>
                    Most systems give you a key to prove who you are. Choose how theirs expects it.
                  </FieldDescription>
                </Field>

                {authScheme !== 'none' ? (
                  <Field>
                    <FieldLabel>Access key</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          type="password"
                          value={apiKey}
                          placeholder={hasSavedKey ? 'A key is already saved' : 'Paste the key'}
                          autoComplete="off"
                          onChange={(event) => {
                            setApiKey(event.target.value);
                          }}
                        />
                      }
                    />
                    <FieldDescription>
                      {hasSavedKey
                        ? 'A key is already saved and kept private. Leave this blank to keep it, or type a new one to replace it.'
                        : 'Stored securely and never shown again after you save.'}
                    </FieldDescription>
                  </Field>
                ) : null}

                {authScheme === 'header' ? (
                  <Field>
                    <FieldLabel>Header name</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={headerName}
                          placeholder="X-API-Key"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            setHeaderName(event.target.value);
                          }}
                        />
                      }
                    />
                    <FieldDescription>
                      The exact name the system expects the key under. Their setup guide will say.
                    </FieldDescription>
                  </Field>
                ) : null}
              </FormSection>

              <FormSection
                title="Where the numbers are in the reply"
                description="Tell us which parts of the system’s reply hold the product code and the quantity, so we read the right values."
              >
                <Field>
                  <FieldLabel>Path to the list of items (optional)</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        color="module"
                        value={itemsPath}
                        placeholder="data.items"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => {
                          setItemsPath(event.target.value);
                        }}
                      />
                    }
                  />
                  <FieldDescription>
                    Leave blank if the reply is already the list of items.
                  </FieldDescription>
                </Field>

                <div className="grid gap-3 @md:grid-cols-2">
                  <Field>
                    <FieldLabel>Field with the product code</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={skuField}
                          placeholder="sku"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            setSkuField(event.target.value);
                          }}
                        />
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Field with the quantity</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={quantityField}
                          placeholder="quantity"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            setQuantityField(event.target.value);
                          }}
                        />
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Field with the location (optional)</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={locationField}
                          placeholder="warehouse"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            setLocationField(event.target.value);
                          }}
                        />
                      }
                    />
                    <FieldDescription>
                      Only if the feed splits stock across more than one place.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel>Field with the cost (optional)</FieldLabel>
                    <FieldControl
                      render={
                        <Input
                          color="module"
                          value={costField}
                          placeholder="unit_cost"
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => {
                            setCostField(event.target.value);
                          }}
                        />
                      }
                    />
                  </Field>
                </div>

                {costField.trim() !== '' ? (
                  <Field>
                    <FieldLabel>How the cost is written</FieldLabel>
                    <NativeSelect
                      color="module"
                      value={costUnit}
                      aria-label="How the cost is written"
                      onChange={(event) => {
                        setCostUnit(event.target.value as 'cents' | 'dollars');
                      }}
                    >
                      <option value="dollars">In whole amounts, like 12.50</option>
                      <option value="cents">In smallest units, like 1250</option>
                    </NativeSelect>
                    <FieldDescription>
                      So a cost of “1250” is not mistaken for twelve hundred when it means £12.50.
                    </FieldDescription>
                  </Field>
                ) : null}
              </FormSection>
            </>
          ) : null}

          {type === 'agent' ? (
            <FormSection title="How the bridge connects">
              <Text className="text-sm">
                An on-site bridge is a small program you install on your own computers. It sends
                stock to us whenever something changes — we never reach into your network. After you
                add this, install the bridge and pair it using the code it shows you.
              </Text>
              {source && !source.enrolledAt ? (
                <Alert color="warning" variant="soft">
                  <AlertContent>
                    <AlertTitle>Not paired yet</AlertTitle>
                    <AlertDescription>
                      This source is waiting for its bridge. Install the bridge on your computer and
                      pair it — until then no numbers will arrive.
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}
            </FormSection>
          ) : null}

          {/* ── How often ────────────────────────────────────────────────── */}
          {type === 'agent' ? null : (
            <FormSection title="How often should it update?">
              <Field>
                <FieldLabel>Check for new numbers</FieldLabel>
                <NativeSelect
                  color="module"
                  className="max-w-xs"
                  value={String(interval)}
                  aria-label="How often to check for new numbers"
                  onChange={(event) => {
                    setIntervalSec(Number(event.target.value));
                  }}
                >
                  {SYNC_INTERVALS.map((preset) => (
                    <option key={preset.seconds} value={preset.seconds}>
                      {preset.label}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  How often we fetch on our own. You can always pull the latest at any time with
                  Sync now.
                </FieldDescription>
              </Field>
            </FormSection>
          )}

          {/* ── How it is doing (existing sources only) ───────────────────── */}
          {source ? (
            <FormSection title="How it is doing">
              <div className="flex flex-col gap-1.5">
                <Text className="text-sm">
                  {source.lastSyncAt ? (
                    <>
                      Last updated your stock{' '}
                      <Timestamp value={source.lastSyncAt} format="relative" />.
                    </>
                  ) : (
                    'It has not updated your stock yet.'
                  )}
                </Text>
                {type === 'agent' ? (
                  <Text className="text-sm">
                    {source.enrolledAt
                      ? `Paired${source.apiKeyPrefix ? ` (key ${source.apiKeyPrefix}…)` : ''} · ${
                          agentOnline(source.agentLastSeenAt) ? 'online now' : 'offline'
                        } · last reached us ${relativeTime(source.agentLastSeenAt)}${
                          source.agentVersion ? ` · bridge ${source.agentVersion}` : ''
                        }`
                      : 'Not paired to a bridge yet.'}
                  </Text>
                ) : (
                  <Text className="text-sm">
                    Updates {syncIntervalLabel(source.syncIntervalSec).toLowerCase()}.
                  </Text>
                )}
              </div>
            </FormSection>
          ) : null}

          {/* ── Removing it — a plain row, well away from the everyday save ── */}
          {source ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="flex min-w-0 flex-col">
                <Text className="font-medium">Remove this source</Text>
                <Text className="text-sm">
                  Stops the connection and takes it off your list. Numbers it already brought in
                  stay.
                </Text>
              </div>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                className="shrink-0"
                loading={remove.isPending}
                onClick={() => {
                  void removeSource();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Loading an existing source ──────────────────────────────────────────── */

function ExistingSource({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data, isPending, isFetching, isError, error, refetch } = useInventorySource(id);

  if (isError) {
    const gone = isNotFound(error);
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <Alert color={gone ? 'warning' : 'danger'} variant="soft" className="max-w-md">
            <AlertContent>
              <AlertTitle>
                {gone ? 'This source no longer exists' : 'Could not load this source'}
              </AlertTitle>
              <AlertDescription>
                {gone
                  ? 'It has been removed from your list. Any stock numbers it brought in are unaffected.'
                  : 'This is a problem reaching the server. The connection itself is unaffected.'}
              </AlertDescription>
            </AlertContent>
            {gone ? (
              <Button
                size="sm"
                color="warning"
                variant="soft"
                onClick={() => {
                  ctx.open('inventory.sources', undefined, { target: 'replace' });
                }}
              >
                Back to your sources
              </Button>
            ) : (
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
            )}
          </Alert>
        </div>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className={PANE_SHELL}>
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <SourceEditor
      key={id}
      ctx={ctx}
      source={data}
      isFetching={isFetching}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}

/* ── The surface ─────────────────────────────────────────────────────────── */

export function SourceDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? (
    <SourceEditor ctx={ctx} source={null} />
  ) : (
    <ExistingSource ctx={ctx} id={id} />
  );
}
