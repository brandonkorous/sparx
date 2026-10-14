'use client';

import { Badge, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { binAddress, binFullness, binTypeLabel, binTypeTone, type Bin } from './bins-data';

export type OpenBin = (bin: Bin, event: { shiftKey: boolean; altKey: boolean }) => void;

const NUMBER = new Intl.NumberFormat();

/** How full, as fixed width classes so each is a LITERAL Tailwind class the
 *  compiler can see. An inline width is banned, and at this size a 10% step is a
 *  couple of pixels. */
const FULL_WIDTH = [
  'w-0',
  'w-[10%]',
  'w-[20%]',
  'w-[30%]',
  'w-[40%]',
  'w-[50%]',
  'w-[60%]',
  'w-[70%]',
  'w-[80%]',
  'w-[90%]',
  'w-full',
];

function BinShelfCell({ bin }: { bin: Bin }) {
  return (
    <td className="w-full max-w-0 min-w-56">
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-mono font-medium">{bin.code}</span>
        {bin.name ? <span className="truncate text-sm">{bin.name}</span> : null}
        {/* Below @lg the Location column is gone, and a shelf with no
            place is not an answer. */}
        <span className="truncate text-sm @lg:hidden">{bin.warehouseName ?? '—'}</span>
        {bin.zone || bin.aisle ? (
          <span className="hidden truncate text-sm @lg:inline">{binAddress(bin)}</span>
        ) : null}
      </span>
    </td>
  );
}

/** Kind carries color: "can stock here be sold" is what matters, so on-hold and
 *  damaged shelves read red from across the room instead of as identical grey chips. */
function BinKindCell({ bin }: { bin: Bin }) {
  return (
    <td>
      <span className="flex flex-wrap items-center gap-1">
        <Badge color={binTypeTone(bin.type)} variant="soft" size="sm">
          {binTypeLabel(bin.type)}
        </Badge>
        {/* Said out loud rather than left to be inferred from the
            kind: "cannot be sold" is the fact with consequences. */}
        {!bin.isSellable && bin.unitCount > 0 ? (
          <Badge color="danger" variant="outline" size="sm">
            Not sellable
          </Badge>
        ) : null}
        {/* Which shelf things land on. Every row carried it and none drew it, so
            nobody could tell where a delivery goes, or see that NONE was it. */}
        {bin.isDefault ? (
          <Badge color="module-inventory" variant="soft" size="sm">
            Where things land
          </Badge>
        ) : null}
      </span>
    </td>
  );
}

function BinFullnessCell({ fullness }: { fullness: number | null }) {
  return (
    <td className="hidden @2xl:table-cell">
      {fullness === null ? (
        <Text className="text-sm">—</Text>
      ) : (
        <span className="flex items-center gap-2">
          <span className="bg-base-200 h-2 w-16 overflow-hidden rounded-full">
            <span
              className={`block h-full rounded-full ${
                fullness >= 0.9 ? 'bg-warning' : 'bg-module'
              } ${FULL_WIDTH[Math.round(fullness * 10)] ?? 'w-full'}`}
            />
          </span>
          <Text className="text-sm tabular-nums">{Math.round(fullness * 100)}%</Text>
        </span>
      )}
    </td>
  );
}

function BinRow({ bin, onOpen }: { bin: Bin; onOpen: OpenBin }) {
  const fullness = binFullness(bin);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(bin, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(bin, event);
      }}
    >
      <BinShelfCell bin={bin} />
      <td className="hidden max-w-40 truncate @lg:table-cell">{bin.warehouseName ?? '—'}</td>
      <BinKindCell bin={bin} />
      <td className="hidden text-right tabular-nums @xl:table-cell">{bin.itemCount}</td>
      <td className="text-right font-medium whitespace-nowrap tabular-nums">
        {NUMBER.format(bin.unitCount)}
      </td>
      <BinFullnessCell fullness={fullness} />
    </tr>
  );
}

/** A table, not cards: hundreds of rows, each with several facts scanned DOWN a
 *  column. Cards would turn a scan into a read. */
export function BinsTable({ rows, onOpen }: { rows: Bin[]; onOpen: OpenBin }) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Shelf</th>
          <th className="hidden @lg:table-cell">Location</th>
          <th>Kind</th>
          <th className="hidden text-right @xl:table-cell">Items</th>
          <th className="text-right">Units</th>
          <th className="hidden @2xl:table-cell">How full</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((bin) => (
          <BinRow key={bin.id} bin={bin} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
