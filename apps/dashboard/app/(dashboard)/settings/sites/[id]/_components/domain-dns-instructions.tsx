'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, toast } from '@sparx/ui';
import { Badge, Button, Input } from '@wizeworks/silicaui-react';

import type { Domain } from '@/lib/sites';

// DNS setup guidance for a custom domain, written for a non-technical business
// owner — no jargon assumed. It stays available AFTER a domain is verified (the
// api-rest view keeps returning the routing CNAME) so an owner can re-check or
// re-enter the record at their provider if it ever gets removed. Pending domains
// open expanded (there's an action to take); connected domains stay collapsed
// behind a "DNS records" disclosure (reference only).

/** A labelled, read-only value with a one-click Copy — the pattern people expect
 *  for "copy this into your provider". Click also selects all for manual copy. */
function CopyField({ label, hint, value }: { label: string; hint?: string; value: string }) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = React.useCallback(() => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        toast.success('Copied to clipboard');
      },
      () => toast.error('Could not copy — select the text and copy it manually.')
    );
  }, [value]);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content/70 text-xs">
        {label}
        {hint ? <span className="text-base-content/50"> — {hint}</span> : null}
      </p>
      <div className="flex flex-row items-center gap-2">
        <Input
          readOnly
          value={value}
          aria-label={label}
          className="font-mono text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          size="sm"
          variant="soft"
          onClick={onCopy}
          className="shrink-0"
          iconStart={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

/** One DNS record, as a self-contained card: what it's for, its type, and the two
 *  fields the owner pastes into their provider. */
function RecordCard({
  purpose,
  type,
  name,
  value,
}: {
  purpose: string;
  type: string;
  name: string;
  value: string;
}) {
  return (
    <div className="border-base-300 bg-base-200 rounded-md border p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-sm font-medium">{purpose}</p>
          <Badge variant="outline" size="sm" className="shrink-0 font-mono">
            {type}
          </Badge>
        </div>
        <CopyField label="Name" hint="some providers call this Host" value={name} />
        <CopyField label="Value" hint="some call this Target or Points to" value={value} />
      </div>
    </div>
  );
}

export function DomainDnsInstructions({
  domain,
  onReverify,
  verifying,
}: {
  domain: Domain;
  /** Mint a fresh verification record (apex custom domains whose token is spent). */
  onReverify?: () => void;
  verifying?: boolean;
}) {
  const dns = domain.instructions;
  // Subdomains + purchased domains are wired up automatically — nothing to show.
  if (!dns) return null;

  const isConnected = domain.status === 'active' || domain.status === 'verified';
  const hasTokenToAdd = Boolean(dns.txt); // a live TXT record the owner must add
  const setupMode = hasTokenToAdd || !isConnected; // there's a DNS action to take
  const recordCount = hasTokenToAdd ? 2 : 1;
  // Offer a fresh verification record only when the original is gone: an apex
  // custom domain that's connected and has no live token to add right now.
  const canReissue = Boolean(onReverify) && domain.verifiesByTxt && isConnected && !hasTokenToAdd;

  const triggerLabel = !setupMode
    ? 'DNS records'
    : isConnected
      ? 'Re-verify ownership — add the new record'
      : `Finish connecting — add your DNS ${recordCount > 1 ? 'records' : 'record'}`;

  return (
    <Accordion
      type="single"
      collapsible
      variant="ghost"
      defaultValue={setupMode ? ['dns'] : []}
      className="border-base-300 border-t pt-1"
    >
      <AccordionItem value="dns">
        <AccordionTrigger className="text-sm font-medium">{triggerLabel}</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-4 pt-1">
            {setupMode ? (
              <div className="flex flex-col gap-2">
                <p className="text-base-content/70 text-sm">
                  Add the {recordCount > 1 ? 'records' : 'record'} below wherever{' '}
                  <strong className="text-base-content font-medium">{domain.host}</strong> is
                  managed, then press <strong className="font-medium">Verify</strong>:
                </p>
                <ol className="text-base-content/70 list-decimal space-y-1.5 pl-5 text-sm">
                  <li>
                    Sign in to your <strong className="font-medium">domain provider</strong> — the
                    company you bought this domain from (GoDaddy, Namecheap, Cloudflare, Google
                    Domains, and the like).
                  </li>
                  <li>
                    Open its <strong className="font-medium">DNS</strong> settings (sometimes
                    labelled “DNS management” or “Manage DNS”).
                  </li>
                  <li>
                    Add the {recordCount > 1 ? 'records' : 'record'} below, copying each value
                    exactly as shown.
                  </li>
                  <li>
                    Save, then come back and press <strong className="font-medium">Verify</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <p className="text-base-content/70 text-sm">
                <strong className="text-base-content font-medium">{domain.host}</strong> is
                connected using the record below. Leave it in place at your domain provider — if
                this site ever stops loading on this address, sign in and make sure the record still
                matches (you can re-enter it from here).
              </p>
            )}

            <div className="flex flex-col gap-3">
              <RecordCard
                purpose="Points your domain to this site"
                type="CNAME"
                name={dns.cname.name}
                value={dns.cname.value}
              />
              {dns.txt && (
                <RecordCard
                  purpose="Confirms you own this domain"
                  type="TXT"
                  name={dns.txt.name}
                  value={dns.txt.value}
                />
              )}
            </div>

            {canReissue && (
              <div className="flex flex-col gap-1">
                <p className="text-base-content/70 text-xs">
                  Lost the verification record, or need to prove ownership again?
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="soft"
                  onClick={onReverify}
                  disabled={verifying}
                  loading={verifying}
                  className="self-start"
                >
                  Request a new verification record
                </Button>
              </div>
            )}

            <p className="text-base-content/70 text-xs">
              DNS changes usually take a few minutes to take effect — occasionally up to a few
              hours.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
