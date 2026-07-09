import { Card, CardBody, CardTitle, Table } from '@wizeworks/silicaui-react';
import { BarList, ModuleProvider } from '@sparx/ui';

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
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Traffic sources</CardTitle>
            {isSample && <SampleBadge reason="no-data" />}
          </div>
          <BarList
            color="module"
            items={sources.map((r) => ({
              label: SOURCE_LABEL[r.source] ?? r.source,
              value: r.visits,
              display: `${Math.round((r.visits / total) * 100)}%`,
            }))}
          />
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}

export function TopPagesCard({ pages, isSample }: { pages: SiteTopPage[]; isSample: boolean }) {
  return (
    <ModuleProvider module="builder">
      <Card>
        <CardBody>
          <div className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Top pages</CardTitle>
            {isSample ? (
              <SampleBadge reason="no-data" />
            ) : (
              <CardLink href="/builder">All pages</CardLink>
            )}
          </div>
          <Table>
            <thead>
              <tr>
                <th>Page</th>
                <th className="text-right">Views</th>
                <th className="text-right">Visitors</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.path}>
                  <td>
                    <span className="text-module font-mono text-xs">{p.path}</span>
                  </td>
                  <td className="text-right tabular-nums">{fmtNumber(p.views)}</td>
                  <td className="text-right tabular-nums">{fmtNumber(p.visitors)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </ModuleProvider>
  );
}
