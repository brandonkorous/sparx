import { Card, CardContent, CardHeader, CardTitle, Stack, Text } from '@sparx/ui';

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
      <CardHeader>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <CardTitle>Conversion funnel</CardTitle>
          {isSample && <SampleBadge reason="no-data" />}
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={3}>
          {stages.map((s, i) => {
            const pct = Math.max(2, (s.value / max) * 100);
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Text size="sm" weight="medium">
                    {s.label}
                  </Text>
                  <div className="flex items-center gap-2">
                    {s.rate && i > 0 && (
                      <Text size="xs" variant="muted">
                        {s.rate}
                      </Text>
                    )}
                    <span className="text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
                      {fmtNumber(s.value)}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: `var(--module-${s.module})` }}
                  />
                </div>
              </div>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
