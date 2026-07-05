import Link from 'next/link';
import { ConfirmProvider, ModuleProvider, Stack, Text, Toaster, Wordmark } from '@sparx/ui';
import { requireOperator } from '@sparx/operator-auth/next';
import { SignOutButton } from './_components/sign-out-button';
import { ConsoleNav } from './_components/console-nav';

// The entire authenticated console renders per-request, never at build time:
// requireOperator() reads the session cookie and constructs the operator Better
// Auth instance, which requires OPERATOR_AUTH_SECRET. That secret only exists in
// the running pod, so prerendering `/` during `next build` throws. force-dynamic
// on this segment layout cascades to every route beneath it.
export const dynamic = 'force-dynamic';

// The authenticated shell. requireOperator() redirects to /sign-in when there is
// no operator session — so every route under (console) is gated. Capability
// gating is per-surface (requireCapability) in the individual pages; the nav also
// hides sections the operator can't enter. The whole console wears the neutral
// `platform` hue so `--module-active` resolves for chrome (the active nav
// underline); a tenant's own module signals use nested ModuleProviders.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const operator = await requireOperator();
  return (
    <ModuleProvider module="platform">
      <ConfirmProvider>
        <div className="min-h-dvh">
          <header className="border-border border-b px-6">
            <div className="flex items-center justify-between py-3">
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
            </div>
            <ConsoleNav capabilities={operator.capabilities} />
          </header>
          <main className="mx-auto max-w-6xl p-6">{children}</main>
        </div>
        <Toaster />
      </ConfirmProvider>
    </ModuleProvider>
  );
}
