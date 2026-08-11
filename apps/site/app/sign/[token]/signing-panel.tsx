'use client';

// What a customer actually does on the signing page (docs/144 §12).
//
// FIVE STATES, and each one says something different, because "this link does
// not work" is the answer that generates a phone call:
//
//   · waiting  — here is what you are agreeing to, and two buttons.
//   · signed   — thank you, here is when, and nothing left to do.
//   · declined — we have told them; the reason is on the record.
//   · expired  — this ran out, ask for a fresh one.
//   · revoked  — they replaced it, look for the newer email.
//
// SIGNING IS TYPING YOUR NAME. Not a drawn squiggle: a canvas that works on a
// phone is real work, and the evidence is the token, the timestamp and the
// address either way — the mark is reassurance, not proof. Typing your own name
// is also the thing that makes somebody read the line above it.

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';

import {
  declineDocument,
  loadSigningView,
  signDocument,
  type SigningView,
} from '@/lib/signing-client';

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function SigningPanel({ tenantSlug, token }: { tenantSlug: string; token: string }) {
  const [view, setView] = useState<SigningView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    loadSigningView(tenantSlug, token)
      .then((next) => {
        setView(next);
        // Pre-fill with who it was addressed to. People sign for each other, so
        // it stays editable — but the common case should be one click.
        setName((current) => (current === '' ? next.signerName : current));
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'We could not find that. Check the link in your email.'
        );
      });
  }, [tenantSlug, token]);

  useEffect(load, [load]);

  if (loadError !== null) {
    return (
      <Alert color="warning" variant="soft">
        <AlertContent>
          <AlertTitle>We could not open this</AlertTitle>
          <AlertDescription>
            {loadError} If it keeps happening, reply to the email you received and ask for a fresh
            link.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  if (!view) {
    return <Text>Loading&hellip;</Text>;
  }

  const doc = view.document;
  const noun = doc.label.toLowerCase();

  const submit = (): void => {
    setBusy(true);
    setActionError(null);
    signDocument(tenantSlug, token, name.trim())
      .then(() => {
        load();
      })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'That did not go through.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const decline = (): void => {
    setBusy(true);
    setActionError(null);
    declineDocument(tenantSlug, token, reason)
      .then(() => {
        load();
      })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'That did not go through.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Text as="h1" className="text-2xl font-semibold">
          {doc.label}
          {doc.number ? ` ${doc.number}` : ''}
        </Text>
        {view.business.name ? <Text>From {view.business.name}</Text> : null}
      </header>

      {/* The lines, then the total. What is being agreed to comes BEFORE the
          buttons on every screen width — a signature button above the fold and
          the detail below it is a design that hopes nobody reads. */}
      <div className="border-base-300 rounded-box overflow-x-auto border">
        <table className="w-full text-left">
          <thead>
            <tr className="border-base-300 border-b">
              <th className="px-4 py-3">What</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Each</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, index) => (
              <tr key={`${line.description}-${String(index)}`} className="border-base-300 border-b">
                <td className="px-4 py-3">{line.description}</td>
                <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(line.unitPrice, doc.currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {money(line.lineTotal, doc.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-4 py-3 font-semibold" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-3 text-right text-lg font-semibold tabular-nums">
                {money(doc.total, doc.currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {doc.validUntil ? (
        <Text>
          This {noun} is valid until {longDate(doc.validUntil)}.
        </Text>
      ) : null}

      {view.status === 'signed' ? (
        <Alert color="success" variant="soft">
          <AlertContent>
            <AlertTitle>Signed — thank you</AlertTitle>
            <AlertDescription>
              {view.signerName} accepted this on {view.signedAt ? longDate(view.signedAt) : 'today'}
              . {view.business.name} has been told, and a copy of exactly what you agreed to has
              been kept. There is nothing else for you to do.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {view.status === 'declined' ? (
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>You said no to this</AlertTitle>
            <AlertDescription>
              {view.business.name} has been told.
              {view.declineReason ? ` You told them: “${view.declineReason}”` : ''} If that was a
              mistake, reply to their email and they can send it again.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {view.status === 'expired' ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>This link has run out</AlertTitle>
            <AlertDescription>
              It was good until {longDate(view.expiresAt)}. Reply to the email you received and ask
              for a fresh one — the {noun} itself is still here.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {view.status === 'revoked' ? (
        <Alert color="info" variant="soft">
          <AlertContent>
            <AlertTitle>This link was replaced</AlertTitle>
            <AlertDescription>
              {view.business.name} sent an updated version. Look for a newer email from them and use
              the link in that one.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {view.status === 'pending' ? (
        <div className="border-base-300 rounded-box flex flex-col gap-4 border p-5">
          {actionError !== null ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertDescription>{actionError}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {declining ? (
            <>
              <label className="font-medium" htmlFor="decline-reason">
                Anything you want to tell them? (optional)
              </label>
              <Textarea
                id="decline-reason"
                color="primary"
                rows={3}
                value={reason}
                placeholder="Too expensive, wrong dates, going elsewhere…"
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button color="danger" loading={busy} onClick={decline}>
                  Send my answer
                </Button>
                <Button
                  color="neutral"
                  variant="outline"
                  onClick={() => {
                    setDeclining(false);
                  }}
                >
                  Go back
                </Button>
              </div>
            </>
          ) : (
            <>
              <label className="font-medium" htmlFor="signer-name">
                Type your full name to accept this {noun}
              </label>
              <Input
                id="signer-name"
                color="primary"
                value={name}
                autoComplete="name"
                placeholder="Your full name"
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
              <Text>
                By typing your name and choosing Accept, you agree to this {noun} as shown above. We
                record the date, time and your network address alongside it.
              </Text>
              <div className="flex flex-wrap gap-2">
                <Button
                  color="primary"
                  size="lg"
                  loading={busy}
                  disabled={name.trim().length < 2}
                  onClick={submit}
                >
                  Accept this {noun}
                </Button>
                <Button
                  color="neutral"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setDeclining(true);
                  }}
                >
                  No thanks
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
