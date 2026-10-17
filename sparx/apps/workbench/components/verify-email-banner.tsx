'use client';

// "Confirm your email address", above the console, with a button that sends a
// new link (sparx persona issue 157). The old console had this notice; it went
// with it, and an owner who lost the one email sent at sign-up could not send
// to a list, buy a domain or connect payments, with nowhere to go. Not
// dismissible: those refusals do not go away either.

import { useState } from 'react';
import { Alert, Button } from '@wizeworks/silicaui-react';

import { useViewer } from '../lib/api/shell-data';
import { linkSentWords, verifyEmailNotice } from '../lib/verify-email/words';
import { sendConfirmLink } from '../app/verify-email/actions';

export function VerifyEmailBanner() {
  const { data: viewer } = useViewer();
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notice = verifyEmailNotice(viewer);
  if (!notice) return null;

  const send = async () => {
    setSending(true);
    setError(null);
    const result = await sendConfirmLink();
    setSending(false);
    if (result.ok) setSentTo(result.email ?? viewer?.email ?? '');
    else setError(result.error ?? 'The link didn’t send. Try again in a minute.');
  };

  return (
    <div className="px-2 pt-2">
      <Alert color={error ? 'danger' : 'warning'} variant="soft">
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1 basis-48">
            <span className="font-medium">{notice.title}</span>{' '}
            <span className="text-sm">
              {error ?? (sentTo !== null ? linkSentWords(sentTo) : notice.body)}
            </span>
          </div>
          <Button
            color="warning"
            size="xs"
            className="shrink-0"
            loading={sending}
            onClick={() => {
              void send();
            }}
          >
            {notice.action}
          </Button>
        </div>
      </Alert>
    </div>
  );
}
