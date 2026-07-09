'use client';

import * as React from 'react';
import {
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  Label,
  Textarea,
} from '@wizeworks/silicaui-react';

import { MODULE_GUIDES } from '../../_lib/content';

// The client-proposal builder (docs/114 §B.7) — a real, fill-in tool. The partner
// enters the client, the modules they'll set up, and a rough monthly figure; a
// clean proposal renders live below and prints (the form itself is `print:hidden`,
// so only the proposal makes it onto the page/PDF). No server round-trip — it's a
// local document generator.

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatMonthly(raw: string): string | null {
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? usd.format(n) : null;
}

export function ProposalBuilder({ defaultPreparedBy }: { defaultPreparedBy: string }) {
  const [client, setClient] = React.useState('');
  const [preparedBy, setPreparedBy] = React.useState(defaultPreparedBy);
  const [selected, setSelected] = React.useState<Set<string>>(new Set(['builder']));
  const [monthly, setMonthly] = React.useState('');
  const [scope, setScope] = React.useState('');

  function toggle(module: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  const chosen = MODULE_GUIDES.filter((g) => selected.has(g.module));
  const monthlyLabel = formatMonthly(monthly);

  return (
    <div className="flex flex-col gap-8">
      <Card className="print:hidden">
        <CardBody>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Client name</FieldLabel>
                <FieldControl
                  id="prop-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="e.g. Riverside Bakery"
                  maxLength={160}
                />
              </Field>
              <Field>
                <FieldLabel>Prepared by</FieldLabel>
                <FieldControl
                  id="prop-by"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Your practice name"
                  maxLength={160}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Modules you’ll set up</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULE_GUIDES.map((g) => (
                  <div
                    key={g.module}
                    className="border-base-300 flex items-start gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={`prop-mod-${g.module}`}
                      checked={selected.has(g.module)}
                      onChange={() => toggle(g.module)}
                      className="mt-0.5"
                    />
                    <div className="flex min-w-0 flex-col gap-0">
                      <Label htmlFor={`prop-mod-${g.module}`} className="cursor-pointer">
                        {g.label}
                      </Label>
                      <p className="text-base-content/70 text-xs">{g.blurb}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Field className="sm:max-w-xs">
              <FieldLabel>Estimated monthly (USD)</FieldLabel>
              <FieldControl
                id="prop-monthly"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="149"
              />
            </Field>

            <Field>
              <FieldLabel>Scope &amp; notes (optional)</FieldLabel>
              <FieldControl
                id="prop-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="What you’ll deliver, timeline, anything specific to this client…"
                maxLength={2000}
                render={<Textarea rows={4} />}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-base-content/70 text-sm tracking-wider uppercase">Proposal</p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {client.trim() || 'Client name'}
              </h2>
              <p className="text-base-content/70 text-sm">
                Prepared by {preparedBy.trim() || 'Your practice'} · on Sparx
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-base font-medium">What we’ll build</p>
              {chosen.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {chosen.map((g) => (
                    <li key={g.module} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="bg-module mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                      />
                      <p className="text-sm">
                        <span className="font-medium">{g.label}</span> — {g.blurb}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Select the modules you’ll set up above.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-base font-medium">Investment</p>
              <p className="text-sm">
                {monthlyLabel
                  ? `${monthlyLabel} per month on Sparx, for the modules above.`
                  : 'A monthly Sparx subscription for the modules above.'}
              </p>
              <p className="text-base-content/70 text-sm">
                Starts with a 14-day free trial — build it and see it work before anything is
                charged.
              </p>
            </div>

            {scope.trim() ? (
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">Scope &amp; notes</p>
                <p className="text-sm whitespace-pre-wrap">{scope.trim()}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <p className="text-base font-medium">Next steps</p>
              <p className="text-base-content/70 text-sm">
                Approve this proposal and we’ll start the trial, build the site, and walk you
                through it before you go live.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
