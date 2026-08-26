'use client';

// What this broadcast will look like when it arrives.
//
// The server renders the real send — this broadcast's subject, a real person out
// of its own audience, and the unsubscribe footer a marketing send composes in —
// so what is on screen here is what lands in an inbox, not an approximation of
// it. The body goes into a sandboxed iframe: it is email HTML with its own
// styles, and letting that loose in the console would repaint the console.

import { Alert, AlertContent, AlertDescription, AlertTitle, Text } from '@wizeworks/silicaui-react';
import { useBroadcastPreview } from './broadcasts-data';

/** Why there is nothing to show yet, in the owner's terms. */
function notReadyMessage(reason: 'no-email' | 'not-published' | 'no-audience'): string {
  switch (reason) {
    case 'no-email':
      return 'Choose which of your designed emails this sends, and the preview appears here.';
    case 'not-published':
      return 'That design has not been published yet, so there is nothing to send. Open it in the email designer and publish it.';
    case 'no-audience':
      return 'Nobody is in this audience yet, so there is no one to preview it for.';
  }
}

/** The rendered email, in an isolated frame grown to fit its own content. */
function PreviewFrame({ html }: { html: string }) {
  const fit = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const height = frame.contentDocument?.body.scrollHeight;
    frame.style.height = `${String((height ?? 600) + 24)}px`;
  };

  return (
    <iframe
      title="What this email looks like"
      srcDoc={html}
      onLoad={fit}
      // No scripts, no forms, no navigation: this is somebody else's markup and
      // it only needs to be looked at.
      sandbox=""
      className="border-base-300 h-[600px] w-full rounded-lg border bg-white"
    />
  );
}

export function BroadcastPreview({ id, enabled }: { id: string; enabled: boolean }) {
  const preview = useBroadcastPreview(id, enabled);

  if (!enabled) {
    return (
      <Text className="text-sm">
        Save this broadcast and the preview of what your customers receive appears here.
      </Text>
    );
  }

  if (preview.isError) {
    return (
      <Alert color="warning">
        <AlertContent>
          <AlertTitle>Couldn’t build the preview</AlertTitle>
          <AlertDescription>
            We couldn’t put your email together just now. Try refreshing in a moment. Nothing has
            been sent.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  if (preview.isPending || !preview.data) {
    return (
      <Text className="text-sm" role="status">
        Putting your email together…
      </Text>
    );
  }

  if (!preview.data.ready) {
    return <Text className="text-sm">{notReadyMessage(preview.data.reason)}</Text>;
  }

  const { from, to, subject, html } = preview.data;
  return (
    <div className="flex flex-col gap-3">
      <dl className="border-base-300 grid gap-x-6 gap-y-2 rounded-lg border p-3 @md:grid-cols-2">
        <HeaderRow label="From" value={from} />
        <HeaderRow label="Shown to" value={to} />
        <HeaderRow label="Subject" value={subject} wide />
      </dl>
      <PreviewFrame html={html} />
    </div>
  );
}

function HeaderRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 ${wide ? '@md:col-span-2' : ''}`}>
      <dt className="text-sm">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}
