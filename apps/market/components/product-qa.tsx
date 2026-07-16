'use client';

// PDP questions & answers section (client island). Shows published questions and
// their (merchant-authored) answers, and a collapsible "ask a question" form that
// enters moderation. Answers are read-only on the marketplace — sellers reply from
// their dashboard.

import { useState } from 'react';
import { CircleHelp, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';

import { submitProductQuestion, ReviewRequestError } from '@/lib/reviews-client';
import type { ProductQuestion } from '@/lib/market';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function QuestionCard({ question }: { question: ProductQuestion }) {
  return (
    <article className="border-base-300 border-t py-5 first:border-t-0 first:pt-0">
      <div className="flex gap-2.5">
        <CircleHelp size={18} aria-hidden className="text-base-content mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-base-content text-sm font-medium">{question.body}</p>
          <p className="text-base-content mt-0.5 text-[0.8125rem]">
            Asked by {question.displayName ?? 'a shopper'} · {formatDate(question.createdAt)}
          </p>
        </div>
      </div>
      {question.answers.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3 pl-7">
          {question.answers.map((answer) => (
            <div key={answer.id} className="bg-base-200 rounded-lg p-3">
              <p className="text-base-content text-sm whitespace-pre-line">{answer.body}</p>
              <p className="text-base-content mt-1 inline-flex items-center gap-1 text-[0.8125rem]">
                {answer.isOfficial ? (
                  <>
                    <ShieldCheck size={13} aria-hidden className="text-success" />
                    Seller · {formatDate(answer.createdAt)}
                  </>
                ) : (
                  <>Answer · {formatDate(answer.createdAt)}</>
                )}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AskQuestionForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!body.trim()) {
      setError('Please type your question.');
      return;
    }
    setBusy(true);
    try {
      await submitProductQuestion(slug, {
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        body: body.trim(),
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof ReviewRequestError ? err.message : 'Could not submit your question just now.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-base-300 flex flex-col gap-4 rounded-xl border p-4"
    >
      <Field>
        <FieldLabel>Your name (optional)</FieldLabel>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Jordan P."
          maxLength={63}
        />
      </Field>
      <Field>
        <FieldLabel>Your question</FieldLabel>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask the seller anything about this product…"
          rows={3}
          maxLength={2000}
          required
        />
      </Field>
      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          color="primary"
          variant="solid"
          size="md"
          loading={busy}
          disabled={busy}
        >
          Submit question
        </Button>
        <Button
          type="button"
          color="neutral"
          variant="ghost"
          size="md"
          onClick={onDone}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ProductQA({ slug, questions }: { slug: string; questions: ProductQuestion[] }) {
  const [asking, setAsking] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section aria-labelledby="qa-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="qa-heading" className="text-base-content text-xl font-semibold">
          Questions &amp; answers
        </h2>
        {!asking ? (
          <Button
            type="button"
            color="primary"
            variant="soft"
            size="sm"
            iconStart={<MessageCircleQuestion size={15} />}
            onClick={() => setAsking(true)}
          >
            Ask a question
          </Button>
        ) : null}
      </div>

      {submitted ? (
        <Alert color="success" variant="soft">
          Thanks! Your question will appear once the seller answers it.
        </Alert>
      ) : null}

      {asking ? (
        <AskQuestionForm
          slug={slug}
          onDone={() => {
            setAsking(false);
            setSubmitted(true);
          }}
        />
      ) : null}

      {questions.length > 0 ? (
        <div>
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>
      ) : !submitted ? (
        <EmptyState
          size="sm"
          icon={<MessageCircleQuestion size={32} aria-hidden />}
          title="No questions yet"
          description="Have a question about this product? Ask the seller — answers show up here."
        />
      ) : null}
    </section>
  );
}
