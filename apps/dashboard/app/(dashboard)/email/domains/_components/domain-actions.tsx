'use client';

import { useTransition } from 'react';
import { RefreshCw, Star, Trash2 } from 'lucide-react';
import { toast, useConfirm } from '@sparx/ui';
import { Button } from 'silicaui-react';

import { removeDomainAction, setDefaultDomainAction, verifyDomainAction } from '../actions';
import type { SendingDomainRow } from '../../_lib/types';

// Per-domain action cluster (Verify / Make default / Remove) shared by both the
// card view (DomainCard) and the table view (DomainTableRow) so the two never
// diverge. Each button forwards to the same server action.

export function DomainActions({ domain }: { domain: SendingDomainRow }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  function verify() {
    startTransition(async () => {
      const result = await verifyDomainAction(domain.id);
      if (result.ok) {
        if (result.data.state === 'verified') toast.success(`${domain.domain} is verified.`);
        else toast.message('DNS not detected yet — try again after records propagate.');
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function makeDefault() {
    startTransition(async () => {
      const result = await setDefaultDomainAction(domain.id);
      if (result.ok) toast.success(`${domain.domain} is now the default sender.`);
      else toast.error(result.error.message);
    });
  }

  function onRemove() {
    void (async () => {
      const ok = await confirm({
        title: `Remove ${domain.domain}?`,
        description:
          'This removes the domain from Mailgun and sparx. Email can no longer be sent from it until you add and verify it again.',
        confirmLabel: 'Remove domain',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await removeDomainAction(domain.id);
        if (result.ok) toast.success(`${domain.domain} removed.`);
        else toast.error(result.error.message);
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {domain.state !== 'verified' ? (
        <Button color="module" size="sm" onClick={verify} loading={pending} disabled={pending}>
          <RefreshCw className="h-3.5 w-3.5" />
          Verify
        </Button>
      ) : null}
      {domain.state === 'verified' && !domain.isDefault ? (
        <Button color="module" variant="outline" size="sm" onClick={makeDefault} disabled={pending}>
          <Star className="h-3.5 w-3.5" />
          Make default
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Remove domain"
        disabled={pending}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
