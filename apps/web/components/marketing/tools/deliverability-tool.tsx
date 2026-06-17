'use client';

import * as React from 'react';
import { Check, X, AlertTriangle, Search } from 'lucide-react';
import { Button, Input, NativeSelect, Badge, Spinner } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { lookupTxt, cleanDomain } from './lib/dns';

type Status = 'found' | 'missing' | 'error' | 'skip';
interface CheckResult {
  status: Status;
  record?: string;
  error?: string;
}
type Results = { spf: CheckResult; dkim: CheckResult; dmarc: CheckResult } | null;

const SPF_PROVIDERS: Record<string, string> = {
  google: 'include:_spf.google.com',
  microsoft: 'include:spf.protection.outlook.com',
  sendgrid: 'include:sendgrid.net',
  mailgun: 'include:mailgun.org',
  custom: '',
};

function classify(records: string[] | null, error: string | undefined, re: RegExp): CheckResult {
  if (records === null) return { status: 'skip' };
  if (error) return { status: 'error', error };
  const rec = records.find((r) => re.test(r));
  return rec ? { status: 'found', record: rec } : { status: 'missing' };
}

function ResultRow({ label, full, result }: { label: string; full: string; result: CheckResult }) {
  const map = {
    found: { color: 'success' as const, icon: <Check className="h-3.5 w-3.5" />, text: 'Found' },
    missing: { color: 'danger' as const, icon: <X className="h-3.5 w-3.5" />, text: 'Missing' },
    error: { color: 'warning' as const, icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'Error' },
    skip: { color: 'neutral' as const, icon: null, text: 'Not checked' },
  }[result.status];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '14px', color: 'var(--color-text-primary)' }}>{full}</span>
        <Badge color={map.color} variant="soft" size="sm">{map.icon}{map.text}</Badge>
      </div>
      {result.record ? <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{result.record}</code> : null}
      {result.status === 'missing' ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px', color: 'var(--color-text-tertiary)' }}>No {label} record published — generate one on the left.</span> : null}
      {result.error ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px', color: 'var(--color-text-tertiary)' }}>{result.error}</span> : null}
    </div>
  );
}

export function DeliverabilityTool() {
  const [domain, setDomain] = React.useState('');
  const [selector, setSelector] = React.useState('google');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<Results>(null);

  const [provider, setProvider] = React.useState('google');
  const [customInclude, setCustomInclude] = React.useState('');
  const [spfPolicy, setSpfPolicy] = React.useState('~all');
  const [dmarcPolicy, setDmarcPolicy] = React.useState('none');
  const [rua, setRua] = React.useState('');

  const include = provider === 'custom' ? (customInclude.trim() ? `include:${customInclude.trim()}` : '') : SPF_PROVIDERS[provider];
  const spfRecord = `v=spf1 ${include} ${spfPolicy}`.replace(/\s+/g, ' ').trim();
  const dmarcRecord = `v=DMARC1; p=${dmarcPolicy};${rua.trim() ? ` rua=mailto:${rua.trim()};` : ''} adkim=s; aspf=s; pct=100`;

  const check = async () => {
    const d = cleanDomain(domain);
    if (!d) return;
    setLoading(true);
    const [spf, dmarc, dkim] = await Promise.all([
      lookupTxt(d),
      lookupTxt(`_dmarc.${d}`),
      selector.trim() ? lookupTxt(`${selector.trim()}._domainkey.${d}`) : Promise.resolve(null),
    ]);
    setResults({
      spf: classify(spf.records, spf.error, /^v=spf1/i),
      dmarc: classify(dmarc.records, dmarc.error, /^v=DMARC1/i),
      dkim: dkim ? classify(dkim.records, dkim.error, /(v=DKIM1|k=rsa|p=)/i) : { status: 'skip' },
    });
    setLoading(false);
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Check a domain">
          <Field label="Domain" htmlFor="dl-domain" hint="The domain you send email from.">
            <Input id="dl-domain" placeholder="yourcompany.com" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} />
          </Field>
          <Field label="DKIM selector" htmlFor="dl-sel" hint="Common: google, selector1, k1, default, mail.">
            <Input id="dl-sel" value={selector} onChange={(e) => setSelector(e.target.value)} />
          </Field>
          <div>
            <Button type="button" color="module" variant="solid" size="md" onClick={check} disabled={loading || !domain.trim()}>
              {loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              Check records
            </Button>
          </div>
        </Panel>

        <Panel title="Generate an SPF record">
          <div className="tool-fieldgrid">
            <Field label="Email provider">
              <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="google">Google Workspace</option>
                <option value="microsoft">Microsoft 365</option>
                <option value="sendgrid">SendGrid</option>
                <option value="mailgun">Mailgun</option>
                <option value="custom">Custom</option>
              </NativeSelect>
            </Field>
            <Field label="Policy">
              <NativeSelect value={spfPolicy} onChange={(e) => setSpfPolicy(e.target.value)}>
                <option value="~all">Soft fail (~all)</option>
                <option value="-all">Strict (-all)</option>
              </NativeSelect>
            </Field>
          </div>
          {provider === 'custom' ? (
            <Field label="Include domain" hint="From your sending service."><Input placeholder="spf.example.com" value={customInclude} onChange={(e) => setCustomInclude(e.target.value)} /></Field>
          ) : null}
          <RecordOut host="@ (root)" record={spfRecord} />
        </Panel>

        <Panel title="Generate a DMARC record">
          <div className="tool-fieldgrid">
            <Field label="Policy" hint="Start at none, then tighten.">
              <NativeSelect value={dmarcPolicy} onChange={(e) => setDmarcPolicy(e.target.value)}>
                <option value="none">Monitor (none)</option>
                <option value="quarantine">Quarantine</option>
                <option value="reject">Reject</option>
              </NativeSelect>
            </Field>
            <Field label="Reports to" hint="Optional email.">
              <Input type="email" placeholder="dmarc@yourcompany.com" value={rua} onChange={(e) => setRua(e.target.value)} />
            </Field>
          </div>
          <RecordOut host="_dmarc" record={dmarcRecord} />
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Results">
          {results ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <ResultRow label="SPF" full="SPF — authorized senders" result={results.spf} />
              <ResultRow label="DKIM" full="DKIM — message signature" result={results.dkim} />
              <ResultRow label="DMARC" full="DMARC — failure policy" result={results.dmarc} />
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--color-text-tertiary)' }}>
              Enter a domain and check to see its live SPF, DKIM, and DMARC records.
            </span>
          )}
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12.5px', lineHeight: '19px', color: 'var(--color-text-tertiary)', margin: 0 }}>
            DKIM lives at a selector your provider chooses (e.g. <code>google._domainkey</code>). If
            DKIM shows as missing, try a different selector — your provider lists it in their setup
            docs.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}

function RecordOut({ host, record }: { host: string; record: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
        Add a TXT record — host <code style={{ fontFamily: 'var(--font-mono)' }}>{host}</code>:
      </span>
      <pre className="tool-code" style={{ maxHeight: 'none' }} >{record}</pre>
      <div>
        <CopyButton value={record} label="Copy record" toastLabel="Record copied" />
      </div>
    </div>
  );
}
