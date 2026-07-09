import { Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';

import { SampleBadge } from '../_components/overview-bits';
import { fmtNumber } from './format';
import type { FunnelStage } from './types';

// The conversion funnel — shrinking horizontal bars, each labelled with its
// count and step-conversion from the prior stage (where the leak is). Bars wear
// their stage's module hue so the acquisition→commerce handoff is visible. Stays
// a neutral card (it spans modules, so no single hue owns it).

export function ConversionFunnel({
  stages,
  isSample,
}: {
  stages: FunnelStage[];
  isSample: boolean;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Conversion funnel</CardTitle>
          {isSample && <SampleBadge reason="no-data" />}
        </div>
        <div className="flex flex-col gap-3">
          {stages.map((s, i) => {
            const pct = Math.max(2, (s.value / max) * 100);
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{s.label}</p>
                  <div className="flex items-center gap-2">
                    {s.rate && i > 0 && <p className="text-base-content/70 text-xs">{s.rate}</p>}
                    <span className="text-base-content text-sm font-medium tabular-nums">
                      {fmtNumber(s.value)}
                    </span>
                  </div>
                </div>
                <div className="bg-base-200 h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: `var(--color-module-${s.module})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
