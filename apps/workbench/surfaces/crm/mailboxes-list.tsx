'use client';

// Connected mailboxes (docs/144 §5.2) — the email accounts sparx reads from and
// sends through.
//
// THE THING THIS SURFACE HAS TO GET RIGHT is that the person doing it has never
// heard of IMAP. They know their email address and they know their password,
// and both of those facts are traps: the server names are not guessable, and
// their normal password will be rejected by every provider that has two-factor
// authentication switched on. So the form leads with "who is your email with",
// fills the technical boxes from that, and says in plain words where to find an
// app password for that specific provider.
//
// It is a PANE, not a modal: connecting a mailbox is minutes of work with
// values fetched from another browser tab, and a modal is invisible to the
// unsaved-work guard (apps/workbench/CLAUDE.md).

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  NativeSelect,
  Table,
  useToast,
} from '@wizeworks/silicaui-react';
import { Mailbox, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import {
  describeLastSync,
  isModuleDisabled,
  mailboxErrorMessage,
  MAIL_PRESETS,
  statusLabel,
  statusTone,
  useConnectMailbox,
  useDisconnectMailbox,
  useMailboxes,
  useSyncMailbox,
  type MailPreset,
} from './mailboxes-data';

interface Draft {
  presetId: string;
  emailAddress: string;
  appPassword: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  scope: 'personal' | 'shared';
}

function draftFor(preset: MailPreset): Draft {
  return {
    presetId: preset.id,
    emailAddress: '',
    appPassword: '',
    displayName: '',
    imapHost: preset.imapHost,
    imapPort: preset.imapPort,
    smtpHost: preset.smtpHost,
    smtpPort: preset.smtpPort,
    scope: 'personal',
  };
}

const DEFAULT_PRESET = MAIL_PRESETS[0]!;
const EMPTY = draftFor(DEFAULT_PRESET);

export function MailboxesListSurface() {
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const { data, error, isPending, isError, isFetching, dataUpdatedAt, refetch } = useMailboxes();
  const connect = useConnectMailbox();
  const disconnect = useDisconnectMailbox();
  const sync = useSyncMailbox();

  const rows = data?.items ?? [];
  const moduleOff = isModuleDisabled(error);
  const preset = MAIL_PRESETS.find((p) => p.id === draft.presetId) ?? DEFAULT_PRESET;

  // A half-typed password is real work: closing the pane loses it, so the pane
  // has to say so before it goes.
  const touched =
    adding && (draft.emailAddress !== '' || draft.appPassword !== '' || draft.displayName !== '');
  useDirtySource(touched, 'You have a half-finished mailbox connection.');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const choosePreset = (id: string) => {
    const chosen = MAIL_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
    // Keep what the person has already typed; replace only what the provider
    // determines. Re-blanking their address because they changed provider is
    // the kind of thing that makes someone give up on a form.
    setDraft((previous) => ({
      ...previous,
      presetId: chosen.id,
      imapHost: chosen.imapHost,
      imapPort: chosen.imapPort,
      smtpHost: chosen.smtpHost,
      smtpPort: chosen.smtpPort,
    }));
  };

  const submit = () => {
    connect.mutate(
      {
        emailAddress: draft.emailAddress.trim(),
        appPassword: draft.appPassword,
        imapHost: draft.imapHost.trim(),
        imapPort: draft.imapPort,
        smtpHost: draft.smtpHost.trim(),
        smtpPort: draft.smtpPort,
        scope: draft.scope,
        displayName: draft.displayName.trim() === '' ? null : draft.displayName.trim(),
      },
      {
        onSuccess: () => {
          setDraft(EMPTY);
          setAdding(false);
          toast.add({
            title: 'Mailbox connected',
            description: 'New email will start appearing on your customers’ records.',
            type: 'success',
          });
        },
        onError: (err: unknown) => {
          toast.add({
            title: 'Could not connect that mailbox',
            description: mailboxErrorMessage(
              err,
              'Check the address and the app password, then try again.'
            ),
            type: 'error',
          });
        },
      }
    );
  };

  const runSync = (id: string) => {
    sync.mutate(id, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast.add({
            title: 'Could not check that mailbox',
            description: result.error ?? 'Try again in a moment.',
            type: 'error',
          });
          return;
        }
        toast.add({
          title:
            result.stored === 0
              ? 'Nothing new from anyone on your list'
              : `${String(result.stored)} new ${result.stored === 1 ? 'message' : 'messages'} added`,
          type: 'success',
        });
      },
      onError: (err: unknown) => {
        toast.add({
          title: 'Could not check that mailbox',
          description: mailboxErrorMessage(err, 'Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };

  const remove = async (id: string, address: string) => {
    const ok = await confirm({
      title: `Disconnect ${address}?`,
      description:
        'sparx stops reading new email from this mailbox and stops sending through it. The conversations already on your customers’ records are kept — disconnecting a mailbox has never meant deleting a year of correspondence.',
      confirmLabel: 'Disconnect it',
      cancelLabel: 'Keep it connected',
      color: 'danger',
    });
    if (!ok) return;
    disconnect.mutate(id, {
      onSuccess: () => {
        toast.add({ title: 'Mailbox disconnected', type: 'success' });
      },
      onError: () => {
        toast.add({ title: 'Could not disconnect that mailbox', type: 'error' });
      },
    });
  };

  const canSubmit =
    draft.emailAddress.trim() !== '' &&
    draft.appPassword !== '' &&
    draft.imapHost.trim() !== '' &&
    draft.smtpHost.trim() !== '' &&
    !connect.isPending;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Mailbox controls">
        <Button
          color="module"
          size="sm"
          onClick={() => {
            setAdding((v) => !v);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {adding ? 'Cancel' : 'Connect a mailbox'}
        </Button>
        <RefreshButton
          className="ml-auto"
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {adding ? (
          <Card className="shrink-0 p-4">
            <h3 className="text-lg font-semibold">Connect a mailbox</h3>
            <p className="mt-1 text-sm">
              sparx will read new email from this account and show it on the matching customer’s
              record, and send your replies from this address.
            </p>

            <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
              <Field>
                <FieldLabel>Who is your email with?</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={draft.presetId}
                      onChange={(event) => {
                        choosePreset(event.currentTarget.value);
                      }}
                    >
                      {MAIL_PRESETS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
                <FieldDescription>
                  This fills in the technical settings below so you do not have to look them up.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Email address</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="you@yourbusiness.com"
                      value={draft.emailAddress}
                      onChange={(event) => {
                        set('emailAddress', event.currentTarget.value);
                      }}
                    />
                  }
                />
              </Field>

              <Field className="@2xl:col-span-2">
                <FieldLabel>App password</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={draft.appPassword}
                      onChange={(event) => {
                        set('appPassword', event.currentTarget.value);
                      }}
                    />
                  }
                />
                {/* The single most common reason this form fails, said before
                    they try it rather than after it is rejected. */}
                <FieldDescription>{preset.appPasswordHint}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Name recipients see</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      placeholder="Dana Reed"
                      value={draft.displayName}
                      onChange={(event) => {
                        set('displayName', event.currentTarget.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Optional. Shown instead of the bare address in the customer’s inbox.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Whose mailbox is this?</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={draft.scope}
                      onChange={(event) => {
                        set('scope', event.currentTarget.value as 'personal' | 'shared');
                      }}
                    >
                      <option value="personal">Mine — my own work email</option>
                      <option value="shared">
                        A shared address the team uses (sales@, support@)
                      </option>
                    </NativeSelect>
                  }
                />
              </Field>
            </div>

            {/* THE PRIVACY PROMISE, made before the credential is handed over
                rather than buried in a settings page afterwards. It is also the
                literal behaviour of the sync — see syncGateFor(). */}
            <Alert
              color={draft.scope === 'personal' ? 'info' : 'warning'}
              variant="soft"
              className="mt-4"
            >
              {draft.scope === 'personal'
                ? 'Because this is your own mailbox, sparx keeps only the messages to and from people already on your customer list. Everything else is discarded as it is read — never saved, never searchable, never visible to your team.'
                : 'A shared address is meant to receive mail from people you have not met, so sparx keeps everything that arrives here — including messages from strangers. Do not connect a personal mailbox this way.'}
            </Alert>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">
                Server settings (already filled in)
              </summary>
              <div className="mt-3 grid gap-4 @2xl:grid-cols-2">
                <Field>
                  <FieldLabel>Incoming mail server</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        value={draft.imapHost}
                        onChange={(event) => {
                          set('imapHost', event.currentTarget.value);
                        }}
                      />
                    }
                  />
                  {draft.imapHost.includes('://') ? (
                    <FieldError>Just the server name — no https:// in front.</FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel>Outgoing mail server</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        value={draft.smtpHost}
                        onChange={(event) => {
                          set('smtpHost', event.currentTarget.value);
                        }}
                      />
                    }
                  />
                </Field>
              </div>
            </details>

            <div className="mt-4 flex items-center gap-2">
              <Button color="module" disabled={!canSubmit} onClick={submit}>
                {connect.isPending ? 'Checking…' : 'Connect mailbox'}
              </Button>
              <Button
                color="neutral"
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY);
                  setAdding(false);
                }}
              >
                Cancel
              </Button>
              <p className="text-sm">sparx signs in once now to make sure it works.</p>
            </div>
          </Card>
        ) : null}

        <Card className="min-h-0 flex-1">
          {moduleOff ? (
            <EmptyState
              icon={<Mailbox className="size-6" aria-hidden />}
              title="Turn on Customers to connect a mailbox"
              description="Connecting a mailbox puts the emails you exchange with a customer onto their record, so anyone on your team can see the conversation."
            />
          ) : isError ? (
            <EmptyState
              icon={<Mailbox className="size-6" aria-hidden />}
              title="Could not load your mailboxes"
              description="Something went wrong reaching the server. It may be temporary — try again in a moment."
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    void refetch();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : isPending ? (
            <p className="p-4 text-sm" role="status">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Mailbox className="size-6" aria-hidden />}
              title="No mailbox connected yet"
              description="Connect the email account you write to customers from. Their replies will appear on their record, so the next person to pick up the conversation can see what was already said."
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  Connect a mailbox
                </Button>
              }
            />
          ) : (
            <Table size="sm">
              <thead>
                <tr>
                  <th>Mailbox</th>
                  <th>Used by</th>
                  <th>State</th>
                  <th className="hidden @lg:table-cell">Last checked</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">
                      {row.emailAddress}
                      {row.displayName ? (
                        <span className="block text-sm font-normal">{row.displayName}</span>
                      ) : null}
                    </td>
                    <td>
                      {/* Personal vs shared is a privacy boundary, not a
                          preference, so it wears a real colour. */}
                      <Badge
                        color={row.scope === 'shared' ? 'warning' : 'module'}
                        variant="soft"
                        size="sm"
                      >
                        {row.scope === 'shared' ? 'Whole team' : 'One person'}
                      </Badge>
                      <span className="mt-1 block text-xs">
                        {row.syncGate === 'known_contacts_only'
                          ? 'Keeps only known contacts'
                          : 'Keeps everything'}
                      </span>
                    </td>
                    <td>
                      <Badge color={statusTone(row.status)} variant="soft" size="sm">
                        {statusLabel(row.status)}
                      </Badge>
                      {row.lastError ? (
                        <span className="mt-1 block text-xs">{row.lastError}</span>
                      ) : null}
                    </td>
                    <td className="hidden text-sm @lg:table-cell">
                      {describeLastSync(row.lastSyncedAt)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          color="module"
                          variant="ghost"
                          title="Check for new mail now"
                          disabled={sync.isPending}
                          onClick={() => {
                            runSync(row.id);
                          }}
                        >
                          <RefreshCw className="size-4" aria-hidden />
                          <span className="sr-only">Check for new mail</span>
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="ghost"
                          title="Disconnect this mailbox"
                          onClick={() => {
                            void remove(row.id, row.emailAddress);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">Disconnect</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <p className="shrink-0 px-1 text-xs">
        sparx checks connected mailboxes every few minutes. Use the refresh button on a row to check
        one right now.
      </p>
    </div>
  );
}
