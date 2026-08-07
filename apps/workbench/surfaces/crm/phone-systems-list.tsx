'use client';

// Connected phone systems (docs/144 §5.6) — the account sparx places calls
// through, and the number customers see ring.
//
// THE THING THIS SURFACE HAS TO GET RIGHT is that the person doing it has never
// heard of an "Account SID". They have a phone number and a login to a phone
// company, and everything else is jargon standing between them and a working
// Call button. So the form says where each value is found, in that vendor's own
// words, before it is asked for.
//
// TWO DECISIONS ARE LOAD-BEARING AND BOTH ARE ABOUT CONSEQUENCE:
//
//   • WHICH SITE. A tenant can run two unrelated businesses under one account.
//     Calling a customer of one from the other's number reaches them as a
//     business they have never heard of, so the site is asked for rather than
//     assumed — and "every site" is a real answer for a business with one line.
//
//   • RECORDING IS OFF, and turning it on is a legal decision, not a preference:
//     one-party and two-party consent states differ, and the EU differs again. A
//     platform that defaulted it on would hand a business a problem it never
//     agreed to. So it is opt-in, and it says why.
//
// It is a PANE, not a modal: connecting is minutes of work with values fetched
// from another browser tab, and a modal is invisible to the unsaved-work guard
// (apps/workbench/CLAUDE.md).

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
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
import { Phone, PhoneCall, Plus, Trash2 } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useSites } from '../../lib/api/shell-data';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import {
  callErrorMessage,
  isModuleDisabled,
  isVoiceForbidden,
  isVoiceSetupUnavailable,
  useConnectPhoneSystem,
  useDisconnectPhoneSystem,
  useVoiceConnections,
  voiceStatusLabel,
  voiceStatusTone,
} from './calls-data';

/** Every site, or one. `''` is "every site" — the value the API stores as null. */
const ALL_SITES = '';

interface Draft {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  propertyId: string;
  recordingEnabled: boolean;
}

const EMPTY: Draft = {
  accountSid: '',
  authToken: '',
  fromNumber: '',
  propertyId: ALL_SITES,
  recordingEnabled: false,
};

export function PhoneSystemsListSurface() {
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const { data, error, isPending, isError, isFetching, dataUpdatedAt, refetch } =
    useVoiceConnections();
  const { data: sites } = useSites();
  const connect = useConnectPhoneSystem();
  const disconnect = useDisconnectPhoneSystem();

  const rows = data?.items ?? [];
  const moduleOff = isModuleDisabled(error);
  // Only an admin may read or write these, and a rep who opens the surface
  // should be told that plainly rather than shown an empty table.
  const forbidden = isVoiceForbidden(error);
  const siteList = sites ?? [];

  const touched =
    adding && (draft.accountSid !== '' || draft.authToken !== '' || draft.fromNumber !== '');
  useDirtySource(touched, 'You have a half-finished phone connection.');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const siteName = (propertyId: string | null): string => {
    if (!propertyId) return 'Every site';
    return siteList.find((site) => site.id === propertyId)?.name ?? 'One site';
  };

  const submit = () => {
    connect.mutate(
      {
        provider: 'twilio',
        accountSid: draft.accountSid.trim(),
        authToken: draft.authToken,
        fromNumber: draft.fromNumber.trim(),
        propertyId: draft.propertyId === ALL_SITES ? null : draft.propertyId,
        recordingEnabled: draft.recordingEnabled,
      },
      {
        onSuccess: () => {
          setDraft(EMPTY);
          setAdding(false);
          toast.add({
            title: 'Phone system connected',
            description: 'The Call button now appears on your customers’ records.',
            type: 'success',
          });
        },
        onError: (err: unknown) => {
          toast.add({
            title: 'Could not connect that phone system',
            description: isVoiceSetupUnavailable(err)
              ? 'Connecting a phone system is not switched on for this deployment yet. Your sparx administrator needs to enable it.'
              : callErrorMessage(err, 'Check the account details and the number, then try again.'),
            type: 'error',
          });
        },
      }
    );
  };

  const remove = async (id: string, fromNumber: string) => {
    const ok = await confirm({
      title: `Disconnect ${fromNumber}?`,
      description:
        'sparx stops placing calls through this account. The calls already logged on your customers’ records are kept — disconnecting has never meant deleting your call history.',
      confirmLabel: 'Disconnect it',
      cancelLabel: 'Keep it connected',
      color: 'danger',
    });
    if (!ok) return;
    disconnect.mutate(id, {
      onSuccess: () => {
        toast.add({ title: 'Phone system disconnected', type: 'success' });
      },
      onError: () => {
        toast.add({ title: 'Could not disconnect that phone system', type: 'error' });
      },
    });
  };

  const numberLooksWrong =
    draft.fromNumber.trim() !== '' && !/^\+[1-9]\d{6,14}$/.test(draft.fromNumber.trim());

  const canSubmit =
    draft.accountSid.trim() !== '' &&
    draft.authToken !== '' &&
    draft.fromNumber.trim() !== '' &&
    !numberLooksWrong &&
    !connect.isPending;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Phone system controls">
        <Button
          color="module"
          size="sm"
          disabled={forbidden || moduleOff}
          onClick={() => {
            setAdding((v) => !v);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {adding ? 'Cancel' : 'Connect a phone system'}
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
            <h3 className="text-lg font-semibold">Connect a phone system</h3>
            <p className="mt-1 text-sm">
              sparx rings your own phone first, and when you pick up it dials the customer and joins
              the two of you. So the call happens on a real handset with a real signal — and sparx
              still records who was called, when, and for how long.
            </p>

            {/* The credentials belong to the BUSINESS, not to sparx. Said up
                front, because handing over an auth token is the moment someone
                wants to know who is paying and who can see it. */}
            <Alert color="info" variant="soft" className="mt-4">
              You connect your own phone account, so the calls are billed to you at your own rates
              and the number stays yours. sparx encrypts the token and never shows it again.
            </Alert>

            <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
              <Field className="@2xl:col-span-2">
                <FieldLabel>The number customers see when you call</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      type="tel"
                      placeholder="+15550100000"
                      value={draft.fromNumber}
                      onChange={(event) => {
                        set('fromNumber', event.currentTarget.value);
                      }}
                    />
                  }
                />
                {numberLooksWrong ? (
                  <FieldError>
                    Include the country code and no spaces — a US number looks like +15550100000.
                  </FieldError>
                ) : (
                  <FieldDescription>
                    One of the numbers on your phone account, with its country code.
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel>Account SID</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      autoComplete="off"
                      placeholder="AC…"
                      value={draft.accountSid}
                      onChange={(event) => {
                        set('accountSid', event.currentTarget.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  On your phone provider’s dashboard home page, in the account panel. It starts with
                  “AC” and is not a secret.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Auth token</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={draft.authToken}
                      onChange={(event) => {
                        set('authToken', event.currentTarget.value);
                      }}
                    />
                  }
                />
                <FieldDescription>
                  Next to the Account SID, behind a “show” link. This one IS a secret — treat it
                  like a password.
                </FieldDescription>
              </Field>

              {/* Only worth asking when there is more than one answer. A
                  single-site business should not have to think about it. */}
              {siteList.length > 1 ? (
                <Field className="@2xl:col-span-2">
                  <FieldLabel>Which business calls from this number?</FieldLabel>
                  <FieldControl
                    render={
                      <NativeSelect
                        value={draft.propertyId}
                        onChange={(event) => {
                          set('propertyId', event.currentTarget.value);
                        }}
                      >
                        <option value={ALL_SITES}>Every site — this is my only phone line</option>
                        {siteList.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </NativeSelect>
                    }
                  />
                  <FieldDescription>
                    Customers of a site with its own number are always called from that number. Pick
                    “every site” for a line the whole business shares.
                  </FieldDescription>
                </Field>
              ) : null}
            </div>

            {/* RECORDING IS A LEGAL DECISION. Off by default, and the reason is
                stated rather than left for someone to discover in court. */}
            <div className="mt-4">
              {/* Amber on the control itself, not only on the note below it:
                  switching this on is the consequential choice on this form. */}
              <Checkbox
                color="warning"
                checked={draft.recordingEnabled}
                onChange={(event) => {
                  set('recordingEnabled', event.currentTarget.checked);
                }}
              >
                Record these calls
              </Checkbox>
            </div>
            <Alert
              color={draft.recordingEnabled ? 'warning' : 'neutral'}
              variant="soft"
              className="mt-2"
            >
              {draft.recordingEnabled
                ? 'Recording calls is regulated, and the rules differ by where you and the customer each are — some places require you to tell them, others require their agreement first. Check what applies to you before you switch this on.'
                : 'Calls are not recorded. sparx still logs who was called, when, and for how long.'}
            </Alert>

            <div className="mt-4 flex items-center gap-2">
              <Button color="module" disabled={!canSubmit} onClick={submit}>
                {connect.isPending ? 'Connecting…' : 'Connect phone system'}
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
            </div>
          </Card>
        ) : null}

        <Card className="min-h-0 flex-1">
          {moduleOff ? (
            <EmptyState
              icon={<PhoneCall className="size-6" aria-hidden />}
              title="Turn on Customers to connect a phone system"
              description="Connecting a phone system puts a Call button on every customer’s record, and writes each call onto their history without anyone having to remember to log it."
            />
          ) : forbidden ? (
            <EmptyState
              icon={<PhoneCall className="size-6" aria-hidden />}
              title="Only an owner or admin can set this up"
              description="Connecting a phone system means handing over an account token, so it is kept to the people who run the account. Ask one of them to connect it — once it is done, everyone on your team gets the Call button."
            />
          ) : isError ? (
            <EmptyState
              icon={<PhoneCall className="size-6" aria-hidden />}
              title="Could not load your phone systems"
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
              icon={<PhoneCall className="size-6" aria-hidden />}
              title="No phone system connected yet"
              description="Connect your phone account and a Call button appears on every customer’s record. sparx rings you first, then dials them and joins the two of you — so the call is logged without anyone writing it down afterwards."
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    setAdding(true);
                  }}
                >
                  Connect a phone system
                </Button>
              }
            />
          ) : (
            <Table size="sm">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Used by</th>
                  <th>State</th>
                  <th className="hidden @lg:table-cell">Recording</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">
                      {row.fromNumber}
                      <span className="block text-sm font-normal">{row.accountSid}</span>
                    </td>
                    <td>
                      {/* Which business this number speaks for — the thing that
                          decides who gets called from it. */}
                      <Badge color={row.propertyId ? 'module' : 'info'} variant="soft" size="sm">
                        {siteName(row.propertyId)}
                      </Badge>
                    </td>
                    <td>
                      <Badge color={voiceStatusTone(row.status)} variant="soft" size="sm">
                        {voiceStatusLabel(row.status)}
                      </Badge>
                      {row.lastError ? (
                        <span className="mt-1 block text-xs">{row.lastError}</span>
                      ) : null}
                    </td>
                    <td className="hidden @lg:table-cell">
                      {/* A legal posture, not a setting — so it reads as one. */}
                      <Badge
                        color={row.recordingEnabled ? 'warning' : 'neutral'}
                        variant="soft"
                        size="sm"
                      >
                        {row.recordingEnabled ? 'Recording on' : 'Not recording'}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          color="danger"
                          variant="ghost"
                          title="Disconnect this phone system"
                          onClick={() => {
                            void remove(row.id, row.fromNumber);
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
        <Phone className="mr-1 inline size-3" aria-hidden />
        To change the token on a connected number, disconnect it and connect it again — sparx never
        shows a token back, so there is nothing to edit in place.
      </p>
    </div>
  );
}
