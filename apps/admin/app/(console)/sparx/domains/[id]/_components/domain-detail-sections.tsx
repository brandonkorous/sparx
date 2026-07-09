import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import {
  Badge,
  Card,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import type { OperatorDomainDetail, OperatorDomainDnsProbe } from '@sparx/operator';
import { formatDate, formatDateTime, formatMoneyCents } from '@/lib/format';
import { sslLabel, sslTone, verificationMethodLabel } from '@/lib/domains';

// The domain-detail sections — routing facts, SSL readiness, the registrar
// ledger, a live DNS diagnostic, and purchase history. All read-only; the only
// action (force re-verify) lives in the page header.

const rowClass = 'border-b border-base-300 pb-2 last:border-0';

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" align="center" justify="between" className="gap-4">
      <Text size="sm" variant="muted">
        {label}
      </Text>
      <span className="text-right text-sm">{value}</span>
    </Stack>
  );
}

export function RoutingCard({ domain }: { domain: OperatorDomainDetail }) {
  const propertyLabel = domain.property.name
    ? `${domain.property.name}${domain.property.slug ? ` (${domain.property.slug})` : ''}`
    : (domain.property.slug ?? '—');
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Routing</Heading>
        <Stack gap={2}>
          <Fact
            label="Tenant"
            value={
              <Link
                href={`/sparx/tenants/${domain.tenant.id}`}
                className="text-module font-medium hover:underline"
              >
                {domain.tenant.name}
              </Link>
            }
          />
          <Fact label="Site" value={propertyLabel} />
          <Fact label="Canonical" value={domain.isCanonical ? 'Yes — primary domain' : 'No'} />
          <Fact
            label="Ownership proof"
            value={verificationMethodLabel(domain.verificationMethod)}
          />
          <Fact label="Connected" value={formatDate(domain.createdAt) ?? '—'} />
          <Fact label="Verified" value={formatDate(domain.verifiedAt) ?? 'Not yet verified'} />
        </Stack>
      </Stack>
    </Card>
  );
}

export function SslCard({ domain }: { domain: OperatorDomainDetail }) {
  return (
    <Card>
      <Stack gap={3}>
        <Stack direction="row" align="center" justify="between">
          <Heading level={3}>SSL / TLS</Heading>
          <Badge color={sslTone(domain.sslStatus)} variant="soft">
            {sslLabel(domain.sslStatus)}
          </Badge>
        </Stack>
        <Text size="sm" variant="muted">
          {domain.sslStatus === 'secured'
            ? 'This host is authorized for HTTPS — its certificate is issued (and auto-renewed) on demand the first time it’s reached over TLS.'
            : domain.sslStatus === 'provisioning'
              ? 'DNS is still propagating. Once the domain resolves, it becomes authorized and its certificate issues automatically on the first HTTPS request.'
              : 'Not yet secured — the domain must finish verification before a certificate can be issued. Certificates are on-demand, so there is nothing to install manually.'}
        </Text>
      </Stack>
    </Card>
  );
}

export function RegistrarCard({ domain }: { domain: OperatorDomainDetail }) {
  return (
    <Card>
      <Stack gap={3}>
        <Stack direction="row" align="center" justify="between">
          <Heading level={3}>Registration</Heading>
          {domain.expiringSoon ? (
            <Badge color="warning" variant="soft">
              Expiring soon
            </Badge>
          ) : null}
        </Stack>
        <Stack gap={2}>
          <Fact label="Registrar" value={domain.registrar ?? '—'} />
          <Fact
            label="Order"
            value={
              domain.registrarOrderId ? (
                <span className="font-mono text-xs">{domain.registrarOrderId}</span>
              ) : (
                '—'
              )
            }
          />
          <Fact label="Registered" value={formatDate(domain.registeredAt) ?? '—'} />
          <Fact label="Expires" value={formatDate(domain.expiresAt) ?? '—'} />
          <Fact label="Auto-renew" value={domain.autoRenew ? 'On' : 'Off'} />
          <Fact label="WHOIS privacy" value={domain.whoisPrivacy ? 'On' : 'Off'} />
          <Fact
            label="Renewal price"
            value={
              domain.renewalPriceCents != null ? formatMoneyCents(domain.renewalPriceCents) : '—'
            }
          />
        </Stack>
      </Stack>
    </Card>
  );
}

export function DnsProbeCard({ probe }: { probe: OperatorDomainDnsProbe | null }) {
  return (
    <Card>
      <Stack gap={3}>
        <Stack direction="row" align="center" justify="between" className="flex-wrap gap-2">
          <Heading level={3}>DNS records</Heading>
          {probe ? (
            <Badge color={probe.allResolved ? 'success' : 'warning'} variant="soft">
              {probe.allResolved ? 'All resolving' : 'Not fully resolving'}
            </Badge>
          ) : null}
        </Stack>
        {!probe ? (
          <Text size="sm" variant="muted">
            This is an automatic sparx.zone address — its DNS is managed for the tenant, so there’s
            nothing to verify here.
          </Text>
        ) : (
          <Stack gap={3}>
            {probe.records.map((rec) => (
              <Stack key={`${rec.kind}:${rec.name}`} gap={2} className={rowClass}>
                <Stack direction="row" align="center" gap={2} className="flex-wrap">
                  <Badge variant="outline" size="sm">
                    {rec.kind}
                  </Badge>
                  <Text size="sm" className="font-mono break-all">
                    {rec.name}
                  </Text>
                  {rec.matches ? (
                    <Badge color="success" variant="soft" size="sm">
                      <Check className="mr-1 h-3 w-3" />
                      Resolved
                    </Badge>
                  ) : (
                    <Badge color="warning" variant="soft" size="sm">
                      <X className="mr-1 h-3 w-3" />
                      Not found
                    </Badge>
                  )}
                </Stack>
                <Stack gap={1}>
                  <Fact
                    label="Expected"
                    value={<span className="font-mono text-xs break-all">{rec.expected}</span>}
                  />
                  <Fact
                    label="Observed"
                    value={
                      rec.observed.length > 0 ? (
                        <span className="font-mono text-xs break-all">
                          {rec.observed.join(', ')}
                        </span>
                      ) : (
                        <Text size="xs" variant="muted">
                          Nothing at this record yet
                        </Text>
                      )
                    }
                  />
                </Stack>
              </Stack>
            ))}
            <Text size="xs" variant="muted">
              Live DNS lookup at {formatDateTime(probe.checkedAt)}.
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function PurchaseHistoryCard({ domain }: { domain: OperatorDomainDetail }) {
  return (
    <Card>
      <Stack gap={3}>
        <Heading level={3}>Purchase history</Heading>
        {domain.purchases.length === 0 ? (
          <Text variant="muted">
            {domain.type === 'purchased'
              ? 'No purchase records on file.'
              : 'This domain wasn’t bought through sparx, so there’s no registration billing to show.'}
          </Text>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domain.purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Text size="sm">{formatDate(p.createdAt)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" className="capitalize">
                      {p.type}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {p.years} {p.years === 1 ? 'yr' : 'yrs'}
                    </Text>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Text size="sm">{formatMoneyCents(p.amountCents)}</Text>
                  </TableCell>
                  <TableCell>
                    <Badge
                      color={
                        p.status === 'completed'
                          ? 'success'
                          : p.status === 'failed'
                            ? 'danger'
                            : 'warning'
                      }
                      variant="soft"
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.registrarOrderId ? (
                      <Text size="xs" variant="muted" className="font-mono">
                        {p.registrarOrderId}
                      </Text>
                    ) : (
                      <Text size="xs" variant="muted">
                        —
                      </Text>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}
