'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Code,
  Input,
  Label,
  Skeleton,
  Spinner,
  Stack,
  Switch,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  Clock,
  ExternalLink,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldOff,
  Star,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import type { Domain, Property } from '@/lib/sites';
import {
  disconnectDomain,
  makeCanonical,
  renewDomain,
  searchDomains,
  toggleAutoRenew,
  togglePrivacy,
  transferOut,
  verifyDomain,
  type ActionResult,
  type DomainSuggestion,
  type PurchaseResult,
} from './actions';
import { PurchaseDialog } from './purchase-dialog';

export interface DomainsManagerProps {
  properties: Property[];
  domains: Domain[];
  /** Is buying a new domain open yet? Off until tenant billing (Stripe) lands —
   *  search + connect stay live; the buy action shows "checkout opens soon". */
  purchaseEnabled: boolean;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface StatusInfo {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'neutral';
}

function domainStatus(d: Domain): StatusInfo {
  // Expiry takes highest priority for purchased domains
  if (d.type === 'purchased' && d.expiresAt) {
    const days = daysUntil(d.expiresAt);
    if (days !== null && days <= 7) {
      return { label: `Expires in ${Math.max(1, days)}d`, color: 'danger' };
    }
    if (days !== null && days <= 30) {
      return { label: 'Expiring soon', color: 'warning' };
    }
  }
  if (d.status === 'active' || d.status === 'verified')
    return { label: 'Active', color: 'success' };
  if (d.status === 'pending_ssl') return { label: 'SSL provisioning', color: 'warning' };
  if (d.status === 'verifying') return { label: 'Pending DNS', color: 'warning' };
  if (d.status === 'pending') return { label: 'Pending DNS', color: 'warning' };
  if (d.status === 'failed') return { label: 'Verification failed', color: 'danger' };
  if (d.status === 'transfer_pending') return { label: 'Transfer pending', color: 'neutral' };
  return { label: d.status, color: 'neutral' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── DomainRow ────────────────────────────────────────────────────────────────

interface DomainRowProps {
  domain: Domain;
  propertyName: string | undefined;
  pending: boolean;
  onAction: (action: () => Promise<ActionResult>, success?: string) => void;
  onConfirmAction: (opts: {
    title: string;
    description: string;
    confirmLabel: string;
    tone?: 'danger' | 'warning';
    action: () => Promise<ActionResult>;
    success?: string;
  }) => Promise<void>;
  onRenew: (domain: Domain) => void;
  onTransferOut: (domain: Domain) => void;
}

function DomainRow({
  domain: d,
  propertyName,
  pending,
  onAction,
  onConfirmAction,
  onRenew,
  onTransferOut,
}: DomainRowProps) {
  const status = domainStatus(d);
  const isPurchased = d.type === 'purchased';
  const isCustom = d.type === 'custom';
  const isZone = d.type === 'subdomain';
  const isActive = d.status === 'active' || d.status === 'verified';
  const days = d.expiresAt ? daysUntil(d.expiresAt) : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
      {/* Domain + badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="size-4 shrink-0 text-[var(--color-text-secondary)]" />
        <span className="font-medium">{d.host}</span>
        <Badge color={status.color} variant="soft">
          {status.label}
        </Badge>
        {isZone && (
          <Badge color="neutral" variant="soft" size="sm">
            sparx zone
          </Badge>
        )}
        {isPurchased && (
          <Badge color="neutral" variant="soft" size="sm">
            Purchased
          </Badge>
        )}
        {isCustom && (
          <Badge color="neutral" variant="soft" size="sm">
            Connected
          </Badge>
        )}
        {d.isCanonical && (
          <Badge color="primary" variant="soft">
            <Star className="size-3" /> Canonical
          </Badge>
        )}
        {propertyName && (
          <Text size="sm" variant="muted" className="ml-auto">
            {propertyName}
          </Text>
        )}
      </div>

      {/* Expiry + registration info for purchased */}
      {isPurchased && (d.expiresAt != null || d.registeredAt != null) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {d.registeredAt && (
            <Text size="sm" variant="muted">
              Registered {formatDate(d.registeredAt)}
            </Text>
          )}
          {d.expiresAt && (
            <Text
              size="sm"
              variant={days !== null && days <= 30 ? 'default' : 'muted'}
              className={days !== null && days <= 7 ? 'text-[var(--color-danger-text)]' : undefined}
            >
              <CalendarClock className="mr-1 inline size-3.5" />
              Expires {formatDate(d.expiresAt)}
              {days !== null && days <= 30 ? ` (${days}d)` : ''}
            </Text>
          )}
          {d.renewalPriceCents && (
            <Text size="sm" variant="muted">
              Renewal {formatPrice(d.renewalPriceCents)}/yr
            </Text>
          )}
        </div>
      )}

      {/* DNS instructions for unverified custom domains */}
      {d.instructions && (
        <div className="rounded-md bg-[var(--color-bg-subtle)] p-3">
          <Text size="sm" variant="muted" className="mb-2">
            Add these DNS records at your registrar, then click Verify:
          </Text>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <span className="text-[var(--color-text-secondary)]">CNAME</span>
            <Code>
              {d.instructions.cname.name} → {d.instructions.cname.value}
            </Code>
            {d.instructions.txt && (
              <>
                <span className="text-[var(--color-text-secondary)]">TXT</span>
                <Code>
                  {d.instructions.txt.name} = {d.instructions.txt.value}
                </Code>
              </>
            )}
          </div>
        </div>
      )}

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Verify — custom pending/failed */}
        {isCustom && !isActive && d.status !== 'transfer_pending' && (
          <Button
            size="sm"
            variant="soft"
            color="primary"
            disabled={pending}
            onClick={() => onAction(() => verifyDomain(d.id), `${d.host} verified successfully.`)}
          >
            <RefreshCw className="size-3.5" /> Verify
          </Button>
        )}

        {/* Make canonical — active, not already canonical */}
        {isActive && !d.isCanonical && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              onAction(() => makeCanonical(d.id), `${d.host} is now the canonical address.`)
            }
          >
            <Star className="size-3.5" /> Make canonical
          </Button>
        )}

        {/* Purchased-only actions */}
        {isPurchased && (
          <>
            <Button
              size="sm"
              variant="soft"
              color="primary"
              disabled={pending}
              onClick={() => onRenew(d)}
            >
              <RotateCcw className="size-3.5" /> Renew
            </Button>

            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                onAction(
                  () => togglePrivacy(d.id, !d.whoisPrivacy),
                  d.whoisPrivacy ? 'WHOIS privacy disabled.' : 'WHOIS privacy enabled.'
                )
              }
              title={d.whoisPrivacy ? 'Disable WHOIS privacy' : 'Enable WHOIS privacy'}
            >
              {d.whoisPrivacy ? (
                <>
                  <Lock className="size-3.5" /> Privacy on
                </>
              ) : (
                <>
                  <ShieldOff className="size-3.5" /> Privacy off
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              disabled={pending || d.status === 'transfer_pending'}
              onClick={() => onTransferOut(d)}
            >
              <ArrowRightLeft className="size-3.5" /> Transfer out
            </Button>
          </>
        )}

        {/* Purchased: auto-renew toggle (rightmost) */}
        {isPurchased && (
          <div className="ml-auto flex items-center gap-2">
            <Text size="sm" variant="muted">
              Auto-renew
            </Text>
            <Switch
              checked={d.autoRenew}
              disabled={pending}
              onCheckedChange={(v) =>
                onAction(
                  () => toggleAutoRenew(d.id, v),
                  v ? 'Auto-renew enabled.' : 'Auto-renew disabled.'
                )
              }
            />
          </div>
        )}

        {/* Disconnect — custom/purchased (not zone subdomains) */}
        {!isZone && (
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            className={isPurchased ? '' : 'ml-auto'}
            disabled={pending}
            onClick={() =>
              void onConfirmAction({
                title: `Disconnect ${d.host}?`,
                description: isPurchased
                  ? `This removes ${d.host} from your site. The domain registration with GoDaddy is NOT cancelled — you will still be billed for renewals. To cancel the registration entirely, transfer the domain out first.`
                  : `Traffic to ${d.host} will stop resolving to your site. This can't be undone.`,
                confirmLabel: 'Disconnect',
                tone: 'danger',
                action: () => disconnectDomain(d.id),
                success: `${d.host} disconnected.`,
              })
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── RenewPanel ──────────────────────────────────────────────────────────────

interface RenewPanelProps {
  domain: Domain;
  pending: boolean;
  onRenew: (years: number) => void;
  onClose: () => void;
}

function RenewPanel({ domain, pending, onRenew, onClose }: RenewPanelProps) {
  const [years, setYears] = React.useState(1);
  const total = domain.renewalPriceCents ? formatPrice(domain.renewalPriceCents * years) : 'N/A';

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] p-4">
      <Text weight="medium" className="mb-3">
        Renew {domain.host}
      </Text>
      <Stack gap={3}>
        <div className="flex items-center gap-3">
          <Label htmlFor="renew-years" className="w-20 shrink-0">
            Years
          </Label>
          <Input
            id="renew-years"
            type="number"
            min={1}
            max={10}
            value={years}
            onChange={(e) => setYears(Math.max(1, Math.min(10, Number(e.target.value))))}
            className="w-24"
          />
          {domain.renewalPriceCents && (
            <Text size="sm" variant="muted">
              Total: {total}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" color="primary" disabled={pending} onClick={() => onRenew(years)}>
            {pending ? <Spinner className="size-3.5" /> : <RotateCcw className="size-3.5" />}
            Renew {years}yr
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Stack>
    </div>
  );
}

// ─── SearchResults ────────────────────────────────────────────────────────────

interface SearchResultsProps {
  suggestions: DomainSuggestion[];
  purchaseEnabled: boolean;
  onSelect: (suggestion: DomainSuggestion) => void;
}

function SearchResults({ suggestions, purchaseEnabled, onSelect }: SearchResultsProps) {
  if (suggestions.length === 0) {
    return (
      <Text size="sm" variant="muted" className="py-2">
        No suggestions found for that query.
      </Text>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {suggestions.map((s) => (
        <div
          key={s.domain}
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-4 py-3"
        >
          <Stack gap={1}>
            <Text weight="medium" size="sm">
              {s.domain}
            </Text>
            <Text size="sm" variant="muted">
              {formatPrice(s.displayPrice)}/yr
            </Text>
          </Stack>
          {!s.available ? (
            <Badge color="neutral" variant="soft">
              Taken
            </Badge>
          ) : purchaseEnabled ? (
            <Button size="sm" color="primary" onClick={() => onSelect(s)}>
              <Plus className="size-3.5" /> Buy
            </Button>
          ) : (
            <Badge color="neutral" variant="soft">
              <Clock className="size-3" /> Soon
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DomainsManager({ properties, domains, purchaseEnabled }: DomainsManagerProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  // Search state
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<DomainSuggestion[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Purchase dialog
  const [selectedSuggestion, setSelectedSuggestion] = React.useState<DomainSuggestion | null>(null);

  // Inline renew panel
  const [renewingId, setRenewingId] = React.useState<string | null>(null);

  // Transfer-out auth code display
  const [transferResult, setTransferResult] = React.useState<{
    host: string;
    authCode: string;
  } | null>(null);

  const propertyById = React.useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  // Run a server action, toast the result, and refresh.
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

  const confirmAction = React.useCallback(
    async (opts: {
      title: string;
      description: string;
      confirmLabel: string;
      tone?: 'danger' | 'warning';
      action: () => Promise<ActionResult>;
      success?: string;
    }) => {
      const ok = await confirm({
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel,
        tone: opts.tone,
      });
      if (!ok) return;
      run(opts.action, opts.success);
    },
    [confirm, run]
  );

  // Debounced domain search
  const handleQueryChange = React.useCallback((value: string) => {
    setQuery(value);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        const res = await searchDomains(value.trim());
        setSearching(false);
        if (res.ok) {
          setSuggestions(res.data ?? []);
        } else {
          setSearchError(res.error ?? 'Search failed.');
        }
      })();
    }, 300);
  }, []);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRenew = React.useCallback((domain: Domain) => {
    setRenewingId(domain.id);
  }, []);

  const handleRenewSubmit = React.useCallback(
    (domain: Domain, years: number) => {
      run(
        () => renewDomain(domain.id, years),
        `${domain.host} renewed for ${years} year${years > 1 ? 's' : ''}.`
      );
      setRenewingId(null);
    },
    [run]
  );

  const handleTransferOut = React.useCallback(
    async (domain: Domain) => {
      const ok = await confirm({
        title: `Transfer out ${domain.host}?`,
        description:
          'This will generate an auth code to transfer your domain to another registrar. The domain will be locked during transfer. This removes it from sparx hosting.',
        confirmLabel: 'Generate auth code',
        tone: 'warning',
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await transferOut(domain.id);
        if (res.ok && res.authCode) {
          setTransferResult({ host: domain.host, authCode: res.authCode });
          router.refresh();
        } else {
          toast.error(res.error ?? 'Transfer-out failed.');
        }
      });
    },
    [confirm, router]
  );

  const handlePurchaseSuccess = React.useCallback(
    (_result: PurchaseResult) => {
      router.refresh();
    },
    [router]
  );

  // Partition domains by type
  const purchased = domains.filter((d) => d.type === 'purchased');
  const custom = domains.filter((d) => d.type === 'custom');
  const zone = domains.filter((d) => d.type === 'subdomain');

  return (
    <Stack gap={6}>
      {/* ── Transfer-out auth code ─────────────────────────────────────────── */}
      {transferResult && (
        <div className="flex items-start gap-3 rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-subtle)] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-warning-text)]" />
          <Stack gap={1}>
            <Text weight="medium">Transfer auth code for {transferResult.host}</Text>
            <Text size="sm" variant="muted">
              Copy this code and use it at your new registrar. It expires in 24 hours.
            </Text>
            <Code>{transferResult.authCode}</Code>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 w-fit"
              onClick={() => setTransferResult(null)}
            >
              Dismiss
            </Button>
          </Stack>
        </div>
      )}

      {/* ── Purchased domains ──────────────────────────────────────────────── */}
      {purchased.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Purchased domains</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={3}>
              {purchased.map((d) => (
                <React.Fragment key={d.id}>
                  <DomainRow
                    domain={d}
                    propertyName={propertyById.get(d.propertyId)?.name}
                    pending={pending}
                    onAction={run}
                    onConfirmAction={confirmAction}
                    onRenew={handleRenew}
                    onTransferOut={(dom) => void handleTransferOut(dom)}
                  />
                  {renewingId === d.id && (
                    <RenewPanel
                      domain={d}
                      pending={pending}
                      onRenew={(years) => handleRenewSubmit(d, years)}
                      onClose={() => setRenewingId(null)}
                    />
                  )}
                </React.Fragment>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Connected custom domains ───────────────────────────────────────── */}
      {custom.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Connected domains</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/settings/sites">
                <ExternalLink className="size-3.5" /> Manage in Sites
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Stack gap={3}>
              {custom.map((d) => (
                <DomainRow
                  key={d.id}
                  domain={d}
                  propertyName={propertyById.get(d.propertyId)?.name}
                  pending={pending}
                  onAction={run}
                  onConfirmAction={confirmAction}
                  onRenew={handleRenew}
                  onTransferOut={(dom) => void handleTransferOut(dom)}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── sparx zone subdomains ──────────────────────────────────────────── */}
      {zone.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>sparx zone addresses</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap={2}>
              {zone.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-3"
                >
                  <Globe className="size-4 text-[var(--color-text-secondary)]" />
                  <span className="font-medium">{d.host}</span>
                  <Badge color="success" variant="soft" size="sm">
                    Active
                  </Badge>
                  <Badge color="neutral" variant="soft" size="sm">
                    Always on
                  </Badge>
                  {d.isCanonical && (
                    <Badge color="primary" variant="soft">
                      <Star className="size-3" /> Canonical
                    </Badge>
                  )}
                  {propertyById.get(d.propertyId) && (
                    <Text size="sm" variant="muted" className="ml-auto">
                      {propertyById.get(d.propertyId)?.name}
                    </Text>
                  )}
                </div>
              ))}
              <Text size="sm" variant="muted" className="pt-1">
                These addresses are permanent and cannot be removed. Connect a custom domain or
                purchase one below to use your own address.
              </Text>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {domains.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] py-12 text-center">
          <Globe className="mx-auto mb-3 size-8 text-[var(--color-text-secondary)]" />
          <Text weight="medium">No domains yet</Text>
          <Text size="sm" variant="muted" className="mt-1">
            Purchase a new domain below, or connect one you already own in{' '}
            <Link href="/settings/sites" className="underline">
              Sites
            </Link>
            .
          </Text>
        </div>
      )}

      {/* ── Find a new domain ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Find a new domain</CardTitle>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            {!purchaseEnabled && (
              <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--color-bg-subtle)] px-4 py-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-[var(--color-text-secondary)]" />
                <Text size="sm" variant="muted">
                  <strong className="font-medium text-[var(--color-text)]">
                    Checkout opens soon.
                  </strong>{' '}
                  Search and pricing are live, but buying a new domain isn&apos;t open yet. In the
                  meantime, connect a domain you already own from{' '}
                  <Link href="/settings/sites" className="underline">
                    Sites
                  </Link>
                  .
                </Text>
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <Input
                  placeholder="Search for a domain (e.g. acmeparts.com)"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searching && <Spinner className="mt-2 size-5 shrink-0" />}
            </div>

            {searchError && (
              <Text size="sm" className="text-[var(--color-danger-text)]">
                {searchError}
              </Text>
            )}

            {/* Skeleton while searching */}
            {searching && (
              <div className="grid gap-2 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            )}

            {/* Results */}
            {!searching && suggestions !== null && (
              <SearchResults
                suggestions={suggestions}
                purchaseEnabled={purchaseEnabled}
                onSelect={(s) => setSelectedSuggestion(s)}
              />
            )}

            {/* Hint */}
            {!query && (
              <Text size="sm" variant="muted">
                Already have a domain? You can connect it from{' '}
                <Link href="/settings/sites" className="underline">
                  Settings → Sites
                </Link>
                .
              </Text>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* ── Purchase dialog ────────────────────────────────────────────────── */}
      <PurchaseDialog
        open={selectedSuggestion !== null}
        onClose={() => setSelectedSuggestion(null)}
        suggestion={selectedSuggestion}
        properties={properties}
        onSuccess={handlePurchaseSuccess}
      />
    </Stack>
  );
}
