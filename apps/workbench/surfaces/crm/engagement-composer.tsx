'use client';

// The engagement composer (docs/144 §5.5) — one control at the top of a record's
// timeline that switches between email, call, note.
//
// WHY ONE CONTROL AND NOT THREE BUTTONS: logging what just happened has to be
// cheaper than not logging it. A rep who has just put the phone down will type
// two sentences into a box that is already in front of them; they will not
// navigate to an "Add activity" screen, choose a type from a dropdown and fill
// in a form. Everything a CRM knows about its customers is downstream of that
// one interaction being frictionless, which is why it sits at the TOP of the
// timeline rather than behind a button.
//
// The tabs are `<Tabs variant="pills">` — a filled shape says which mode you are
// in faster than an underline can be read (DESIGN.md RULE #4), and the mode
// decides what the Send button does, so it must never be ambiguous.

import { useMemo, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import { Mail, Phone, PhoneCall, Send, StickyNote } from 'lucide-react';
import { useActiveSiteId } from '../../lib/api/shell-data';
import { useDirtySource } from '../../lib/workbench/dirty';
import {
  callErrorMessage,
  rememberDeviceNumber,
  rememberedDeviceNumber,
  usePlaceCall,
  useVoiceConnections,
} from './calls-data';
import {
  engagementErrorMessage,
  OUTCOME_LABELS,
  useLogCall,
  useLogNote,
  useSalesSnippets,
  useSalesTemplates,
  useSendableMailboxes,
  useSendEngagementEmail,
  type CallOutcome,
} from './engagement-data';

const MODES = [
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'call', label: 'Log a call', icon: Phone },
] as const;

type Mode = (typeof MODES)[number]['value'];

export interface EngagementComposerProps {
  customerId: string;
  /** When the record being viewed is a deal, so what is said is filed against
   *  it as well as against the person. */
  dealId?: string | null;
  /**
   * When the record being viewed is a support request (docs/144 §7).
   *
   * NOT decoration: an outbound message on a request's thread is what records
   * the FIRST RESPONSE, which is half of what the support clock measures.
   * Without this the reply is filed against the person and the request stays
   * marked as unanswered — so the queue would show a request somebody replied
   * to twenty minutes ago going red.
   */
  ticketId?: string | null;
  /** Whether this person has an email address at all — the Email tab is not
   *  offered without one, rather than offered and then refused. */
  canEmail?: boolean;
}

export function EngagementComposer({
  customerId,
  dealId,
  ticketId,
  canEmail,
}: EngagementComposerProps) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('note');

  const [note, setNote] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mailboxId, setMailboxId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [outcome, setOutcome] = useState<CallOutcome>('connected');
  const [minutes, setMinutes] = useState('');
  const [deviceNumber, setDeviceNumber] = useState(rememberedDeviceNumber);

  const { data: mailboxData } = useSendableMailboxes();
  const { data: templateData } = useSalesTemplates();
  const { data: snippetData } = useSalesSnippets();

  const { data: voiceData } = useVoiceConnections();
  const { data: siteState } = useActiveSiteId();
  const activeSiteId = siteState?.propertyId ?? null;
  const placeCall = usePlaceCall();

  const sendEmail = useSendEngagementEmail();
  const logCall = useLogCall();
  const logNote = useLogNote();

  // Click-to-call is offered only when a phone system is actually connected FOR
  // THIS SITE — mirroring how the server resolves one: the site's own phone
  // system, falling back to a tenant-wide one. A tenant whose only connection
  // belongs to a different business would otherwise be shown a button that
  // always fails, which is worse than no button.
  //
  // A rep without admin rights gets a 403 on the voice list and so gets no
  // button either, rather than an error.
  const canDial = (voiceData?.items ?? []).some(
    (entry) =>
      entry.status === 'active' && (entry.propertyId === null || entry.propertyId === activeSiteId)
  );

  const busy = sendEmail.isPending || logCall.isPending || logNote.isPending;

  const modes = useMemo(
    () => MODES.filter((entry) => entry.value !== 'email' || canEmail !== false),
    [canEmail]
  );

  // Half a typed email is real work. Without this the pane closes and it is gone
  // — the exact case the workbench's unsaved-work guard exists for.
  const hasWork =
    (mode === 'note' && note.trim() !== '') ||
    (mode === 'email' && (subject.trim() !== '' || body.trim() !== '')) ||
    (mode === 'call' && note.trim() !== '');
  useDirtySource(hasWork, 'You have something written here that has not been saved. Close anyway?');

  const reset = () => {
    setNote('');
    setSubject('');
    setBody('');
    setTemplateId('');
    setMinutes('');
  };

  /**
   * Ring the rep, then bridge to the customer.
   *
   * The number they are sitting at is remembered in the browser rather than on
   * their user record: it changes between the office, a mobile and home, and a
   * stored value would confidently ring the wrong phone next week.
   */
  const dial = () => {
    const trimmed = deviceNumber.trim();
    if (trimmed === '') return;
    rememberDeviceNumber(trimmed);
    placeCall.mutate(
      { customerId, dealId: dealId ?? null, fromDeviceNumber: trimmed },
      {
        onSuccess: (result) => {
          if (!result.placed) {
            toast.add({
              title: 'Could not place the call',
              description: result.error ?? 'Your phone system refused it. Try dialling directly.',
              type: 'error',
            });
            return;
          }
          toast.add({
            title: 'Calling you now',
            description: 'Pick up and sparx will dial them and join you.',
            type: 'success',
          });
          // Pre-select the outcome people log most, so hanging up and writing
          // one line is the whole of the remaining work.
          setOutcome('connected');
        },
        onError: (err: unknown) => {
          toast.add({
            title: 'Could not place the call',
            description: callErrorMessage(err, 'Something went wrong reaching the phone system.'),
            type: 'error',
          });
        },
      }
    );
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templateData?.items.find((entry) => entry.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.bodyHtml);
  };

  const submit = async () => {
    try {
      if (mode === 'note') {
        await logNote.mutateAsync({ customerId, dealId, ticketId, body: note.trim() });
        toast.add({ title: 'Note saved', type: 'success' });
      } else if (mode === 'call') {
        await logCall.mutateAsync({
          customerId,
          dealId,
          ticketId,
          direction,
          outcome,
          ...(minutes.trim() !== '' ? { durationSec: Math.round(Number(minutes) * 60) } : {}),
          ...(note.trim() !== '' ? { notes: note.trim() } : {}),
        });
        toast.add({ title: 'Call logged', type: 'success' });
      } else {
        await sendEmail.mutateAsync({
          customerId,
          dealId,
          ticketId,
          subject: subject.trim(),
          bodyHtml: body,
          ...(mailboxId !== '' ? { mailboxConnectionId: mailboxId } : {}),
          ...(templateId !== '' ? { templateId } : {}),
        });
        toast.add({ title: 'Email sent', type: 'success' });
      }
      reset();
    } catch (error) {
      toast.add({
        title: mode === 'email' ? 'Could not send that' : 'Could not save that',
        description: engagementErrorMessage(
          error,
          'Something went wrong reaching the server. Nothing has been changed.'
        ),
        type: 'error',
      });
    }
  };

  const blocked =
    mode === 'email' ? subject.trim() === '' || body.trim() === '' : note.trim() === '';

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
      <Tabs
        variant="pills"
        color="module"
        value={mode}
        onValueChange={(next: unknown) => {
          setMode(next as Mode);
        }}
      >
        <TabsList>
          {modes.map((entry) => (
            <TabsTab key={entry.value} value={entry.value}>
              <entry.icon className="size-4" aria-hidden />
              {entry.label}
            </TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="note">
          <Field>
            <FieldLabel>What is worth remembering</FieldLabel>
            <FieldControl
              render={
                <Textarea
                  color="module"
                  rows={3}
                  value={note}
                  placeholder="Prefers to be called after 4pm. Mentioned they are reviewing two other quotes."
                  onChange={(event) => {
                    setNote(event.target.value);
                  }}
                />
              }
            />
            <FieldDescription>
              Only your team sees this. It goes on their timeline with everything else.
            </FieldDescription>
          </Field>
        </TabsPanel>

        <TabsPanel value="email">
          <div className="flex flex-col gap-3">
            {(templateData?.items.length ?? 0) > 0 ? (
              <Field>
                <FieldLabel>Start from something you have written before</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={templateId}
                      onChange={(event) => {
                        applyTemplate(event.target.value);
                      }}
                    >
                      <option value="">Write it from scratch</option>
                      {templateData?.items.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.sendCount > 0 ? ` · sent ${String(template.sendCount)}×` : ''}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
              </Field>
            ) : null}

            {(mailboxData?.items.length ?? 0) > 0 ? (
              <Field>
                <FieldLabel>Send it from</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={mailboxId}
                      onChange={(event) => {
                        setMailboxId(event.target.value);
                      }}
                    >
                      <option value="">Your business address</option>
                      {mailboxData?.items.map((mailbox) => (
                        <option key={mailbox.id} value={mailbox.id}>
                          {mailbox.emailAddress}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
                <FieldDescription>
                  Sending from a connected mailbox puts a copy in its Sent folder, so replies come
                  back where you expect them.
                </FieldDescription>
              </Field>
            ) : null}

            <Field>
              <FieldLabel>Subject</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={subject}
                    placeholder="Following up on your quote"
                    onChange={(event) => {
                      setSubject(event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <Field>
              <FieldLabel>Message</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={6}
                    value={body}
                    placeholder="Hi — just checking whether you had a chance to look at the numbers."
                    onChange={(event) => {
                      setBody(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                {(snippetData?.items.length ?? 0) > 0
                  ? `Shortcuts you have saved: ${snippetData?.items
                      .slice(0, 4)
                      .map((snippet) => snippet.shortcut)
                      .join(', ')}`
                  : 'It goes to the address on their record, so it cannot reach the wrong person.'}
              </FieldDescription>
            </Field>
          </div>
        </TabsPanel>

        <TabsPanel value="call">
          <div className="flex flex-col gap-3">
            {/* CLICK TO CALL, above the log form rather than beside it: the
                common order is call THEN write, and putting the dial control
                under the notes box would have someone scroll past the thing
                they came here to do. Offered only when a phone system is
                actually connected — a button that always fails is worse than
                no button. */}
            {canDial ? (
              <div className="border-base-300 flex flex-wrap items-end gap-3 rounded-lg border p-3">
                <Field className="min-w-56 flex-1">
                  <FieldLabel>Ring me on</FieldLabel>
                  <FieldControl
                    render={
                      <Input
                        color="module"
                        type="tel"
                        value={deviceNumber}
                        placeholder="(555) 010-9999"
                        onChange={(event) => {
                          setDeviceNumber(event.target.value);
                        }}
                      />
                    }
                  />
                  <FieldDescription>
                    sparx rings this phone first, then dials them and joins the two.
                  </FieldDescription>
                </Field>
                <Button
                  size="sm"
                  color="success"
                  loading={placeCall.isPending}
                  disabled={deviceNumber.trim() === ''}
                  onClick={() => {
                    dial();
                  }}
                >
                  <PhoneCall className="size-4" aria-hidden />
                  Call them now
                </Button>
              </div>
            ) : null}

            <div className="grid gap-3 @md:grid-cols-3">
              <Field>
                <FieldLabel>Which way</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={direction}
                      onChange={(event) => {
                        setDirection(event.target.value as 'in' | 'out');
                      }}
                    >
                      <option value="out">I called them</option>
                      <option value="in">They called me</option>
                    </NativeSelect>
                  }
                />
              </Field>
              <Field>
                <FieldLabel>How it went</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect
                      value={outcome}
                      onChange={(event) => {
                        setOutcome(event.target.value as CallOutcome);
                      }}
                    >
                      {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </NativeSelect>
                  }
                />
              </Field>
              <Field>
                <FieldLabel>How long, in minutes</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={0}
                      value={minutes}
                      placeholder="Optional"
                      onChange={(event) => {
                        setMinutes(event.target.value);
                      }}
                    />
                  }
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>What was said</FieldLabel>
              <FieldControl
                render={
                  <Textarea
                    color="module"
                    rows={3}
                    value={note}
                    placeholder="Walked through pricing. Wants it in writing before Friday."
                    onChange={(event) => {
                      setNote(event.target.value);
                    }}
                  />
                }
              />
              <FieldDescription>
                The whole reason for logging it. Even one line is worth more than nothing in six
                months.
              </FieldDescription>
            </Field>
          </div>
        </TabsPanel>
      </Tabs>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          color="module"
          loading={busy}
          disabled={blocked}
          onClick={() => void submit()}
        >
          <Send className="size-4" aria-hidden />
          {mode === 'email' ? 'Send it' : mode === 'call' ? 'Log the call' : 'Save the note'}
        </Button>
      </div>
    </div>
  );
}
