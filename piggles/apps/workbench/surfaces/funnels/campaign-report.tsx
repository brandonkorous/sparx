'use client';

// The report half of a campaign, with its date range.

import { useState } from 'react';
import { Heading, Select, Text } from '@wizeworks/silicaui-react';
import { funnelErrorMessage, useLadder } from './data';
import { LadderReport } from './ladder';

const RANGES = [7, 30, 90].map((d) => ({ value: String(d), label: `Last ${String(d)} days` }));

export function ReportPanel({ id }: { id: string }) {
  const [days, setDays] = useState(30);
  const ladder = useLadder(id, days);

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2">
        <Heading level={2} className="text-lg font-semibold">
          How it is doing
        </Heading>
        <div className="flex-1" />
        <div className="w-40">
          <Select
            size="sm"
            aria-label="Report period"
            value={String(days)}
            onValueChange={(value) => {
              setDays(Number(value));
            }}
            items={RANGES}
          />
        </div>
      </header>

      {ladder.isPending ? (
        <p className="text-sm" role="status">
          Loading…
        </p>
      ) : ladder.isError ? (
        <Text className="text-sm">
          {funnelErrorMessage(ladder.error, 'The report could not be loaded just now.')}
        </Text>
      ) : ladder.data ? (
        <LadderReport ladder={ladder.data} />
      ) : null}
    </section>
  );
}
