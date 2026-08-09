'use client';

// Customer self-service support requests (docs/144 §7) — where a signed-in
// customer raises something and then finds out what happened to it.
//
// The whole reason this page exists is the second half. Raising a request was
// already possible from a support form on the site; what was missing was any way
// to see it again afterwards, which is what turns "I sent a message into the
// void" into "I can see somebody has it". So the list leads with whether anyone
// has got back to them, not with a status name.
//
// What is NOT shown, on purpose: the reply deadline. The business promised
// itself four working hours; showing that to the customer converts an internal
// target into a commitment they can hold it to, and a business having a bad week
// should not be punished by its own tooling. They see that it is being handled.

import { useCallback, useEffect, useState } from 'react';

import { useCustomer } from '@/components/customer-provider';
import {
  getMyRequests,
  openMyRequest,
  replyToMyRequest,
  type MyRequest,
} from '@/lib/customer-client';

import { Alert, Badge, Button, Input, Textarea } from '@wizeworks/silicaui-react';

const PAGE_SIZE = 20;

type Scope = 'open' | 'settled';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The one badge a row wears.
 *
 * Three states, in the order a person cares about them: waiting to be picked up,
 * being worked on, finished. "Waiting" is warning rather than danger — nobody
 * has done anything wrong yet, and a wall of red on a support page reads as an
 * accusation. Settled is success, because from the customer's side that is
 * genuinely the good outcome.
 */
function requestSignal(request: MyRequest): {
  label: string;
  tone: 'success' | 'info' | 'warning';
} {
  if (request.state === 'settled') return { label: 'Sorted', tone: 'success' };
  if (request.answered) return { label: 'Being looked at', tone: 'info' };
  return { label: 'Waiting for us', tone: 'warning' };
}

export default function RequestsPage() {
  const { tenantSlug } = useCustomer();
  const [scope, setScope] = useState<Scope>('open');
  const [requests, setRequests] = useState<MyRequest[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(() => {
    setRequests(null);
    setError(null);
    getMyRequests(tenantSlug, scope, page, PAGE_SIZE)
      .then((res) => {
        setRequests(res.items);
        setTotal(res.total);
      })
      .catch(() => setError('Could not load your requests.'));
  }, [tenantSlug, scope, page]);

  useEffect(() => {
    load();
  }, [load]);

  function switchScope(next: Scope): void {
    setReplyingTo(null);
    setPage(1);
    setScope(next);
  }

  async function handleOpen(): Promise<void> {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const created = await openMyRequest(tenantSlug, { subject, message });
      setSubject('');
      setMessage('');
      setComposing(false);
      setNotice(`Request #${String(created.number)} is in — we'll be in touch.`);
      // Land them where the new request actually is, so it is not "sent" and
      // then invisible.
      if (scope !== 'open') switchScope('open');
      else load();
    } catch {
      setError('Could not send that just now. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleReply(id: string): Promise<void> {
    if (!replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      await replyToMyRequest(tenantSlug, id, replyText);
      setReplyText('');
      setReplyingTo(null);
      setNotice('Added to your request.');
      load();
    } catch {
      setError('Could not add that just now. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <Button
          color="primary"
          onClick={() => {
            setComposing((open) => !open);
            setNotice(null);
          }}
        >
          {composing ? 'Cancel' : 'Ask for help'}
        </Button>
      </div>

      {notice ? (
        <Alert color="success" variant="soft">
          {notice}
        </Alert>
      ) : null}
      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}

      {composing ? (
        <div className="border-base-300 rounded-box flex flex-col gap-3 border p-4">
          <label className="flex flex-col gap-1">
            <span className="font-medium">What do you need help with?</span>
            <Input
              value={subject}
              maxLength={255}
              placeholder="Order arrived damaged"
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">What went wrong?</span>
            <Textarea
              value={message}
              rows={4}
              maxLength={10_000}
              placeholder="What happened, and what you expected instead. Order numbers and dates help."
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          <div>
            <Button
              color="primary"
              disabled={sending || !subject.trim() || !message.trim()}
              onClick={() => void handleOpen()}
            >
              {sending ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2" role="tablist" aria-label="Which requests">
        {(['open', 'settled'] as const).map((value) => (
          <Button
            key={value}
            role="tab"
            aria-selected={scope === value}
            color={scope === value ? 'primary' : 'neutral'}
            variant={scope === value ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => switchScope(value)}
          >
            {value === 'open' ? 'Open' : 'Sorted'}
          </Button>
        ))}
      </div>

      {requests === null ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : requests.length === 0 ? (
        <div className="border-base-300 rounded-box border p-8 text-center">
          <p className="font-medium">
            {scope === 'open' ? 'Nothing open right now' : 'Nothing sorted yet'}
          </p>
          <p className="text-base-content">
            {scope === 'open'
              ? 'If something is not right, ask for help above and we will pick it up.'
              : 'Requests move here once they have been dealt with.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => {
            const signal = requestSignal(request);
            return (
              <li
                key={request.id}
                className="border-base-300 rounded-box flex flex-col gap-2 border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <strong>{request.subject}</strong>
                    <span className="text-base-content">
                      #{request.number} · opened {formatDate(request.openedAt)}
                      {request.stage ? ` · ${request.stage}` : ''}
                    </span>
                  </div>
                  <Badge color={signal.tone} variant="soft">
                    {signal.label}
                  </Badge>
                </div>

                {request.description ? (
                  <p className="text-base-content whitespace-pre-wrap">{request.description}</p>
                ) : null}

                {request.state === 'open' ? (
                  replyingTo === request.id ? (
                    <div className="flex flex-col gap-2">
                      <Textarea
                        value={replyText}
                        rows={3}
                        maxLength={10_000}
                        placeholder="Anything else that would help us sort this out."
                        onChange={(event) => setReplyText(event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          color="primary"
                          size="sm"
                          disabled={sending || !replyText.trim()}
                          onClick={() => void handleReply(request.id)}
                        >
                          {sending ? 'Sending…' : 'Add to request'}
                        </Button>
                        <Button
                          color="neutral"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Button
                        color="neutral"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(request.id);
                          setReplyText('');
                        }}
                      >
                        Add something
                      </Button>
                    </div>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center gap-3">
          <Button
            color="neutral"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-base-content">
            Page {page} of {totalPages}
          </span>
          <Button
            color="neutral"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
