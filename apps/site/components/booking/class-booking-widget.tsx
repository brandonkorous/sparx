'use client';

// Class booking widget (docs/79 §7.2). A class is a shared session many customers
// join — so instead of the appointment slot-picker, this lists upcoming sessions
// with open seats and lets the customer claim one. A full session enrolls them as
// waitlisted (auto-promoted when a seat frees).

import { useEffect, useState } from 'react';

import { cx, SparxAlert, SparxButton, SparxInput, SparxLabel } from '@sparx/site-ui';

import type { PublicService } from '../../lib/scheduling';
import { joinSession, listSessions, type PublicSession } from '../../lib/scheduling-client';

function formatSession(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function ClassBookingWidget({
  tenantSlug,
  service,
}: {
  tenantSlug: string;
  service: PublicService;
}) {
  const [sessions, setSessions] = useState<PublicSession[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ waitlisted: boolean } | null>(null);

  useEffect(() => {
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + 60);
    listSessions(tenantSlug, service.id, from.toISOString(), to.toISOString())
      .then(setSessions)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load sessions.');
        setSessions([]);
      });
  }, [tenantSlug, service.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError('Please choose a session.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await joinSession(tenantSlug, selected, {
        customer: {
          name: name.trim(),
          email: email.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      });
      setResult({ waitlisted: res.waitlisted });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reserve your spot.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="st-card st-booking__confirm" role="status">
        <h2 className="st-h3">{result.waitlisted ? "You're on the waitlist" : "You're in"}</h2>
        <p className="st-muted">
          {result.waitlisted
            ? `This session is full — we'll let you know at ${email} if a spot opens.`
            : `Your spot in ${service.name} is confirmed. A confirmation is on its way to ${email}.`}
        </p>
      </div>
    );
  }

  return (
    <form className="st-booking" onSubmit={submit}>
      <div className="st-booking__slots">
        <SparxLabel>Upcoming sessions</SparxLabel>
        {sessions === null ? (
          <p className="st-muted">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="st-muted">No upcoming sessions scheduled. Check back soon.</p>
        ) : (
          <div className="st-booking__session-grid">
            {sessions.map((s) => (
              <button
                key={s.bookingId}
                type="button"
                className={cx('st-booking__session', selected === s.bookingId && 'is-selected')}
                aria-pressed={selected === s.bookingId}
                onClick={() => setSelected(s.bookingId)}
              >
                <span className="st-booking__session-when">{formatSession(s.startAt)}</span>
                <span className="st-booking__session-seats st-muted">
                  {s.remaining} {s.remaining === 1 ? 'seat' : 'seats'} left
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="st-booking__row">
        <div>
          <SparxLabel htmlFor="cls-name">Name</SparxLabel>
          <SparxInput
            id="cls-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <SparxLabel htmlFor="cls-email">Email</SparxLabel>
          <SparxInput
            id="cls-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <SparxLabel htmlFor="cls-phone">Phone (optional)</SparxLabel>
        <SparxInput
          id="cls-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {error ? <SparxAlert color="danger">{error}</SparxAlert> : null}

      <SparxButton type="submit" color="primary" disabled={submitting || !selected}>
        {submitting ? 'Reserving…' : 'Reserve my spot'}
      </SparxButton>
    </form>
  );
}
