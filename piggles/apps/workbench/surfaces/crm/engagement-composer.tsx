'use client';

// The engagement composer (docs/144 §5.5) — three buttons at the top of a
// record's timeline: note, email, log a call. Each opens its own dialog.
//
// LOGGING WHAT JUST HAPPENED HAS TO BE CHEAPER THAN NOT LOGGING IT. Everything a
// CRM knows about its customers is downstream of that one interaction being
// frictionless, which is why these sit at the TOP of the timeline. One press is
// the whole cost of getting to the box.
//
// THIS WAS A TAB STRIP OVER AN ALWAYS-OPEN FORM, and that was wrong twice.
// First, the workbench is a tabbed app and a record's pane already carries its
// own strip, so this was a third layer of tabs — which does not read as a
// choice and did not even render as a strip that deep. Second, an inline form
// held the space permanently for an action taken now and then, pushing the
// timeline people came to read down the page every single visit.
//
// A DIALOG IS THE RIGHT SHAPE HERE (docs/123 §"Pane or modal?"): each of these
// is seconds of typing, there is nothing to come back to, and nothing else on
// screen is needed while writing. The one cost is that a dialog is invisible to
// the unsaved-work guard, so the guard is registered from the PANE while a
// draft has content — the pane asks on the dialog's behalf.

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  faEnvelope,
  faNoteSticky,
  faPaperPlane,
  faPhone,
  faPhoneVolume,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useActiveSiteId } from '../../lib/api/shell-data';
import { PaneScope } from '../../lib/dock/window-boundary';
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
  expandShortcutBefore,
  OUTCOME_LABELS,
  useLogCall,
  useLogNote,
  useNoteSnippetUsed,
  useSalesSnippets,
  useSalesTemplates,
  useSendableMailboxes,
  useSendEngagementEmail,
  type CallOutcome,
} from './engagement-data';
import { productCopy } from '../../lib/product';

const MODES = [
  { value: 'note', label: 'Note', icon: faNoteSticky },
  { value: 'email', label: 'Email', icon: faEnvelope },
  { value: 'call', label: 'Log a call', icon: faPhone },
] as const;

type Mode = (typeof MODES)[number]['value'];

/** What each dialog is called and what its one button does. Kept together so
 *  the three read as three different jobs rather than one form in three moods. */
const COPY: Record<Mode, { title: string; description: string; action: string }> = {
  note: {
    title: 'Add a note',
    description:
      'Something worth remembering about this customer. Only your team ever sees it, and it goes on their timeline with everything else.',
    action: 'Save the note',
  },
  email: {
    title: 'Send an email',
    description:
      'It goes to the address on their record, so it cannot reach the wrong person — and the whole thread is kept against them.',
    action: 'Send it',
  },
  call: {
    title: 'Log a call',
    description:
      'Ring them from here, or write up a call you have already had. Either way it lands on their timeline with how long it took and how it went.',
    action: 'Log the call',
  },
};

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
  const [open, setOpen] = useState(false);

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

  /** Closing throws the draft away, which is why the pane-level guard above
   *  fires first — a dialog cannot ask on its own behalf. */
  const close = () => {
    setOpen(false);
    reset();
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
            description: productCopy(
              'crm.call.bridgeHint',
              'Pick up and Piggles will dial them and join you.'
            ),
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

  /**
   * Typing `;hours` and pressing space drops the saved paragraph in.
   *
   * THIS IS WHY SNIPPETS EXIST, and until now nothing anywhere expanded one —
   * the box listed the shortcuts as though it did. Space and Tab both trigger
   * it, and both only when a shortcut genuinely matches, so nothing changes for
   * anyone who never saved one.
   *
   * The caret is restored deliberately: the paragraph goes in mid-sentence, and
   * a textarea whose value changes under it puts the cursor at the end, which
   * would leave somebody typing the rest of their sentence after the wrong
   * words.
   */
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  const noteSnippetUsed = useNoteSnippetUsed();

  useLayoutEffect(() => {
    if (pendingCaret === null) return;
    bodyRef.current?.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret]);

  const expandShortcut = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== ' ' && event.key !== 'Tab') return;
    const field = event.currentTarget;
    // A selection means they are replacing text, not finishing a word.
    if (field.selectionStart !== field.selectionEnd) return;

    const hit = expandShortcutBefore(field.value, field.selectionStart, snippetData?.items ?? []);
    if (!hit) return;

    event.preventDefault();
    setBody(hit.text);
    setPendingCaret(hit.caret);
    noteSnippetUsed.mutate(hit.snippet.id);
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
      close();
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
    <div className="flex flex-wrap items-center gap-2">
      {/* ONE BUTTON PER KIND, EACH OPENING ITS OWN DIALOG. This used to be a tab
          strip over an always-open form, which was wrong twice: the workbench is
          already a tabbed app and this sat two strips deep, and an inline form
          parked on the timeline took up the space permanently for an action
          taken now and then. A button says what it does and costs nothing until
          it is pressed. */}
      {modes.map((entry) => (
        <Button
          key={entry.value}
          size="sm"
          color="module"
          variant={entry.value === 'note' ? 'solid' : 'outline'}
          onClick={() => {
            setMode(entry.value);
            setOpen(true);
          }}
        >
          <Icon glyph={entry.icon} className="size-4" aria-hidden />
          {entry.label}
        </Button>
      ))}

      <PaneScope>
        <Dialog
          open={open}
          onOpenChange={(next: boolean) => {
            if (!next) close();
          }}
        >
          {/* `@container` is load-bearing: this dialog portals to the pane host,
              which is OUTSIDE the `@container` on PANE_SHELL, so the call
              form's `@md:grid-cols-3` below matched nothing and the three
              fields stacked in one column at every width. */}
          <DialogContent className="@container flex max-h-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden">
            <DialogTitle>{COPY[mode].title}</DialogTitle>
            <DialogDescription>{COPY[mode].description}</DialogDescription>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 py-2">
              {mode === 'note' ? (
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
              ) : null}

              {mode === 'email' ? (
                <div className="flex flex-col gap-3">
                  {(templateData?.items.length ?? 0) > 0 ? (
                    <Field>
                      <FieldLabel>Start from something you have written before</FieldLabel>
                      <FieldControl
                        render={
                          <NativeSelect
                            color="module"
                            value={templateId}
                            onChange={(event) => {
                              applyTemplate(event.target.value);
                            }}
                          >
                            <option value="">Write it from scratch</option>
                            {templateData?.items.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                                {template.sendCount > 0
                                  ? ` · sent ${String(template.sendCount)}×`
                                  : ''}
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
                            color="module"
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
                        Sending from a connected mailbox puts a copy in its Sent folder, so replies
                        come back where you expect them.
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
                          ref={bodyRef}
                          color="module"
                          rows={6}
                          value={body}
                          placeholder="Hi — just checking whether you had a chance to look at the numbers."
                          onKeyDown={expandShortcut}
                          onChange={(event) => {
                            setBody(event.target.value);
                          }}
                        />
                      }
                    />
                    {/* The shortcuts AND what to do with them. This used to list
                        the names alone, which read as a feature announcement for
                        something that did not happen — a shortcut nobody tells
                        you how to fire is a fact about the database. */}
                    <FieldDescription>
                      {(snippetData?.items.length ?? 0) > 0
                        ? `Type ${snippetData?.items
                            .slice(0, 3)
                            .map((snippet) => `;${snippet.shortcut}`)
                            .join(', ')} and press space to drop in a saved paragraph.`
                        : ''}
                    </FieldDescription>
                  </Field>
                </div>
              ) : null}

              {mode === 'call' ? (
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
                          {productCopy(
                            'crm.call.ringsFirst',
                            'Piggles rings this phone first, then dials them and joins the two.'
                          )}
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
                        <Icon glyph={faPhoneVolume} className="size-4" aria-hidden />
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
                            color="module"
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
                            color="module"
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
                      The whole reason for logging it. Even one line is worth more than nothing in
                      six months.
                    </FieldDescription>
                  </Field>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <DialogClose>
                <Button size="sm" color="neutral" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                size="sm"
                color="module"
                loading={busy}
                disabled={blocked}
                onClick={() => void submit()}
              >
                <Icon glyph={faPaperPlane} className="size-4" aria-hidden />
                {COPY[mode].action}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PaneScope>
    </div>
  );
}
