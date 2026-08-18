'use client';

/**
 * "Was this page helpful?" — the per-page feedback control. For now it just
 * acknowledges the vote locally; wiring it to an analytics event (PostHog) is a
 * follow-up. Kept as its own client island so the surrounding article stays a
 * server component.
 */
import { useState } from 'react';

export function DocFeedback() {
  const [voted, setVoted] = useState<null | 'up' | 'down'>(null);

  if (voted) {
    return (
      <div className="docs-helpful">
        <span>Thanks for the feedback{voted === 'down' ? ' — we’ll improve this page.' : '!'}</span>
      </div>
    );
  }

  return (
    <div className="docs-helpful">
      <span>Was this page helpful?</span>
      <button type="button" onClick={() => setVoted('up')} aria-label="Yes, helpful">
        👍 Yes
      </button>
      <button type="button" onClick={() => setVoted('down')} aria-label="No, not helpful">
        👎 No
      </button>
    </div>
  );
}
