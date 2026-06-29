import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ModuleProvider,
  Stack,
  Text,
} from '@sparx/ui';

import { SampleBadge } from '../_components/overview-bits';
import type { SiteVitals } from './types';

// Site speed — real-user Core Web Vitals (avg load, LCP, CLS) with good/needs/
// poor coloring, sitting beside the activity feed. Falls back to a badged sample
// until the storefront beacon captures timing.

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const SAMPLE: SiteVitals = { load: 900, lcp: 1200, cls: 0.02, samples: 0 };

function fmtSeconds(ms: number | null): string {
  return ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`;
}
function band(value: number | null, good: number, ok: number): Tone {
  if (value == null) return 'neutral';
  if (value <= good) return 'success';
  if (value <= ok) return 'warning';
  return 'danger';
}

export function WebVitalsCard({ vitals }: { vitals: SiteVitals | null }) {
  const live = !!(vitals && vitals.samples > 0 && vitals.load != null);
  const v = vitals && vitals.samples > 0 && vitals.load != null ? vitals : SAMPLE;

  const rows: { label: string; value: string; tone: Tone }[] = [
    { label: 'Avg. load', value: fmtSeconds(v.load), tone: band(v.load, 1500, 3000) },
    { label: 'Largest paint (LCP)', value: fmtSeconds(v.lcp), tone: band(v.lcp, 2500, 4000) },
    {
      label: 'Layout shift (CLS)',
      value: v.cls != null ? v.cls.toFixed(2) : '—',
      tone: band(v.cls, 0.1, 0.25),
    },
  ];

  return (
    <ModuleProvider module="builder">
      <Card className="h-full">
        <CardHeader>
          <Stack direction="row" align="center" justify="between" gap={2}>
            <CardTitle>Site speed</CardTitle>
            {!live && <SampleBadge reason="no-data" />}
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={0}>
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-border-default)] py-3 last:border-b-0"
              >
                <Text size="sm" variant="muted">
                  {r.label}
                </Text>
                <Badge color={r.tone} variant="soft">
                  {r.value}
                </Badge>
              </div>
            ))}
          </Stack>
          <Text size="xs" variant="muted" className="mt-3 block">
            Core Web Vitals{live ? ` · ${v.samples} samples` : ''}
          </Text>
        </CardContent>
      </Card>
    </ModuleProvider>
  );
}
