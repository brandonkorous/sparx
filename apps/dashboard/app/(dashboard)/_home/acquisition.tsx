import {
  BarList,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ModuleProvider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sparx/ui';

import { CardLink, SampleBadge } from '../_components/overview-bits';
import { fmtNumber } from './format';
import type { SiteSourceRow, SiteTopPage } from './types';

// Acquisition row — where visitors come from + what they look at. Both are
// site/builder signals; they stay neutral cards (the hero owns the builder hue)
// with a builder-hued accent via the provider.

const SOURCE_LABEL: Record<string, string> = {
  search: 'Search',
  direct: 'Direct',
  social: 'Social',
  referral: 'Referral',
  email: 'Email',
  paid: 'Paid',
};

export function TrafficSourcesCard({
  sources,
  isSample,
}: {
  sources: SiteSourceRow[];
  isSample: boolean;
}) {
  const total = Math.max(
    1,
    sources.reduce((s, r) => s + r.visits, 0)
  );
  return (
    <ModuleProvider module="builder">
      <Card>
        <CardHeader>
          <Stack direction="row" align="center" justify="between" gap={2}>
            <CardTitle>Traffic sources</CardTitle>
            {isSample && <SampleBadge reason="no-data" />}
          </Stack>
        </CardHeader>
        <CardContent>
          <BarList
            color="module"
            items={sources.map((r) => ({
              label: SOURCE_LABEL[r.source] ?? r.source,
              value: r.visits,
              display: `${Math.round((r.visits / total) * 100)}%`,
            }))}
          />
        </CardContent>
      </Card>
    </ModuleProvider>
  );
}

export function TopPagesCard({ pages, isSample }: { pages: SiteTopPage[]; isSample: boolean }) {
  return (
    <ModuleProvider module="builder">
      <Card>
        <CardHeader>
          <Stack direction="row" align="center" justify="between" gap={2}>
            <CardTitle>Top pages</CardTitle>
            {isSample ? (
              <SampleBadge reason="no-data" />
            ) : (
              <CardLink href="/builder">All pages</CardLink>
            )}
          </Stack>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Visitors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((p) => (
                <TableRow key={p.path}>
                  <TableCell>
                    <span className="font-mono text-xs text-[var(--module-active-text)]">
                      {p.path}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(p.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(p.visitors)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ModuleProvider>
  );
}
