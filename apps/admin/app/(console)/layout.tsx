import { ConfirmProvider, ModuleProvider } from '@sparx/ui';
import { requireOperator } from '@sparx/operator-auth/next';
import { ConsoleShell } from './_components/console-shell';

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
// `platform` hue so the active-module color resolves for chrome (the active nav
// underline); a tenant's own module signals use nested ModuleProviders.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const operator = await requireOperator();
  return (
    <ModuleProvider module="platform">
      <ConfirmProvider>
        <ConsoleShell email={operator.email} capabilities={operator.capabilities}>
          {children}
        </ConsoleShell>
      </ConfirmProvider>
    </ModuleProvider>
  );
}
