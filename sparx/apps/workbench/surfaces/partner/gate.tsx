'use client';

// Shared framing for the partner surfaces: the loading / error / not-a-partner
// states every one of them has to handle, in one place so they read identically.
//
// Two gates stack in the real product (docs/114 §B.7): the tenant must be a
// partner at all (the `partners` row — `profile !== null`), and the acting member
// must hold partner-operator access (owner/admin/partner — enforced server-side,
// surfaced here as a 403 on the money/ledger reads). The module only appears in
// the rail for partner tenants, so `not a partner` is a deep-link edge; it is
// handled rather than assumed away.

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { Award, Lock, ServerCrash } from 'lucide-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ApiError } from '@wizeworks/api-client';

/** A centred message that fills the pane — for the states where there is no list
 *  or form to show. Always inside a PANE_SHELL so the chrome matches a loaded
 *  pane rather than jumping. */
export function PartnerMessage({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={PANE_SHELL}>
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState icon={icon} title={title} description={description} actions={actions} />
      </div>
    </div>
  );
}

export function PartnerLoading() {
  return (
    <div className={PANE_SHELL}>
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    </div>
  );
}

/** True for the "you're a partner tenant but this member lacks operator access"
 *  case — a 403 from the PARTNER_OPS-gated routes. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** The shape a list surface renders when its own read fails. Distinguishes a
 *  refusal (403 — not a partner, or the acting member lacks partner access) from a
 *  real fault. On a 403 the server sends the exact reason ("This account is not a
 *  partner.") and that sentence is shown verbatim — it's the most specific true
 *  thing, and only the server can tell the two 403 reasons apart. */
export function PartnerLoadError({
  section,
  onRetry,
  error,
}: {
  section: string;
  onRetry: () => void;
  error: unknown;
}) {
  if (isForbidden(error)) {
    const reason =
      error instanceof ApiError && error.message.trim().length > 0 ? error.message : null;
    return (
      <PartnerMessage
        icon={<Lock className="size-6" aria-hidden />}
        title={`${section.charAt(0).toUpperCase()}${section.slice(1)} isn’t available on this account`}
        description={
          reason ??
          'This part of the partner programme is open to owners, admins and members with partner access.'
        }
      />
    );
  }
  return (
    <PartnerMessage
      icon={<ServerCrash className="size-6" aria-hidden />}
      title={`Could not load ${section}`}
      description="This is a problem reaching the server. Nothing about your partner account has changed — try again in a moment."
      actions={
        <Button size="sm" color="module" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Shown when the tenant isn't a partner at all (a deep link into a module its
 *  rail would normally hide). There is no in-app join surface — joining is an
 *  owner/admin application reviewed by sparx staff — so this explains rather than
 *  offering a dead button. */
export function NotAPartner({ section }: { section: string }) {
  return (
    <PartnerMessage
      icon={<Award className="size-6" aria-hidden />}
      title="This account isn’t a sparx partner"
      description={`${section} is part of the partner programme, for agencies and consultants who bring clients onto sparx. An owner or admin can apply to join from your account settings; once sparx approves it, this section fills in.`}
    />
  );
}
