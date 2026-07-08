'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRightLeft,
  Globe,
  Lock,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  Star,
  Trash2,
} from 'lucide-react';
import {
  Code,
  SelectionList,
  toast,
  useConfirm,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
} from 'silicaui-react';

import type { Domain, Property } from '@/lib/sites';
import {
  disconnectDomain,
  makeCanonical,
  renewDomain,
  toggleAutoRenew,
  togglePrivacy,
  transferOut,
  verifyDomain,
  type ActionResult,
} from '../actions';
import { domainStatus, formatDate, formatPrice, typeLabel } from '../_lib';

// The tenant's domain inventory on the shared `SelectionList` substrate
// (table/cards + `defaultListView`) — purchased, connected, and sparx-zone
// domains in one list. Per-domain registrar actions (verify, set-primary, renew,
// WHOIS privacy, auto-renew, transfer out, disconnect) live in a per-row actions
// menu; renew + DNS records + the transfer auth-code open small dialogs.

interface Props {
  domains: Domain[];
  properties: Property[];
  view: 'table' | 'card';
}

export function DomainsInventory({ domains, properties, view }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [renewing, setRenewing] = React.useState<Domain | null>(null);
  const [dnsFor, setDnsFor] = React.useState<Domain | null>(null);
  const [transferResult, setTransferResult] = React.useState<{
    host: string;
    authCode: string;
  } | null>(null);

  const propertyName = (id: string) => properties.find((p) => p.id === id)?.name;

  const run = React.useCallback(
    (action: () => Promise<ActionResult>, success?: string) => {
      startTransition(async () => {
        const res = await action();
        if (res.ok) {
          if (success) toast.success(success);
          router.refresh();
        } else {
          toast.error(res.error ?? 'Something went wrong.');
        }
      });
    },
    [router]
  );

  async function onDisconnect(d: Domain) {
    const ok = await confirm({
      title: `Disconnect ${d.host}?`,
      description:
        d.type === 'purchased'
          ? `This removes ${d.host} from your site. The registration is NOT cancelled — you'll still be billed for renewals. To cancel entirely, transfer the domain out first.`
          : `Traffic to ${d.host} will stop resolving to your site. This can't be undone.`,
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    run(() => disconnectDomain(d.id), `${d.host} disconnected.`);
  }

  async function onTransferOut(d: Domain) {
    const ok = await confirm({
      title: `Transfer out ${d.host}?`,
      description:
        'This generates an auth code to move your domain to another registrar. The domain is locked during transfer and leaves sparx hosting.',
      confirmLabel: 'Generate auth code',
      tone: 'warning',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await transferOut(d.id);
      if (res.ok && res.authCode) {
        setTransferResult({ host: d.host, authCode: res.authCode });
        router.refresh();
      } else {
        toast.error(res.error ?? 'Transfer-out failed.');
      }
    });
  }

  function actionsFor(d: Domain) {
    const isPurchased = d.type === 'purchased';
    const isCustom = d.type === 'custom';
    const isZone = d.type === 'subdomain';
    const isActive = d.status === 'active' || d.status === 'verified';
    const items: React.ReactNode[] = [];

    if (isCustom && !isActive && d.status !== 'transfer_pending') {
      items.push(
        <DropdownMenuItem
          key="verify"
          onClick={() => run(() => verifyDomain(d.id), `${d.host} verified.`)}
        >
          <RefreshCw className="h-4 w-4" /> Verify
        </DropdownMenuItem>
      );
    }
    if (d.instructions) {
      items.push(
        <DropdownMenuItem key="dns" onClick={() => setDnsFor(d)}>
          <Globe className="h-4 w-4" /> DNS records
        </DropdownMenuItem>
      );
    }
    if (isActive && !d.isCanonical) {
      items.push(
        <DropdownMenuItem
          key="primary"
          onClick={() => run(() => makeCanonical(d.id), `${d.host} is now the primary domain.`)}
        >
          <Star className="h-4 w-4" /> Set as primary domain
        </DropdownMenuItem>
      );
    }
    if (isPurchased) {
      items.push(
        <DropdownMenuItem key="renew" onClick={() => setRenewing(d)}>
          <RotateCcw className="h-4 w-4" /> Renew…
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="privacy"
          onClick={() =>
            run(
              () => togglePrivacy(d.id, !d.whoisPrivacy),
              d.whoisPrivacy ? 'WHOIS privacy disabled.' : 'WHOIS privacy enabled.'
            )
          }
        >
          {d.whoisPrivacy ? <ShieldOff className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {d.whoisPrivacy ? 'Disable WHOIS privacy' : 'Enable WHOIS privacy'}
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="autorenew"
          onClick={() =>
            run(
              () => toggleAutoRenew(d.id, !d.autoRenew),
              d.autoRenew ? 'Auto-renew disabled.' : 'Auto-renew enabled.'
            )
          }
        >
          <RefreshCw className="h-4 w-4" />{' '}
          {d.autoRenew ? 'Turn off auto-renew' : 'Turn on auto-renew'}
        </DropdownMenuItem>,
        <DropdownMenuItem key="transfer" onClick={() => void onTransferOut(d)}>
          <ArrowRightLeft className="h-4 w-4" /> Transfer out…
        </DropdownMenuItem>
      );
    }
    if (!isZone) {
      items.push(
        <DropdownMenuItem
          key="disconnect"
          className="text-[var(--color-danger-text)]"
          onClick={() => void onDisconnect(d)}
        >
          <Trash2 className="h-4 w-4" /> Disconnect
        </DropdownMenuItem>
      );
    }

    if (items.length === 0) {
      return <p className="text-base-content/70 text-sm">—</p>;
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="sm" aria-label={`Actions for ${d.host}`} disabled={pending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{items}</DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const hostCell = (d: Domain) => (
    <div className="flex min-w-0 flex-row items-center gap-2">
      <Globe className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{d.host}</p>
          {d.isCanonical && (
            <Badge color="module" variant="soft" size="sm">
              <Star className="h-3 w-3" /> Primary
            </Badge>
          )}
        </div>
        <p className="text-base-content/70 text-xs">{typeLabel(d)}</p>
      </div>
    </div>
  );

  const statusCell = (d: Domain) => {
    const s = domainStatus(d);
    return (
      <Badge color={s.color} variant="soft">
        {s.label}
      </Badge>
    );
  };

  const columns: SelectionColumn<Domain>[] = [
    { header: 'Domain', cell: hostCell },
    {
      header: 'Site',
      cell: (d) => (
        <p className="text-base-content/70 text-sm">{propertyName(d.propertyId) ?? '—'}</p>
      ),
    },
    { header: 'Status', cell: statusCell },
    {
      header: 'Expiry',
      cell: (d) => (
        <p className="text-base-content/70 text-sm">
          {d.type === 'purchased' && d.expiresAt ? formatDate(d.expiresAt) : '—'}
        </p>
      ),
    },
    { header: '', id: 'actions', align: 'right', cell: actionsFor },
  ];

  const card: SelectionCard<Domain> = {
    title: (d) => <p className="font-medium">{d.host}</p>,
    render: (d) => {
      const s = domainStatus(d);
      const site = propertyName(d.propertyId);
      return (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-start justify-between gap-2">
                {hostCell(d)}
                <Badge color={s.color} variant="soft">
                  {s.label}
                </Badge>
              </div>
              <div className="flex flex-row items-center justify-between gap-2">
                <p className="text-base-content/70 text-xs">
                  {site ?? '—'}
                  {d.type === 'purchased' && d.expiresAt
                    ? ` · expires ${formatDate(d.expiresAt)}`
                    : ''}
                </p>
                {actionsFor(d)}
              </div>
            </div>
          </CardBody>
        </Card>
      );
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {transferResult && (
        <div className="flex items-start gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-subtle)] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning-text)]" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">Transfer auth code for {transferResult.host}</p>
            <p className="text-base-content/70 text-sm">
              Copy this code and use it at your new registrar. It expires in 24 hours.
            </p>
            <Code>{transferResult.authCode}</Code>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 w-fit"
              onClick={() => setTransferResult(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <SelectionList
        items={domains}
        view={view}
        getId={(d) => d.id}
        getRowLabel={(d) => d.host}
        entityLabelPlural="domains"
        selectable={false}
        columns={columns}
        card={card}
      />

      {renewing && (
        <RenewDialog
          domain={renewing}
          pending={pending}
          onClose={() => setRenewing(null)}
          onRenew={(years) => {
            const d = renewing;
            run(
              () => renewDomain(d.id, years),
              `${d.host} renewed for ${years} year${years > 1 ? 's' : ''}.`
            );
            setRenewing(null);
          }}
        />
      )}

      {dnsFor && (
        <DnsDialog
          domain={dnsFor}
          pending={pending}
          onClose={() => setDnsFor(null)}
          onVerify={() => {
            const d = dnsFor;
            run(() => verifyDomain(d.id), `${d.host} verified.`);
            setDnsFor(null);
          }}
        />
      )}
    </div>
  );
}

function RenewDialog({
  domain,
  pending,
  onRenew,
  onClose,
}: {
  domain: Domain;
  pending: boolean;
  onRenew: (years: number) => void;
  onClose: () => void;
}) {
  const [years, setYears] = React.useState(1);
  const total = domain.renewalPriceCents ? formatPrice(domain.renewalPriceCents * years) : null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogTitle>Renew {domain.host}</DialogTitle>
        </div>
        <div className="px-6 pb-2">
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="renew-years">Years</Label>
              <Input
                id="renew-years"
                type="number"
                min={1}
                max={10}
                value={years}
                onChange={(e) => setYears(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-28"
              />
            </div>
            {total && <p className="text-base-content/70 text-sm">Total: {total}</p>}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 px-6 pb-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            disabled={pending}
            loading={pending}
            onClick={() => onRenew(years)}
            iconStart={<RotateCcw className="h-4 w-4" />}
          >
            Renew {years} yr
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DnsDialog({
  domain,
  pending,
  onVerify,
  onClose,
}: {
  domain: Domain;
  pending: boolean;
  onVerify: () => void;
  onClose: () => void;
}) {
  const inst = domain.instructions;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle>DNS records for {domain.host}</DialogTitle>
        </div>
        <div className="px-6 pb-2">
          <div className="flex flex-col gap-3">
            <p className="text-base-content/70 text-sm">
              Add these records at your registrar, then verify:
            </p>
            {inst && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="text-[var(--color-text-secondary)]">CNAME</span>
                <Code>
                  {inst.cname.name} → {inst.cname.value}
                </Code>
                {inst.txt && (
                  <>
                    <span className="text-[var(--color-text-secondary)]">TXT</span>
                    <Code>
                      {inst.txt.name} = {inst.txt.value}
                    </Code>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 px-6 pb-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            color="primary"
            disabled={pending}
            loading={pending}
            onClick={onVerify}
            iconStart={<RefreshCw className="h-4 w-4" />}
          >
            Verify now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
