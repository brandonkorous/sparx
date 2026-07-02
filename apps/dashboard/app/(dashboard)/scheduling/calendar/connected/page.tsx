export const dynamic = 'force-dynamic';

// OAuth callback landing (docs/79 §8.3). The provider redirects the browser here
// after consent with `?code&state` (or `?error` when the user declined). The server
// page reads the params and hands them to the client, which posts them back through
// the authed Server Action to finish the exchange — so this page itself stays trivial
// and the secret-bearing exchange happens server-side under the staff session.

import { CalendarConnectedClient } from './_components/calendar-connected-client';

export default async function CalendarConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>;
}) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <CalendarConnectedClient
        code={sp.code ?? null}
        state={sp.state ?? null}
        error={sp.error ?? sp.error_description ?? null}
      />
    </div>
  );
}
