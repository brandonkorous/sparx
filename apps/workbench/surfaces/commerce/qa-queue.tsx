'use client';

// Questions & answers — the catalog-wide moderation queue.
//
// A queue, like reviews: every question here was asked by a shopper on some
// product's page and is waiting on you. There is no Save — each decision (answer
// it, show it, hide it) commits on its own. To make a question and its answer
// appear on the storefront takes two deliberate acts: write the answer, then
// show it. They are separate because you often want to answer privately first
// and read it back before it goes public.

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Heading,
  Text,
  Textarea,
  Timestamp,
  useToast,
} from '@wizeworks/silicaui-react';
import { Check, EyeOff, HelpCircle, Reply, ServerCrash } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { productErrorMessage, questionState } from './products-data';
import {
  useAnswerQueueQuestion,
  useBulkModerateQuestions,
  useModerateQueueQuestion,
  usePendingQuestions,
  type QueueQuestion,
} from './moderation-data';

const LABEL = 'Questions & answers';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  return 'beside';
}

function AnswerBox({
  busy,
  onSend,
  onCancel,
}: {
  busy: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        color="module"
        rows={3}
        value={text}
        placeholder="Answer this question — once you show it, everyone reading the product's page sees your answer under their question."
        aria-label="Answer this question"
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" color="neutral" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          color="module"
          disabled={text.trim() === ''}
          loading={busy}
          onClick={() => {
            onSend(text.trim());
          }}
        >
          Post answer
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  ctx,
  selected,
  onToggleSelect,
}: {
  question: QueueQuestion;
  ctx: SurfaceContext;
  selected: boolean;
  onToggleSelect: (id: string, next: boolean) => void;
}) {
  const toast = useToast();
  const moderate = useModerateQueueQuestion();
  const answer = useAnswerQueueQuestion();
  const [answering, setAnswering] = useState(false);

  const state = questionState(question.status);
  const asker = question.displayName ?? 'Someone';
  const product = question.productTitle ?? 'a product';

  const failed = (title: string) => (error: unknown) => {
    toast.add({
      title,
      description: productErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  const setStatus = (status: 'published' | 'rejected', done: string) => {
    moderate.mutate(
      { id: question.id, status },
      {
        onSuccess: () => {
          toast.add({ title: done, type: 'success' });
        },
        onError: failed('Could not change that question'),
      }
    );
  };

  const openProduct = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(
      'commerce.product.reviews',
      { productId: question.productId },
      { target: targetFor(event) }
    );
  };

  return (
    <article className="border-base-300 bg-base-100 flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Checkbox
          color="module"
          checked={selected}
          aria-label={`Select this question about ${product}`}
          onChange={(event) => {
            onToggleSelect(question.id, event.target.checked);
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="link link-hover min-w-0 truncate text-left text-base font-semibold"
              onClick={(event) => {
                openProduct(event);
              }}
            >
              {product}
            </button>
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
          </div>
          <Text className="text-base whitespace-pre-line">{question.body}</Text>
          <Text className="text-sm">
            {asker} asked · <Timestamp value={question.createdAt} format="relative" />
          </Text>
        </div>
      </div>

      {question.answers.length > 0 ? (
        <div className="flex flex-col gap-2">
          {question.answers.map((entry) => (
            <div
              key={entry.id}
              className="border-base-300 flex flex-col gap-1 rounded-lg border p-3"
            >
              <Text as="span" className="text-sm font-medium">
                {entry.isOfficial ? 'Answered by you' : 'Answered by another shopper'}
              </Text>
              <Text className="text-base whitespace-pre-line">{entry.body}</Text>
            </div>
          ))}
        </div>
      ) : null}

      {answering ? (
        <AnswerBox
          busy={answer.isPending}
          onCancel={() => {
            setAnswering(false);
          }}
          onSend={(text) => {
            answer.mutate(
              { id: question.id, body: text },
              {
                onSuccess: () => {
                  setAnswering(false);
                  toast.add({ title: 'Answer posted', type: 'success' });
                },
                onError: failed('Could not post your answer'),
              }
            );
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            color="neutral"
            onClick={() => {
              setAnswering(true);
            }}
          >
            <Reply className="size-4" aria-hidden />
            {question.answers.length > 0 ? 'Add another answer' : 'Answer it'}
          </Button>
          <Button
            size="sm"
            color="module"
            loading={moderate.isPending}
            onClick={() => {
              setStatus('published', 'Question shown on the page');
            }}
          >
            <Check className="size-4" aria-hidden />
            Show it on the page
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            className="ml-auto"
            loading={moderate.isPending}
            onClick={() => {
              setStatus('rejected', 'Question hidden');
            }}
          >
            <EyeOff className="size-4" aria-hidden />
            Hide it
          </Button>
        </div>
      )}
    </article>
  );
}

export function QaQueueSurface({ ctx }: { ctx: SurfaceContext }) {
  const questions = usePendingQuestions();
  const toast = useToast();
  const bulkModerate = useBulkModerateQuestions();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => questions.data ?? [], [questions.data]);
  const selectedIds = useMemo(
    () => rows.filter((r) => selected.has(r.id)).map((r) => r.id),
    [rows, selected]
  );
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const toggleSelect = (id: string, next: boolean) => {
    setSelected((current) => {
      const copy = new Set(current);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const bulkSetStatus = (status: 'published' | 'rejected', done: string) => {
    bulkModerate.mutate(
      { questionIds: selectedIds, status },
      {
        onSuccess: (result) => {
          clearSelection();
          toast.add({ title: `${done} (${String(result.count)})`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not update those questions',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Questions queue controls">
        <HelpCircle className="size-4 shrink-0" aria-hidden />
        <Heading level={2} className="min-w-0 truncate text-base font-semibold">
          {LABEL}
        </Heading>
        {rows.length > 0 ? (
          <Badge color="warning" variant="soft" size="sm">
            {rows.length === 1 ? '1 waiting' : `${String(rows.length)} waiting`}
          </Badge>
        ) : null}
        <RefreshButton
          className="ml-auto"
          isFetching={questions.isFetching}
          updatedAt={questions.data ? questions.dataUpdatedAt : undefined}
          onRefresh={() => {
            void questions.refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {questions.isError ? (
            <EmptyState
              icon={<ServerCrash className="size-6" aria-hidden />}
              title="Could not load the questions queue"
              description={productErrorMessage(
                questions.error,
                'This is a problem reaching the server. Nothing customers asked has been lost.'
              )}
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    void questions.refetch();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : questions.isLoading ? (
            <p className="text-sm" role="status">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Check className="size-6" aria-hidden />}
              title="No questions waiting"
              description="When a shopper asks something on one of your product pages, it appears here for you to answer and show. Nothing goes on a page until you show it."
            />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Heading level={1} className="text-2xl font-semibold">
                  Questions waiting for you
                </Heading>
                <Text className="text-sm">
                  Shoppers asked these on your product pages. Answer the ones you can, then show
                  them so the question and your answer help the next person deciding whether to buy.
                </Text>
              </div>

              {selectedIds.length > 0 ? (
                <div className="border-base-300 bg-base-100 sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <Text as="span" className="font-medium">
                    {selectedIds.length === 1
                      ? '1 selected'
                      : `${String(selectedIds.length)} selected`}
                  </Text>
                  <Button
                    size="sm"
                    color="module"
                    loading={bulkModerate.isPending}
                    onClick={() => {
                      bulkSetStatus('published', 'Shown');
                    }}
                  >
                    <Check className="size-4" aria-hidden />
                    Show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    color="neutral"
                    loading={bulkModerate.isPending}
                    onClick={() => {
                      bulkSetStatus('rejected', 'Hidden');
                    }}
                  >
                    <EyeOff className="size-4" aria-hidden />
                    Hide
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    className="ml-auto"
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <label className="flex w-fit items-center gap-2">
                  <Checkbox
                    color="module"
                    checked={allSelected}
                    aria-label="Select every waiting question"
                    onChange={(event) => {
                      setSelected(
                        event.target.checked ? new Set(rows.map((r) => r.id)) : new Set()
                      );
                    }}
                  />
                  <Text as="span" className="text-sm">
                    Select all
                  </Text>
                </label>
              )}

              <div className="flex flex-col gap-3">
                {rows.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    ctx={ctx}
                    selected={selected.has(question.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
