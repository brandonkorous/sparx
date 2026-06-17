'use client';

import * as React from 'react';
import { Check, X, Minus, Search } from 'lucide-react';
import { Button, Input, Badge, Spinner } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';

const TLDS = ['com', 'co', 'io', 'app', 'dev', 'net', 'org', 'ai', 'xyz', 'store'];
const DEFAULT_TLDS = ['com', 'co', 'io', 'app', 'net'];

interface DomainResult {
  available: boolean | null;
  error?: string;
}

function cleanName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('.')[0]!
    .replace(/[^a-z0-9-]/g, '');
}

export function DomainTool() {
  const [name, setName] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set(DEFAULT_TLDS));
  const [results, setResults] = React.useState<Record<string, DomainResult>>({});
  const [loading, setLoading] = React.useState(false);

  const base = cleanName(name);

  const toggle = (tld: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tld)) next.delete(tld);
      else next.add(tld);
      return next;
    });

  const check = async () => {
    if (!base || selected.size === 0) return;
    setLoading(true);
    setResults({});
    const tlds = TLDS.filter((t) => selected.has(t));
    const entries = await Promise.all(
      tlds.map(async (tld): Promise<[string, DomainResult]> => {
        const domain = `${base}.${tld}`;
        try {
          const res = await fetch(`/api/domain-check?domain=${encodeURIComponent(domain)}`);
          const json = (await res.json()) as DomainResult;
          return [domain, json];
        } catch {
          return [domain, { available: null, error: 'lookup failed' }];
        }
      })
    );
    setResults(Object.fromEntries(entries));
    setLoading(false);
  };

  const ordered = TLDS.filter((t) => selected.has(t)).map((t) => `${base}.${t}`);

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Find a domain">
          <Field label="Name" htmlFor="dom-name" hint="Just the name — we add the extensions.">
            <Input
              id="dom-name"
              placeholder="yourbrand"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
            />
          </Field>
          <Field label="Extensions">
            <div className="mkt-cluster" style={{ gap: '8px' }}>
              {TLDS.map((tld) => (
                <Button
                  key={tld}
                  type="button"
                  size="sm"
                  variant={selected.has(tld) ? 'solid' : 'outline'}
                  color={selected.has(tld) ? 'module' : 'neutral'}
                  onClick={() => toggle(tld)}
                >
                  .{tld}
                </Button>
              ))}
            </div>
          </Field>
          <div>
            <Button
              type="button"
              color="module"
              variant="solid"
              size="md"
              onClick={check}
              disabled={loading || !base || selected.size === 0}
            >
              {loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              Check availability
            </Button>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Availability">
          {ordered.length && (loading || Object.keys(results).length) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ordered.map((domain) => {
                const r = results[domain];
                return (
                  <div
                    key={domain}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-default)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {domain}
                    </span>
                    {!r ? (
                      <Spinner className="h-4 w-4" />
                    ) : r.available === true ? (
                      <Badge color="success" variant="soft" size="sm">
                        <Check className="h-3.5 w-3.5" />
                        Available
                      </Badge>
                    ) : r.available === false ? (
                      <Badge color="neutral" variant="soft" size="sm">
                        <X className="h-3.5 w-3.5" />
                        Taken
                      </Badge>
                    ) : (
                      <Badge color="warning" variant="soft" size="sm">
                        <Minus className="h-3.5 w-3.5" />
                        Unknown
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Enter a name and pick the extensions to check across them at once.
            </span>
          )}
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            Availability comes from live registry (RDAP) data. Register the name you want at any
            registrar — premium names may carry special pricing.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
