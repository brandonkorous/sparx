'use client';

// Connecting a phone system (docs/144 §5.6) — its own pane, opened from the list.
//
// WHY A PANE AND NOT A DIALOG. docs/123 §"Pane or modal?" says a modal must
// clear all four tests, and this clears none: the Account SID and auth token are
// copied out of the phone provider's dashboard in another browser tab, so the
// workbench has to stay put while somebody goes and gets them; a half-entered
// credential is real work to lose; and modal state is invisible to
// `hasUnsavedWork()` — the one place in this app where work can vanish silently.
//
// AND WHY NOT INLINE EITHER, which is what this was. A form parked above the
// list sat permanently on top of the thing people came to look at, pushed the
// list down the page on every visit for the sake of an action taken once, and
// duplicated the empty state underneath itself.
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

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useSites } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { callErrorMessage, isVoiceSetupUnavailable, useConnectPhoneSystem } from './calls-data';
import { productCopy } from '../../lib/product';

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

export function PhoneSystemConnectSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const connect = useConnectPhoneSystem();
  const { data: sites } = useSites();
  const [draft, setDraft] = useState<Draft>(EMPTY);

  useEffect(() => {
    ctx.setTitle('Connect a phone system');
  }, [ctx]);

  const siteList = sites ?? [];

  const touched = draft.accountSid !== '' || draft.authToken !== '' || draft.fromNumber !== '';
  useDirtySource(touched, 'You have a half-finished phone connection.');

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const numberLooksWrong =
    draft.fromNumber.trim() !== '' && !/^\+[1-9]\d{6,14}$/.test(draft.fromNumber.trim());

  const canSubmit =
    draft.accountSid.trim() !== '' &&
    draft.authToken !== '' &&
    draft.fromNumber.trim() !== '' &&
    !numberLooksWrong &&
    !connect.isPending;

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
          // Clear the draft BEFORE closing so the dirty guard does not stop the
          // close on work that has just been committed.
          setDraft(EMPTY);
          toast.add({
            title: 'Phone system connected',
            description: 'The Call button now appears on your customers’ records.',
            type: 'success',
          });
          ctx.close();
        },
        onError: (err: unknown) => {
          toast.add({
            title: 'Could not connect that phone system',
            description: isVoiceSetupUnavailable(err)
              ? productCopy(
                  'crm.phone.disabled',
                  'Connecting a phone system is not switched on for this business yet. Get in touch and we will turn it on for you.'
                )
              : callErrorMessage(err, 'Check the account details and the number, then try again.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Phone system connection actions">
        <Button color="module" size="sm" disabled={!canSubmit} onClick={submit}>
          {connect.isPending ? 'Connecting…' : 'Connect phone system'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Card className="p-4">
          <Heading level={2} className="text-lg">
            Connect a phone system
          </Heading>
          <Text className="mt-1">
            {productCopy(
              'crm.phone.connectIntro',
              'Piggles rings your own phone first, and when you pick up it dials the customer and joins the two of you. So the call happens on a real handset with a real signal — and Piggles still records who was called, when, and for how long.'
            )}
          </Text>

          {/* The credentials belong to the BUSINESS, not to sparx. Said up
              front, because handing over an auth token is the moment someone
              wants to know who is paying and who can see it. */}
          <Alert color="info" variant="soft" className="mt-4">
            {productCopy(
              'crm.phone.ownAccount',
              'You connect your own phone account, so the calls are billed to you at your own rates and the number stays yours. Piggles encrypts the token and never shows it again.'
            )}
          </Alert>

          <div className="mt-4 grid gap-4 @2xl:grid-cols-2">
            <Field className="@2xl:col-span-2">
              <FieldLabel>The number customers see when you call</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    type="tel"
                    aria-label="The number customers see when you call"
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
                    color="module"
                    aria-label="Account SID"
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
                    color="module"
                    type="password"
                    aria-label="Auth token"
                    autoComplete="new-password"
                    value={draft.authToken}
                    onChange={(event) => {
                      set('authToken', event.currentTarget.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                Next to the Account SID, behind a “show” link. This one IS a secret — treat it like
                a password.
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
                      color="module"
                      aria-label="Which business calls from this number?"
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
              : productCopy(
                  'crm.phone.recording',
                  'Calls are not recorded. Piggles still logs who was called, when, and for how long.'
                )}
          </Alert>
        </Card>
      </div>
    </div>
  );
}
