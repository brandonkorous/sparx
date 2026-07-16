// Server-rendered panels for the inventory reports surface (docs/100 P6b):
// turnover / DIO KPIs, aging buckets + dead-stock, and reorder analysis. Each
// carries a CSV export. Data is fetched by the page and passed in.

import Link from 'next/link';

import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

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
    <div className="border-base-300 flex min-w-[10rem] flex-1 flex-col gap-1 rounded border px-4 py-3">
      <p className="text-base-content text-xs">{label}</p>
      <p className="text-lg">{value}</p>
      {hint ? <p className="text-base-content text-xs">{hint}</p> : null}
    </div>
  );
}

export function TurnoverPanel({ report }: { report: TurnoverReport }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Turnover & days of inventory</h3>
            <p className="opacity-70">
              Cost of goods sold over the last {report.periodDays} days against average inventory
              value. Higher turnover (and lower DIO) means stock is converting to sales faster.
            </p>
          </div>
          <ExportCsvButton kind="turnover" />
        </div>
        <div className="flex flex-row flex-wrap gap-3">
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
        </div>
      </CardBody>
    </Card>
  );
}

export function AgingPanel({ report }: { report: AgingReport }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Aging & dead stock</h3>
            <p className="opacity-70">
              On-hand value by time since last sale. Items not sold in {report.deadStockDays}+ days
              (or never) tie up cash — the dead-stock list is the highest-value of them.
            </p>
          </div>
          <ExportCsvButton kind="aging" label="Export dead stock" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-row flex-wrap gap-3">
            {report.buckets.map((b) => (
              <Tile
                key={b.bucket}
                label={BUCKET_LABEL[b.bucket]}
                value={formatMoney(b.costCents)}
                hint={`${b.units} units · ${b.levels} items`}
              />
            ))}
          </div>
          {report.deadStock.length === 0 ? (
            <p className="text-base-content text-sm">
              No dead stock — every item with stock has sold within {report.deadStockDays} days.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Last sold</th>
                </tr>
              </thead>
              <tbody>
                {report.deadStock.map((d) => (
                  <tr key={`${d.variantId}-${d.warehouseId}`}>
                    <td>
                      <Link
                        href={`/inventory/movements?variant_id=${d.variantId}`}
                        className="hover:underline"
                      >
                        {d.title ?? d.sku ?? d.variantId.slice(0, 8)}
                      </Link>
                      <p className="text-base-content font-mono text-xs">{d.sku ?? d.variantId}</p>
                    </td>
                    <td>{d.warehouseCode}</td>
                    <td className="text-right">{d.onHand}</td>
                    <td className="text-right">{formatMoney(d.costCents)}</td>
                    <td className="text-right">
                      {d.lastSaleAt === null ? (
                        <Badge color="danger" variant="soft">
                          Never
                        </Badge>
                      ) : (
                        `${d.daysSinceLastSale}d ago`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function ReorderAnalysisPanel({ report }: { report: ReorderAnalysisReport }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Reorder analysis</h3>
            <p className="opacity-70">
              Items at or below their reorder point, with {report.velocityDays}-day sales velocity,
              days of cover, and projected stockout — so you order what runs out first.
            </p>
          </div>
          <ExportCsvButton kind="reorder-analysis" />
        </div>
        {report.rows.length === 0 ? (
          <p className="text-base-content text-sm">
            Nothing below its reorder point. Set reorder points on the stock grid to surface items
            here.
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th className="text-right">Available</th>
                <th className="text-right">Velocity/day</th>
                <th className="text-right">Cover</th>
                <th className="text-right">Suggest</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={`${r.variantId}-${r.warehouseId}`}>
                  <td>
                    {r.title ?? r.sku ?? r.variantId.slice(0, 8)}
                    <p className="text-base-content font-mono text-xs">{r.sku ?? r.variantId}</p>
                  </td>
                  <td>{r.warehouseCode}</td>
                  <td className="text-right">
                    {r.available} / {r.reorderPoint}
                  </td>
                  <td className="text-right">{r.velocityPerDay}</td>
                  <td className="text-right">
                    {r.daysOfCover === null ? '∞' : `${r.daysOfCover}d`}
                  </td>
                  <td className="text-right">{r.suggestedQuantity}</td>
                  <td>
                    {r.supplierName ?? (
                      <Badge color="warning" variant="soft">
                        No supplier
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
