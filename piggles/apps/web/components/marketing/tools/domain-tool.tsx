'use client';

import { useRef, useState } from 'react';
import { Badge, Button, Card, CardBody, Input, Loading } from '@wizeworks/silicaui-react';
import { checkDomain, DOMAIN_ENDINGS, normaliseDomainInput, type DomainResult } from './lib/dns';
import { Aside, Panel, Problem, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/**
 * Is this name taken?
 *
 * ── THREE ANSWERS, NOT TWO ──────────────────────────────────────────────────
 *
 * Available, taken, and "we could not find out". The third one matters more than
 * it looks: not every ending runs a lookup service a browser can reach, and a
 * checker that shows those as available is telling somebody a name is free when
 * nobody has actually checked. That is a mistake people print on a van.
 *
 * So an ending we cannot reach says so, in words, with the reason.
 */
export function DomainTool() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, DomainResult | 'checking'>>({});
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    // Strip anything already on the end, so pasting "bellacafe.com" checks
    //"bellacafe" across every ending rather than looking for "bellacafe.com.com".
    const raw = input
      .trim()
      .toLowerCase()
      .replace(/\.[a-z.]+$/, '');
    const { name, error: problem } = normaliseDomainInput(raw);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setSearched(name);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResults(Object.fromEntries(DOMAIN_ENDINGS.map((e) => [e.tld, 'checking' as const])));

    // Sequential rather than all at once. Registries rate-limit, and firing
    // twelve requests in the same millisecond is how you get twelve "slow down"
    // responses instead of twelve answers.
    for (const ending of DOMAIN_ENDINGS) {
      if (controller.signal.aborted) return;
      const domain = `${name}.${ending.tld}`;
      try {
        const result = await checkDomain(domain, controller.signal);
        setResults((prev) => ({ ...prev, [ending.tld]: result }));
      } catch {
        return; // aborted
      }
    }
  };

  const available = Object.values(results).filter(
    (r) => r !== 'checking' && r.status === 'available'
  ).length;
  const done = Object.values(results).length > 0 && !Object.values(results).includes('checking');

  // Three answers stay three answers on the way out. Rounding "could not find
  // out" down to "taken" is how somebody talks themselves out of a name that was
  // free, which is the exact mistake this tool exists to stop.
  useReportToolResult(
    done && searched
      ? {
          lines: DOMAIN_ENDINGS.flatMap((ending) => {
            const r = results[ending.tld];
            if (!r || r === 'checking') return [];
            return [
              {
                label: `${searched}.${ending.tld}`,
                value:
                  r.status === 'available'
                    ? 'Free to register'
                    : r.status === 'taken'
                      ? 'Somebody has it'
                      : `We could not find out — ${r.note ?? 'this ending has no lookup we can reach'}`,
              },
            ];
          }),
          note: 'That was true at the moment you looked, and good names go quickly. Buy the one you want from any registrar, and buy it before you print it on anything.',
        }
      : null
  );

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel title="The name" description="Just the name — leave off the .com.">
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="bellacafe"
                spellCheck={false}
                aria-label="The name to check"
              />
              <Button type="submit" color="module" size="lg" block>
                Check it
              </Button>
            </form>

            {error ? <Problem>{error}</Problem> : null}

            <Aside>
              <strong>Available is not the same as free to use.</strong> This asks the registry
              whether the name is registered. It cannot tell you whether somebody holds a trademark
              on it in your trade — and that search is free, takes ten minutes on your national
              trademark register, and is the one people wish they had done.
            </Aside>
          </Panel>

          <Panel title="Choosing well">
            <p className="text-base">
              <strong>Say it down a phone.</strong> If you have to spell it, or explain that there
              is a hyphen, it will cost you customers every week for years. That single test rules
              out most of the clever options.
            </p>
            <p className="text-base">
              <strong>The ending matters less than it used to.</strong> .com still gets typed from
              habit, but a local ending or a trade one — .shop, .studio, .cafe — reads perfectly
              naturally now and is far more likely to be free.
            </p>
            <p className="text-base">
              <strong>Adding your town or trade usually improves it.</strong> “kellerplumbing” beats
              “keller”, reads better, and helps you turn up when somebody searches locally.
            </p>
          </Panel>
        </>
      }
      output={
        Object.keys(results).length > 0 ? (
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-lg font-bold">
                  <span className="font-mono">{searched}</span>
                </h3>
                {done ? (
                  <p className="text-base">
                    {available === 0
                      ? 'None of these are free.'
                      : `${available} of ${DOMAIN_ENDINGS.length} still free.`}
                  </p>
                ) : (
                  <span className="flex items-center gap-2 text-base">
                    <Loading size="sm" /> Asking the registries…
                  </span>
                )}
              </div>

              <ul className="mt-4 flex flex-col">
                {DOMAIN_ENDINGS.map((ending) => {
                  const result = results[ending.tld];
                  return (
                    <li
                      key={ending.tld}
                      className="border-base-300 flex items-center justify-between gap-4 border-b py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-base font-bold">
                          {searched}.{ending.tld}
                        </p>
                        <p className="text-base">
                          {result && result !== 'checking' && result.note
                            ? result.note
                            : ending.note}
                        </p>
                      </div>
                      {result === 'checking' || !result ? (
                        <Loading size="sm" />
                      ) : (
                        <Badge
                          color={
                            result.status === 'available'
                              ? 'success'
                              : result.status === 'taken'
                                ? 'neutral'
                                : 'warning'
                          }
                          variant="soft"
                        >
                          {result.status === 'available'
                            ? 'Free'
                            : result.status === 'taken'
                              ? 'Taken'
                              : 'Could not check'}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>

              {done && available > 0 ? (
                <p className="mt-5 text-base">
                  Buy it wherever you like — this page does not sell domains and is not paid by
                  anybody who does.
                </p>
              ) : null}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Check before you commit</h3>
              <p className="mt-2 text-base">
                The expensive order of operations is naming the business, printing the signage, and
                then finding the domain has been parked since 2004. A name is cheap to change on a
                Tuesday afternoon and very expensive to change once it is on a van.
              </p>
              <p className="mt-3 text-base">
                Type a name on the left and this asks each registry directly — twelve endings, live,
                no cached list.
              </p>
            </CardBody>
          </Card>
        )
      }
    />
  );
}
