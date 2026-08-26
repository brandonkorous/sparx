'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Loading,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from '@wizeworks/silicaui-react';
import {
  buildDmarc,
  buildSpf,
  checkDkim,
  checkDmarc,
  checkSpf,
  COMMON_DKIM_SELECTORS,
  normaliseDomainInput,
  SPF_PRESETS,
  type EmailAuthFinding,
} from './lib/dns';
import {
  Aside,
  CheckField,
  CodeOut,
  Panel,
  Problem,
  SelectField,
  TextField,
  ToolLayout,
} from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/** The heading each check wears on screen, reused so the email says the same
 *  thing. "Could not find" stays distinct from "missing" all the way out — the
 *  four states are the whole point of this tool. */
const findingLabel = (kind: 'spf' | 'dkim' | 'dmarc'): string =>
  kind === 'spf'
    ? 'SPF — who is allowed to send as you'
    : kind === 'dkim'
      ? 'DKIM — the signature on your mail'
      : 'DMARC — what to do with fakes';

/**
 * Will your email actually arrive?
 *
 * Two halves. Checking what a domain publishes today, and generating what it is
 * missing. Both on one page because they are the same job in sequence — nobody
 * generates an SPF record without first wanting to know whether they already
 * have one, and the answer to that determines whether they should be merging
 * rather than adding.
 *
 * ──"COULD NOT FIND" IS NOT "MISSING" ───────────────────────────────────────
 *
 * DKIM keys are published under a name the mail provider chooses, and there is
 * no way to list them — they can only be guessed at. So a miss reports "could
 * not find", explains why, and offers a box to type the real one into. Reporting
 * it as absent would tell a large number of correctly-configured businesses that
 * they have a problem they do not have.
 */
export function DeliverabilityTool() {
  const [domain, setDomain] = useState('');
  const [customSelector, setCustomSelector] = useState('');
  const [findings, setFindings] = useState<EmailAuthFinding[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState('');

  // Generator state.
  const [includes, setIncludes] = useState<string[]>([]);
  const [allowA, setAllowA] = useState(false);
  const [allowMx, setAllowMx] = useState(true);
  const [spfPolicy, setSpfPolicy] = useState<'~all' | '-all' | '?all'>('~all');
  const [dmarcPolicy, setDmarcPolicy] = useState<'none' | 'quarantine' | 'reject'>('none');
  const [reportTo, setReportTo] = useState('');

  const run = async () => {
    const { name, error: problem } = normaliseDomainInput(domain);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setChecking(true);
    setFindings(null);
    setChecked(name);

    try {
      const selectors = customSelector.trim()
        ? [customSelector.trim(), ...COMMON_DKIM_SELECTORS]
        : COMMON_DKIM_SELECTORS;
      const results = await Promise.all([
        checkSpf(name),
        checkDkim(name, selectors),
        checkDmarc(name),
      ]);
      setFindings(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The lookup did not work.');
    } finally {
      setChecking(false);
    }
  };

  const spfRecord = buildSpf({ includes, allowA, allowMx, policy: spfPolicy });
  const dmarcRecord = buildDmarc({ policy: dmarcPolicy, reportTo, percentage: 100 });

  // Two records that get typed into a control panel, very often by somebody
  // other than the person reading this screen. That is what an email is for, so
  // they go every time and the check results ride along when there are any.
  useReportToolResult({
    lines: [
      ...(findings && checked
        ? [
            { label: 'Domain checked', value: checked },
            ...findings.map((f) => ({
              label: findingLabel(f.kind),
              value: f.record ? `${f.title} — ${f.record}` : f.title,
            })),
          ]
        : []),
      { label: 'SPF record — name it @ or leave the name blank', value: spfRecord },
      { label: 'DMARC record — name it _dmarc', value: dmarcRecord },
    ],
    note: 'Both go in wherever your domain is managed, as TXT records. Leave DMARC on monitor for a couple of weeks and read what comes back before you tighten it — going straight to reject can bounce your own mail. DKIM is not here because your email provider makes that one for you.',
  });

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel title="Check a domain" description="What it publishes right now, live.">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run();
              }}
              className="flex flex-col gap-4"
            >
              <Input
                color="module"
                size="lg"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="bellacafe.example"
                spellCheck={false}
                aria-label="The domain to check"
              />
              <Button type="submit" color="module" size="lg" block disabled={checking}>
                {checking ? 'Looking it up…' : 'Check it'}
              </Button>
            </form>

            <TextField
              label="DKIM name, if you know it (optional)"
              hint="Your mail provider calls it a selector. Google Workspace uses “google”; Microsoft uses “selector1”. If you leave this empty, the usual ones are tried."
              value={customSelector}
              onChange={setCustomSelector}
              spellCheck={false}
            />

            {error ? <Problem>{error}</Problem> : null}

            <Aside>
              This is one of only two tools here that sends anything anywhere: the domain name goes
              to a public DNS lookup service, because there is no other way to read what a domain
              publishes. Nothing else leaves the page.
            </Aside>
          </Panel>

          <Panel
            title="Generate what you are missing"
            description="Nothing here is sent anywhere — the records are built in the page."
          >
            <Tabs defaultValue="spf">
              <TabsList>
                <TabsTab value="spf">Who may send</TabsTab>
                <TabsTab value="dmarc">What to do on failure</TabsTab>
              </TabsList>

              <TabsPanel value="spf">
                <div className="flex flex-col gap-4 pt-4">
                  <p className="text-base">
                    Tick everything that sends email using your address — your mail provider, your
                    newsletter tool, your invoicing software.
                  </p>

                  <div className="flex flex-col gap-3">
                    {SPF_PRESETS.map((preset) => (
                      <CheckField
                        key={preset.value}
                        label={preset.label}
                        checked={includes.includes(preset.value)}
                        onChange={(on) =>
                          setIncludes(
                            on
                              ? [...includes, preset.value]
                              : includes.filter((i) => i !== preset.value)
                          )
                        }
                      />
                    ))}
                  </div>

                  <CheckField
                    label="Also allow my incoming mail servers"
                    hint="Usually correct, and harmless if not."
                    checked={allowMx}
                    onChange={setAllowMx}
                  />
                  <CheckField
                    label="Also allow my website's own server"
                    hint="Only if your website sends email directly — a contact form on your own hosting, for instance."
                    checked={allowA}
                    onChange={setAllowA}
                  />

                  <SelectField
                    label="Everybody else"
                    value={spfPolicy}
                    onChange={(v) => setSpfPolicy(v)}
                    options={[
                      { value: '~all', label: 'Treat as suspicious — start here' },
                      {
                        value: '-all',
                        label: 'Reject outright — once you are sure the list is complete',
                      },
                      { value: '?all', label: 'No opinion — barely worth publishing' },
                    ]}
                  />
                </div>
              </TabsPanel>

              <TabsPanel value="dmarc">
                <div className="flex flex-col gap-4 pt-4">
                  <SelectField
                    label="When a message fails the checks"
                    value={dmarcPolicy}
                    onChange={(v) => setDmarcPolicy(v)}
                    options={[
                      { value: 'none', label: 'Do nothing, just tell me — start here' },
                      { value: 'quarantine', label: 'Send it to spam' },
                      { value: 'reject', label: 'Refuse it outright' },
                    ]}
                  />
                  <TextField
                    label="Send the reports to"
                    hint="An address you will actually read. The reports are how you find out who else is sending email as you."
                    value={reportTo}
                    onChange={setReportTo}
                    inputMode="email"
                    spellCheck={false}
                  />
                  <Aside>
                    <strong>Start with &ldquo;just tell me&rdquo;.</strong> It changes nothing about
                    how your mail is treated and starts the reports. Businesses that skip this and
                    go straight to strict enforcement usually discover, loudly, that their
                    accounting software was sending as them too.
                  </Aside>
                </div>
              </TabsPanel>
            </Tabs>
          </Panel>
        </>
      }
      output={
        <>
          {checking ? (
            <Card>
              <CardBody className="flex items-center gap-3 py-10">
                <Loading />
                <p className="text-base">Asking DNS about {checked}…</p>
              </CardBody>
            </Card>
          ) : null}

          {findings ? (
            <Card>
              <CardBody>
                <h3 className="text-lg font-bold">
                  <span className="font-mono">{checked}</span>
                </h3>
                <div className="mt-4 flex flex-col gap-4">
                  {findings.map((finding) => (
                    <div key={finding.kind} className="border-base-300 rounded-box border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h4 className="text-base font-bold">{finding.title}</h4>
                        <Badge
                          color={
                            finding.status === 'good'
                              ? 'success'
                              : finding.status === 'warn'
                                ? 'warning'
                                : finding.status === 'bad'
                                  ? 'danger'
                                  : 'info'
                          }
                          variant="soft"
                        >
                          {finding.status === 'good'
                            ? 'Fine'
                            : finding.status === 'warn'
                              ? 'Worth a look'
                              : finding.status === 'bad'
                                ? 'Needs fixing'
                                : 'Could not tell'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-base">{finding.detail}</p>
                      {finding.record ? (
                        <pre className="bg-base-200 rounded-field mt-3 overflow-x-auto p-3 text-sm">
                          <code className="font-mono">{finding.record}</code>
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">The records to publish</h3>
              <p className="mt-2 text-base">
                These go in your domain&rsquo;s DNS settings, wherever you bought the name. Both are
                TXT records.
              </p>

              <div className="mt-5 flex flex-col gap-5">
                <div>
                  <p className="text-base font-bold">Name: @ (or leave it blank)</p>
                  <div className="mt-2">
                    <CodeOut code={spfRecord} />
                  </div>
                  <p className="mt-2 text-base">
                    <strong>If you already have one, merge into it.</strong> A domain may only
                    publish one SPF record — most mail servers treat two as an error and ignore
                    both, which fails every message at once.
                  </p>
                </div>

                <div>
                  <p className="text-base font-bold">
                    Name: <span className="font-mono">_dmarc</span>
                  </p>
                  <div className="mt-2">
                    <CodeOut code={dmarcRecord} />
                  </div>
                </div>
              </div>

              <p className="mt-5 text-base">
                DKIM is the third, and it is the one you cannot generate here — the key has to come
                from your mail provider, because only they hold the other half of it. Look for
                &ldquo;DKIM&rdquo; or &ldquo;authenticate your domain&rdquo; in their settings.
              </p>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}
