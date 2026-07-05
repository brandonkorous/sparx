import Link from 'next/link';
import { Stack, Text, Wordmark } from '@sparx/ui';
import { requireOperator } from '@sparx/operator-auth/next';
import { SignOutButton } from './_components/sign-out-button';

// The authenticated shell. requireOperator() redirects to /sign-in when there is
// no operator session — so every route under (console) is gated. Capability
// gating is per-surface (requireCapability) in the individual pages.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const operator = await requireOperator();
  return (
    <div className="min-h-dvh">
      <header className="border-border flex items-center justify-between border-b px-6 py-3">
        <Stack direction="row" align="center" gap={3}>
          <Link href="/">
            <Wordmark size={22} />
          </Link>
          <Text size="sm" variant="muted">
            Operator Console
          </Text>
        </Stack>
        <Stack direction="row" align="center" gap={3}>
          <Text size="sm" variant="muted">
            {operator.email}
          </Text>
          <SignOutButton />
        </Stack>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
