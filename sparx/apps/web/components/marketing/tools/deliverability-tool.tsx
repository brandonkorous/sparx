'use client';

import * as React from 'react';
import { Check, X, AlertTriangle, Search } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  List,
  ListColGrow,
  ListRow,
  Loading,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton, CodeBlock } from './ui-kit';
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

const STATUS_MAP = {
  found: { color: 'success', icon: <Check className="h-3.5 w-3.5" />, text: 'Found' },
  missing: { color: 'danger', icon: <X className="h-3.5 w-3.5" />, text: 'Missing' },
  error: { color: 'warning', icon: <AlertTriangle className="h-3.5 w-3.5" />, text: 'Error' },
  // `neutral`, and it is earned: "not checked" is the absence of a result, not
  // a result — a genuinely untyped value, which is the one thing RULE #4 keeps
  // neutral for. The other three are real outcomes and wear real semantics.
  skip: { color: 'neutral', icon: null, text: 'Not checked' },
} as const;

function classify(records: string[] | null, error: string | undefined, re: RegExp): CheckResult {
  if (records === null) return { status: 'skip' };
  if (error) return { status: 'error', error };
  const rec = records.find((r) => re.test(r));
  return rec ? { status: 'found', record: rec } : { status: 'missing' };
}

function ResultRow({ label, full, result }: { label: string; full: string; result: CheckResult }) {
  const map = STATUS_MAP[result.status];
  return (
    <ListRow className="items-start px-0">
      <ListColGrow className="flex flex-col gap-2">
        <span className="text-md font-medium">{full}</span>
        {result.record ? (
          <code className="font-mono text-sm break-all">{result.record}</code>
        ) : null}
        {result.status === 'missing' ? (
          <Alert color="danger" variant="soft" size="sm">
            No {label} record published — generate one on the left.
          </Alert>
        ) : null}
        {result.error ? (
          <Alert color="warning" size="sm">
            {result.error}
          </Alert>
        ) : null}
      </ListColGrow>
      <Badge color={map.color} variant="soft" size="sm" className="mt-0.5 shrink-0">
        {map.icon}
        {map.text}
      </Badge>
    </ListRow>
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

  const include =
    provider === 'custom'
      ? customInclude.trim()
        ? `include:${customInclude.trim()}`
        : ''
      : SPF_PROVIDERS[provider];
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
            <Input
              id="dl-domain"
              placeholder="yourcompany.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
            />
          </Field>
          <Field
            label="DKIM selector"
            htmlFor="dl-sel"
            hint="Common: google, selector1, k1, default, mail."
          >
            <Input id="dl-sel" value={selector} onChange={(e) => setSelector(e.target.value)} />
          </Field>
          <div>
            <Button
              type="button"
              color="module"
              variant="solid"
              size="md"
              onClick={check}
              disabled={loading || !domain.trim()}
            >
              {loading ? <Loading className="h-4 w-4" /> : <Search className="h-4 w-4" />}
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
            <Field label="Include domain" hint="From your sending service.">
              <Input
                placeholder="spf.example.com"
                value={customInclude}
                onChange={(e) => setCustomInclude(e.target.value)}
              />
            </Field>
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
              <Input
                type="email"
                placeholder="dmarc@yourcompany.com"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
              />
            </Field>
          </div>
          <RecordOut host="_dmarc" record={dmarcRecord} />
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Results">
          {results ? (
            <List className="bg-transparent [&_.list-row]:px-0">
              <ResultRow label="SPF" full="SPF — authorized senders" result={results.spf} />
              <ResultRow label="DKIM" full="DKIM — message signature" result={results.dkim} />
              <ResultRow label="DMARC" full="DMARC — failure policy" result={results.dmarc} />
            </List>
          ) : (
            <EmptyResults />
          )}
          <Alert color="info" size="sm">
            DKIM lives at a selector your provider chooses (e.g. <code>google._domainkey</code>). If
            DKIM shows as missing, try a different selector — your provider lists it in their setup
            docs.
          </Alert>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}

function EmptyResults() {
  return (
    <EmptyState
      size="sm"
      icon={<Search className="h-8 w-8" />}
      title="Nothing checked yet"
      description="Enter a domain and check to see its live SPF, DKIM, and DMARC records."
    />
  );
}

function RecordOut({ host, record }: { host: string; record: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">
        Add a TXT record — host <code className="font-mono">{host}</code>:
      </span>
      <CodeBlock height="none">{record}</CodeBlock>
      <div>
        <CopyButton value={record} label="Copy record" toastLabel="Record copied" />
      </div>
    </div>
  );
}
