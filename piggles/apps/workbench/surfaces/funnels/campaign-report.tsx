'use client';

// The report half of a campaign, with its date range.

import { useState } from 'react';
import { Card, Field, FieldControl, FieldLabel, Heading, Select } from '@wizeworks/silicaui-react';
import { faChartColumn } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { funnelErrorMessage, useLadder } from './data';
import { LadderReport } from './ladder';

const RANGES = [7, 30, 90].map((d) => ({ value: String(d), label: `Last ${String(d)} days` }));

export function ReportPanel({ id }: { id: string }) {
  const [days, setDays] = useState(30);
  const ladder = useLadder(id, days);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end gap-2">
        <Heading level={2} className="text-lg font-semibold">
          How it is doing
        </Heading>
        <div className="flex-1" />
        {/* A LABEL somebody can see, like every other control in this console.
            The value names the span, but only once you have worked out that the
            dropdown is a span at all. */}
        <Field className="w-44">
          <FieldLabel>Covering</FieldLabel>
          <FieldControl
            render={
              <Select
                size="sm"
                value={String(days)}
                onValueChange={(value) => {
                  setDays(Number(value));
                }}
                items={RANGES}
              />
            }
          />
        </Field>
      </header>

      {/* The three states in their house shapes. This branch used to be a bare
          "Loading…" paragraph and, on a failure, a sentence with NO WAY TO TRY
          AGAIN — the only dead end of its kind on the pane. */}
      {ladder.isPending ? (
        <Card className="items-center justify-center py-8">
          <PaneWaiting module="funnels" />
        </Card>
      ) : ladder.isError ? (
        <Card className="items-center justify-center py-8">
          <PaneLoadError
            module="funnels"
            icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
            title="Could not work out how this is doing"
            description={funnelErrorMessage(
              ladder.error,
              'This is a problem reaching the server. The campaign itself carries on as normal, and nothing it has recorded is affected.'
            )}
            onRetry={() => {
              void ladder.refetch();
            }}
          />
        </Card>
      ) : ladder.data ? (
        <LadderReport ladder={ladder.data} />
      ) : null}
    </section>
  );
}
