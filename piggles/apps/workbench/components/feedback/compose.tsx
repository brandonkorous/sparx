'use client';

// Writing a message to the sparx team.
//
// A modal, deliberately — feedback is chrome, invoked from the toolbar, ⌘K, the
// account menu and from inside other panes, and it must leave the workspace
// exactly as it found it. A pane would either hide the thing being described
// (opening in the focused group) or split the layout for a thirty-second note
// and leave a tab to clean up afterwards. Neither respects the context rule.
//
// What makes that safe here is the context capture: the pane, module, record and
// site are attached automatically and shown below, so nobody has to keep the
// broken screen in view while they type. And the draft survives a dismissal —
// see the draft store below — so closing this costs nothing.

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@piggles/ui';
import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  MetadataItem,
  MetadataList,
  Textarea,
  useToast,
} from '@wizeworks/silicaui-react';
import {
  FEEDBACK_CATEGORIES,
  MAX_FEEDBACK_BODY,
  MAX_FEEDBACK_SUBJECT,
  feedbackErrorMessage,
  useSendFeedback,
  type FeedbackCategory,
  type FeedbackContextPayload,
  type FeedbackSource,
} from '../../lib/api/feedback';
import { clearDraft, draftKey, publishDraft, readDraft } from '../../lib/drafts';
import { summarizeContext } from './context';
import { CATEGORY_COLOR, CATEGORY_ICON } from './format';

/**
 * The unsent message, kept while the session lasts.
 *
 * A modal is the one place in this app with no dirty dot and no close guard, so
 * dismissing one normally throws work away silently. Parking the draft here
 * removes that failure instead of papering over it with a confirm: closing is no
 * longer destructive, so it no longer needs to ask.
 *
 * The store is in-memory, which is exactly the right lifetime — a dismissal is
 * "not now", a reload is "that was a different day". A draft that outlived a
 * reload would eventually hand someone a half-written note from last week when
 * they sat down to report something new.
 */
const DRAFT_KEY = draftKey('feedback', 'new');

interface FeedbackDraft {
  category: FeedbackCategory;
  subject: string;
  body: string;
  /** Kept WITH the draft: the message is about where they were when they
   *  started writing, not where they happen to be when they come back to it. */
  context: FeedbackContextPayload;
}

function readFeedbackDraft(): FeedbackDraft | null {
  return readDraft(DRAFT_KEY) as FeedbackDraft | null;
}

/**
 * Words already written for them.
 *
 * Set when the composer is opened from a failure rather than from the toolbar: the
 * screen knows exactly what went wrong, and the operator almost certainly cannot
 * describe it — "it said something about scopes" is what a real person remembers of
 * an API error. Prefilling turns a report nobody can write into one they only have to
 * add a sentence to, and every word of it stays editable.
 */
export interface FeedbackPrefill {
  subject?: string;
  body?: string;
}

export interface FeedbackComposeProps {
  source: FeedbackSource;
  initialCategory: FeedbackCategory;
  /** Carried from the sentiment chip so a rating and its explanation are one record. */
  sentiment?: number;
  prefill?: FeedbackPrefill;
  buildContext: () => FeedbackContextPayload;
  onSubmitted: () => void;
  onCancel: () => void;
}

export function FeedbackCompose({
  source,
  initialCategory,
  sentiment,
  prefill,
  buildContext,
  onSubmitted,
  onCancel,
}: FeedbackComposeProps) {
  const toast = useToast();

  // A restored draft wins over the defaults — including its original context,
  // which is the whole point of keeping the two together.
  //
  // It wins over a PREFILL too, and that ordering is deliberate: a half-written
  // message is somebody's own words, and overwriting them with a machine-generated
  // description of an error is a worse failure than showing a slightly stale report.
  // "Start over" below is the escape hatch, and it restores the prefill rather than
  // clearing to nothing.
  const [restored] = useState(() => readFeedbackDraft());
  const [category, setCategory] = useState<FeedbackCategory>(restored?.category ?? initialCategory);
  const [subject, setSubject] = useState(restored?.subject ?? prefill?.subject ?? '');
  const [body, setBody] = useState(restored?.body ?? prefill?.body ?? '');
  const [context, setContext] = useState<FeedbackContextPayload>(
    () => restored?.context ?? buildContext()
  );

  const send = useSendFeedback();

  // Park every edit. Cheap — an in-memory map write per keystroke — and it is
  // what lets the dialog close without a confirmation.
  useEffect(() => {
    if (!subject.trim() && !body.trim()) {
      clearDraft(DRAFT_KEY);
      return;
    }
    publishDraft(DRAFT_KEY, { category, subject, body, context } satisfies FeedbackDraft);
  }, [category, subject, body, context]);

  const startOver = () => {
    clearDraft(DRAFT_KEY);
    setCategory(initialCategory);
    setSubject(prefill?.subject ?? '');
    setBody(prefill?.body ?? '');
    setContext(buildContext());
  };

  const submit = () => {
    if (!body.trim() || send.isPending) return;
    send.mutate(
      {
        category,
        subject: subject.trim() || undefined,
        body: body.trim(),
        sentiment,
        source,
        context,
      },
      {
        onSuccess: () => {
          clearDraft(DRAFT_KEY);
          toast.add({ title: 'Thanks — we got your message.', type: 'success' });
          onSubmitted();
        },
        onError: (error) => {
          toast.add({ title: feedbackErrorMessage(error), type: 'error' });
        },
      }
    );
  };

  const placeholder =
    category === 'problem'
      ? 'What happened? What did you expect instead?'
      : category === 'idea'
        ? 'What would you like to see? What problem would it solve?'
        : category === 'question'
          ? 'What would you like to know?'
          : 'Tell us what’s working…';

  const continuing = Boolean(restored && (restored.subject.trim() || restored.body.trim()));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {continuing ? (
        // Says plainly why there are already words in the box. Without this, a
        // restored draft reads as the app having gone wrong.
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Picking up the message you started.
          <Button type="button" variant="ghost" size="xs" onClick={startOver}>
            Start over
          </Button>
        </p>
      ) : null}

      <div role="group" aria-label="What kind of feedback" className="flex flex-wrap gap-2">
        {FEEDBACK_CATEGORIES.map((option) => {
          const glyph = CATEGORY_ICON[option.value];
          const selected = category === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              // Selected fills; the rest sit in the same hue softly, so the
              // picker stays one legible row rather than four competing fills.
              variant={selected ? 'solid' : 'soft'}
              color={CATEGORY_COLOR[option.value]}
              aria-pressed={selected}
              title={option.hint}
              onClick={() => {
                setCategory(option.value);
              }}
            >
              <Icon glyph={glyph} className="size-4" aria-hidden />
              {option.label}
            </Button>
          );
        })}
      </div>

      <Field>
        <FieldLabel>Subject</FieldLabel>
        <FieldControl
          render={
            <Input
              value={subject}
              maxLength={MAX_FEEDBACK_SUBJECT}
              placeholder="A short summary (optional)"
              onChange={(event) => {
                setSubject(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>Optional — it just helps us file it.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel required>Details</FieldLabel>
        <FieldControl
          render={
            <Textarea
              value={body}
              rows={6}
              required
              maxLength={MAX_FEEDBACK_BODY}
              placeholder={placeholder}
              onChange={(event) => {
                setBody(event.target.value);
              }}
            />
          }
        />
      </Field>

      <ContextPanel context={context} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Replies arrive by email and in Your feedback.</p>
        <div className="flex items-center gap-2">
          {/* Closing keeps the draft, so this is genuinely "later", not a
              discard — which is why nothing has to ask before it happens. */}
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={!body.trim() || send.isPending}>
            {send.isPending ? 'Sending…' : 'Send feedback'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * What is being attached, in plain words, openable for the full list.
 *
 * This panel is what makes a modal defensible: it is the reason nobody needs the
 * broken screen still visible behind the form. Shown rather than described,
 * because "we collect some diagnostic information" asks for trust while a list
 * the person can read earns it.
 */
function ContextPanel({ context }: { context: FeedbackContextPayload }) {
  const rows = useMemo(() => {
    const candidates: [string, string | null | undefined][] = [
      ['Pane', context.pageTitle],
      ['Module', context.module],
      ['Section', context.section],
      ['Site', context.property?.name],
      ['Record', context.entity ? `${context.entity.type} ${context.entity.id}` : null],
      ['Device', context.device],
      ['Theme', context.theme],
      ['Version', context.appVersion],
    ];
    return candidates.filter((row): row is [string, string] => Boolean(row[1]));
  }, [context]);

  if (rows.length === 0) return null;

  return (
    <div className="border-base-300 bg-base-200 rounded-md border px-3 py-2">
      <Collapsible>
        {/* Silica's trigger inherits the surrounding 16px at weight 600, which
            makes this read as a heading introducing the form. It isn't one —
            it is a caption describing what gets attached — so it takes the same
            size and weight as the field descriptions above it. Quieter, not
            faded: the ink token is untouched. */}
        <CollapsibleTrigger className="text-sm font-normal">
          Sending from: {summarizeContext(context)}
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <MetadataList className="mt-2">
            {rows.map(([label, value]) => (
              <MetadataItem key={label} label={label}>
                {value}
              </MetadataItem>
            ))}
          </MetadataList>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}
