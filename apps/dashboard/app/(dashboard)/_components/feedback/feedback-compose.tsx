'use client';

import * as React from 'react';
import { Button, Input, Label, Textarea, toast } from '@sparx/ui';
import { useMutation, useQueryClient } from '@sparx/query';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { submitFeedbackAction } from '../../_shell/feedback-actions';
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackContextPayload,
  type FeedbackSource,
} from '../../_shell/feedback-types';
import { summarizeContext } from './feedback-context';
import { CATEGORY_COLOR, CATEGORY_ICON } from './feedback-format';

const MAX_BODY = 5000;

export interface FeedbackComposeProps {
  source: FeedbackSource;
  initialCategory: FeedbackCategory;
  sentiment?: number;
  buildContext: () => FeedbackContextPayload;
  onDirtyChange: (dirty: boolean) => void;
  onSubmitted: () => void;
}

export function FeedbackCompose({
  source,
  initialCategory,
  sentiment,
  buildContext,
  onDirtyChange,
  onSubmitted,
}: FeedbackComposeProps) {
  const queryClient = useQueryClient();
  const [category, setCategory] = React.useState<FeedbackCategory>(initialCategory);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [showContext, setShowContext] = React.useState(false);
  // Snapshot the context at the moment the form opened.
  const [context] = React.useState<FeedbackContextPayload>(() => buildContext());

  const dirty = subject.trim().length > 0 || body.trim().length > 0;
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await submitFeedbackAction({
        category,
        subject: subject.trim() || undefined,
        body: body.trim(),
        sentiment,
        source,
        context,
      });
      // Throw client-side so the friendly message (e.g. the rate-limit notice)
      // reaches onError intact — Server Action throws get redacted in prod.
      if (!result.ok) throw new Error(result.error);
      return result.submission;
    },
    onSuccess: () => {
      onDirtyChange(false);
      void queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Thanks — we got your feedback.');
      onSubmitted();
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : 'Could not send your feedback. Please try again.'
      ),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div role="group" aria-label="Feedback type" className="flex flex-wrap gap-2">
        {FEEDBACK_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c.value];
          const selected = category === c.value;
          return (
            <Button
              key={c.value}
              type="button"
              size="sm"
              variant={selected ? 'solid' : 'soft'}
              color={CATEGORY_COLOR[c.value]}
              leftIcon={<Icon className="h-4 w-4" />}
              aria-pressed={selected}
              title={c.hint}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-subject">Subject</Label>
        <Input
          id="feedback-subject"
          value={subject}
          maxLength={160}
          placeholder="A short summary (optional)"
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback-body" required>
          Details
        </Label>
        <Textarea
          id="feedback-body"
          value={body}
          rows={5}
          maxLength={MAX_BODY}
          required
          placeholder={
            category === 'problem'
              ? 'What happened? What did you expect instead?'
              : category === 'idea'
                ? 'What would you like to see? What problem would it solve?'
                : 'Tell us more…'
          }
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <ContextChip
        context={context}
        expanded={showContext}
        onToggle={() => setShowContext((v) => !v)}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-base-content/50 text-xs">
          Replies arrive by email and in your feedback history.
        </p>
        <Button type="submit" color="primary" loading={mutation.isPending} disabled={!body.trim()}>
          Send feedback
        </Button>
      </div>
    </form>
  );
}

function ContextChip({
  context,
  expanded,
  onToggle,
}: {
  context: FeedbackContextPayload;
  expanded: boolean;
  onToggle: () => void;
}) {
  const summary = summarizeContext(context);
  const rows: [string, string | undefined][] = [
    ['Page', context.route],
    ['Module', context.module ?? '—'],
    ['Section', context.section ?? '—'],
    ['Site', context.property?.name],
    ['Device', context.device],
    ['Theme', context.theme],
    ['Version', context.appVersion],
  ];
  return (
    <div className="border-base-300 bg-base-200 rounded-md border px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-base-content/70 flex items-center gap-1.5 text-xs">
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Sending from: {summary || context.route}</span>
        </span>
        <ChevronDown
          className={`text-base-content/50 h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-xs">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-base-content/50">{k}</dt>
                <dd className="text-base-content/70 truncate">{v}</dd>
              </React.Fragment>
            ))}
        </dl>
      )}
    </div>
  );
}
