'use client';

// The loading, error and not-a-partner states every partner surface handles, in one
// place. Two gates stack (docs/114 §B.7): the tenant is a partner (`profile !== null`),
// and the member holds partner-operator access (a 403 on the money/ledger reads).

import { Card } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { faAward, faLock, faServer } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { ApiError } from '@wizeworks/api-client';
import { productCopy, productCopyWith } from '../../lib/product';

/** Registry module for these panes, so the brand draws one consistent picture
 *  across every partner state. */
const MODULE = 'partner';

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
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneEmpty
          module={MODULE}
          icon={icon}
          title={title}
          description={description}
          actions={actions}
        />
      </Card>
    </div>
  );
}

export function PartnerLoading() {
  return (
    <div className={PANE_SHELL}>
      {/* Same card <PartnerMessage> and every loaded partner pane use, so the
          pane does not gain a surface the moment its data lands. */}
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting module={MODULE} />
      </Card>
    </div>
  );
}

/** True for the "you're a partner tenant but this member lacks operator access"
 *  case — a 403 from the PARTNER_OPS-gated routes. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** What a list surface renders when its own read fails. A 403 shows the server's
 *  own reason verbatim: only the server can tell its two refusals apart. */
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
        icon={<Icon glyph={faLock} className="size-6" aria-hidden />}
        title={`${section.charAt(0).toUpperCase()}${section.slice(1)} isn’t available on this account`}
        description={
          reason ??
          'This part of the partner program is open to owners, admins and members with partner access.'
        }
      />
    );
  }
  // Not <PartnerMessage>: that shell draws the "nothing here yet" picture, and a
  // server that could not be reached is a failure, not an invitation.
  return (
    <div className={PANE_SHELL}>
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faServer} className="size-6" aria-hidden />}
          title={`Could not load ${section}`}
          description="This is a problem reaching the server. Nothing about your partner account has changed. Try again in a moment."
          error={error}
          onRetry={onRetry}
        />
      </Card>
    </div>
  );
}

/** The tenant isn't a partner at all (a deep link past the rail). Joining is an
 *  application reviewed by staff, so this explains rather than offering a dead button. */
export function NotAPartner({ section }: { section: string }) {
  return (
    <PartnerMessage
      icon={<Icon glyph={faAward} className="size-6" aria-hidden />}
      title={productCopy('partner.gate.title', 'This account isn’t a sparx partner')}
      description={productCopyWith(
        'partner.gate.description',
        `${section} is part of the partner program, for agencies and consultants who bring clients onto sparx. An owner or admin can apply to join from your account settings; once sparx approves it, this section fills in.`,
        { section }
      )}
    />
  );
}
