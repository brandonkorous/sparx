'use client';

// The result of pressing the confirm-your-email link (sparx persona issue 157):
// confirmed, with the way back into the console; or not, with a new link.

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Alert, Button, Text } from '@wizeworks/silicaui-react';

import { AuthShell } from '../../components/auth-shell';
import { linkSentWords, verifyLandingWords } from '../../lib/verify-email/words';
import { sendConfirmLink } from './actions';

export function VerifyEmailResult({
  verified,
  error,
}: {
  verified: boolean;
  error: string | null;
}) {
  const words = verifyLandingWords({ verified, error });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setFailure(null);
    const result = await sendConfirmLink();
    setSending(false);
    if (result.ok) setSent(linkSentWords(result.email ?? 'your address'));
    else setFailure(result.error ?? 'The link didn’t send. Try again in a minute.');
  };

  return (
    <AuthShell
      tabs={[{ id: 'confirm', label: 'Confirm your email', icon: MailCheck }]}
      activeTab="confirm"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{words.title}</h2>
          <Text className="text-sm">{words.body}</Text>
        </div>
        {sent ? (
          <Alert color="success" variant="soft" role="status">
            {sent}
          </Alert>
        ) : null}
        {failure ? (
          <Alert color="danger" variant="soft" role="alert">
            {failure}
          </Alert>
        ) : null}
        {words.confirmed ? (
          <Button color="primary" render={<Link href="/" />}>
            Go to your console
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              color="primary"
              loading={sending}
              onClick={() => {
                void send();
              }}
            >
              Send a new link
            </Button>
            <Button variant="outline" render={<Link href="/" />}>
              Go to your console
            </Button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
