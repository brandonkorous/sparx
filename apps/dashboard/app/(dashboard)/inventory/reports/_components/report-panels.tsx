// Server-rendered panels for the inventory reports surface (docs/100 P6b):
// turnover / DIO KPIs, aging buckets + dead-stock, and reorder analysis. Each
// carries a CSV export. Data is fetched by the page and passed in.

import Link from 'next/link';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { ExportCsvButton } from './export-buttons';
import {
  BUCKET_LABEL,
  formatMoney,
  type AgingReport,
  type ReorderAnalysisReport,
  type TurnoverReport,
} from './types';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Stack
      gap={1}
      className="min-w-[10rem] flex-1 rounded border border-[var(--color-border-default)] px-4 py-3"
    >
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="lg">{value}</Text>
      {hint ? (
        <Text size="xs" variant="muted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

export function TurnoverPanel({ report }: { report: TurnoverReport }) {
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Stack gap={1}>
            <Heading level={3}>Turnover & days of inventory</Heading>
            <CardDescription>
              Cost of goods sold over the last {report.periodDays} days against average inventory
              value. Higher turnover (and lower DIO) means stock is converting to sales faster.
            </CardDescription>
          </Stack>
          <ExportCsvButton kind="turnover" />
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack direction="row" gap={3} wrap>
          <Tile label="Inventory turns (annualized)" value={`${report.turnoverAnnualized}×`} />
          <Tile
            label="Days inventory outstanding"
            value={
              report.daysInventoryOutstanding === null
                ? '—'
                : `${report.daysInventoryOutstanding} days`
            }
          />
          <Tile
            label="COGS (period)"
            value={formatMoney(report.cogsCents)}
            hint={`${report.unitsSold} units sold`}
          />
          <Tile label="Avg inventory value" value={formatMoney(report.avgInventoryValueCents)} />
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AgingPanel({ report }: { report: AgingReport }) {
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Stack gap={1}>
            <Heading level={3}>Aging & dead stock</Heading>
            <CardDescription>
              On-hand value by time since last sale. Items not sold in {report.deadStockDays}+ days
              (or never) tie up cash — the dead-stock list is the highest-value of them.
            </CardDescription>
          </Stack>
          <ExportCsvButton kind="aging" label="Export dead stock" />
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          <Stack direction="row" gap={3} wrap>
            {report.buckets.map((b) => (
              <Tile
                key={b.bucket}
                label={BUCKET_LABEL[b.bucket]}
                value={formatMoney(b.costCents)}
                hint={`${b.units} units · ${b.levels} items`}
              />
            ))}
          </Stack>
          {report.deadStock.length === 0 ? (
            <Text size="sm" variant="muted">
              No dead stock — every item with stock has sold within {report.deadStockDays} days.
            </Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Last sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.deadStock.map((d) => (
                  <TableRow key={`${d.variantId}-${d.warehouseId}`}>
                    <TableCell>
                      <Link
                        href={`/inventory/movements?variant_id=${d.variantId}`}
                        className="hover:underline"
                      >
                        {d.title ?? d.sku ?? d.variantId.slice(0, 8)}
                      </Link>
                      <Text size="xs" variant="muted" className="font-mono">
                        {d.sku ?? d.variantId}
                      </Text>
                    </TableCell>
                    <TableCell>{d.warehouseCode}</TableCell>
                    <TableCell className="text-right">{d.onHand}</TableCell>
                    <TableCell className="text-right">{formatMoney(d.costCents)}</TableCell>
                    <TableCell className="text-right">
                      {d.lastSaleAt === null ? (
                        <Badge color="danger" variant="soft">
                          Never
                        </Badge>
                      ) : (
                        `${d.daysSinceLastSale}d ago`
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ReorderAnalysisPanel({ report }: { report: ReorderAnalysisReport }) {
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Stack gap={1}>
            <Heading level={3}>Reorder analysis</Heading>
            <CardDescription>
              Items at or below their reorder point, with {report.velocityDays}-day sales velocity,
              days of cover, and projected stockout — so you order what runs out first.
            </CardDescription>
          </Stack>
          <ExportCsvButton kind="reorder-analysis" />
        </Stack>
      </CardHeader>
      <CardContent>
        {report.rows.length === 0 ? (
          <Text size="sm" variant="muted">
            Nothing below its reorder point. Set reorder points on the stock grid to surface items
            here.
          </Text>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Velocity/day</TableHead>
                <TableHead className="text-right">Cover</TableHead>
                <TableHead className="text-right">Suggest</TableHead>
                <TableHead>Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={`${r.variantId}-${r.warehouseId}`}>
                  <TableCell>
                    {r.title ?? r.sku ?? r.variantId.slice(0, 8)}
                    <Text size="xs" variant="muted" className="font-mono">
                      {r.sku ?? r.variantId}
                    </Text>
                  </TableCell>
                  <TableCell>{r.warehouseCode}</TableCell>
                  <TableCell className="text-right">
                    {r.available} / {r.reorderPoint}
                  </TableCell>
                  <TableCell className="text-right">{r.velocityPerDay}</TableCell>
                  <TableCell className="text-right">
                    {r.daysOfCover === null ? '∞' : `${r.daysOfCover}d`}
                  </TableCell>
                  <TableCell className="text-right">{r.suggestedQuantity}</TableCell>
                  <TableCell>
                    {r.supplierName ?? (
                      <Badge color="warning" variant="soft">
                        No supplier
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
