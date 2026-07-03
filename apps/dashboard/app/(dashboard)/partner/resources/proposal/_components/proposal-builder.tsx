'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  Checkbox,
  Heading,
  Input,
  Label,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';

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
    <Stack gap={8}>
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <Stack gap={5}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Stack gap={2}>
                <Label htmlFor="prop-client">Client name</Label>
                <Input
                  id="prop-client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="e.g. Riverside Bakery"
                  maxLength={160}
                />
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="prop-by">Prepared by</Label>
                <Input
                  id="prop-by"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Your practice name"
                  maxLength={160}
                />
              </Stack>
            </div>

            <Stack gap={2}>
              <Label>Modules you’ll set up</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULE_GUIDES.map((g) => (
                  <div
                    key={g.module}
                    className="flex items-start gap-3 rounded-lg border border-[var(--color-border-default)] p-3"
                  >
                    <Checkbox
                      id={`prop-mod-${g.module}`}
                      checked={selected.has(g.module)}
                      onCheckedChange={() => toggle(g.module)}
                      className="mt-0.5"
                    />
                    <Stack gap={0} className="min-w-0">
                      <Label htmlFor={`prop-mod-${g.module}`} className="cursor-pointer">
                        {g.label}
                      </Label>
                      <Text size="xs" variant="muted">
                        {g.blurb}
                      </Text>
                    </Stack>
                  </div>
                ))}
              </div>
            </Stack>

            <Stack gap={2} className="sm:max-w-xs">
              <Label htmlFor="prop-monthly">Estimated monthly (USD)</Label>
              <Input
                id="prop-monthly"
                inputMode="decimal"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="149"
              />
            </Stack>

            <Stack gap={2}>
              <Label htmlFor="prop-scope">Scope &amp; notes (optional)</Label>
              <Textarea
                id="prop-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="What you’ll deliver, timeline, anything specific to this client…"
                rows={4}
                maxLength={2000}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="default" padding="lg">
        <Stack gap={6}>
          <Stack gap={1}>
            <Text size="sm" variant="muted" className="tracking-wider uppercase">
              Proposal
            </Text>
            <Heading level={2}>{client.trim() || 'Client name'}</Heading>
            <Text size="sm" variant="muted">
              Prepared by {preparedBy.trim() || 'Your practice'} · on Sparx
            </Text>
          </Stack>

          <Stack gap={2}>
            <Text weight="medium">What we’ll build</Text>
            {chosen.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {chosen.map((g) => (
                  <li key={g.module} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--module-active)]"
                    />
                    <Text size="sm">
                      <span className="font-medium">{g.label}</span> — {g.blurb}
                    </Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text size="sm" variant="muted">
                Select the modules you’ll set up above.
              </Text>
            )}
          </Stack>

          <Stack gap={1}>
            <Text weight="medium">Investment</Text>
            <Text size="sm">
              {monthlyLabel
                ? `${monthlyLabel} per month on Sparx, for the modules above.`
                : 'A monthly Sparx subscription for the modules above.'}
            </Text>
            <Text size="sm" variant="muted">
              Starts with a 14-day free trial — build it and see it work before anything is charged.
            </Text>
          </Stack>

          {scope.trim() ? (
            <Stack gap={1}>
              <Text weight="medium">Scope &amp; notes</Text>
              <Text size="sm" className="whitespace-pre-wrap">
                {scope.trim()}
              </Text>
            </Stack>
          ) : null}

          <Stack gap={1}>
            <Text weight="medium">Next steps</Text>
            <Text size="sm" variant="muted">
              Approve this proposal and we’ll start the trial, build the site, and walk you through
              it before you go live.
            </Text>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
