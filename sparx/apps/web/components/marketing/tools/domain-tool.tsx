'use client';

import * as React from 'react';
import { Check, X, Minus, Search } from 'lucide-react';
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
} from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

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
  const checked = ordered.filter((d) => results[d]);

  // A name search is the one result people most want to sit on overnight, so the
  // whole list goes — including the ones nobody could answer for. A lookup that
  // failed says so; it never gets rounded down to "taken", which would talk
  // someone out of a name that is sitting there free.
  useReportToolResult(
    !loading && checked.length > 0
      ? {
          lines: checked.map((domain) => ({
            label: domain,
            value:
              results[domain]?.available === true
                ? 'Available'
                : results[domain]?.available === false
                  ? 'Taken'
                  : 'We could not reach the registry for this one',
          })),
          note: 'Availability was live at the moment you checked, and good names go quickly. Register the one you want at any registrar, then point it at your site.',
        }
      : null
  );

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
            <div className="flex flex-wrap items-center gap-2">
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
              {loading ? <Loading className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              Check availability
            </Button>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Availability">
          {ordered.length && (loading || Object.keys(results).length) ? (
            <List className="bg-transparent [&_.list-row]:px-0">
              {ordered.map((domain) => {
                const r = results[domain];
                return (
                  <ListRow key={domain}>
                    <ListColGrow className="text-md truncate font-mono">{domain}</ListColGrow>
                    {!r ? (
                      <Loading className="h-4 w-4" />
                    ) : r.available === true ? (
                      <Badge color="success" variant="soft" size="sm">
                        <Check className="h-3.5 w-3.5" />
                        Available
                      </Badge>
                    ) : r.available === false ? (
                      // `error`, not a grey pill: Available / Taken / Unknown is
                      // a three-state answer and each state has its own semantic
                      // — success, error, warning — so the color IS the answer.
                      <Badge color="error" variant="soft" size="sm">
                        <X className="h-3.5 w-3.5" />
                        Taken
                      </Badge>
                    ) : (
                      <Badge color="warning" variant="soft" size="sm">
                        <Minus className="h-3.5 w-3.5" />
                        Unknown
                      </Badge>
                    )}
                  </ListRow>
                );
              })}
            </List>
          ) : (
            <EmptyState
              size="sm"
              icon={<Search className="h-8 w-8" />}
              title="No names checked yet"
              description="Enter a name and pick the extensions to check across them at once."
            />
          )}
          <Alert color="info" size="sm">
            Availability comes from live registry (RDAP) data. Register the name you want at any
            registrar — premium names may carry special pricing.
          </Alert>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
