'use client';

// Ask-a-question form for the PDP. Posts to the public questions endpoint via
// the same-origin proxy; questions enter moderation, so on success we show a
// "thanks, pending" state rather than inserting it into the list. A signed-in
// shopper is attributed server-side via the session cookie; guests give a name.

import { useState } from 'react';

import { SparxAlert, SparxButton, SparxInput, SparxTextarea } from '@sparx/site-ui';

const API_BASE = '/api/sparx';

export function QuestionForm({ tenantSlug, handle }: { tenantSlug: string; handle: string }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/products/${encodeURIComponent(handle)}/questions?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ displayName: displayName || undefined, body }),
        }
      );
      const json = (await res.json().catch(() => null)) as
        | { success: true }
        | { success: false; error: { message: string } }
        | null;
      if (!res.ok || !json || json.success === false) {
        throw new Error(json?.success === false ? json.error.message : 'Could not submit.');
      }
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <SparxAlert color="success" role="status">
        Thanks for your question! It’ll appear once it’s answered.
      </SparxAlert>
    );
  }

  if (!open) {
    return (
      <SparxButton type="button" color="neutral" variant="outline" onClick={() => setOpen(true)}>
        Ask a question
      </SparxButton>
    );
  }

  return (
    <form onSubmit={submit} className="st-form">
      <label className="st-field">
        <span>Name (optional)</span>
        <SparxInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label className="st-field">
        <span>Your question</span>
        <SparxTextarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {error ? <SparxAlert color="danger">{error}</SparxAlert> : null}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <SparxButton type="button" color="neutral" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </SparxButton>
        <SparxButton type="submit" color="primary" disabled={state === 'busy'}>
          {state === 'busy' ? 'Submitting…' : 'Submit question'}
        </SparxButton>
      </div>
    </form>
  );
}
