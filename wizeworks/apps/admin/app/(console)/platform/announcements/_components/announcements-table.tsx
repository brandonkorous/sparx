import Link from 'next/link';
import {
  Badge,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@wizeworks/ui';
import type { OperatorAnnouncement } from '@wizeworks/operator';
import { formatDateTime } from '@/lib/format';
import { announcementState, BRAND_LABELS, SURFACE_LABELS } from '@/lib/announcements';
import { AnnouncementControls } from './announcement-controls';

// Every notice ever written, newest first — drafts and finished ones included,
// because this is the screen where one is retired as well as where one is born.
//
// The MESSAGE is the first column and it is a link, because the sentence is the
// only thing anybody recognises a notice by. A row keyed on an id or a date
// makes an operator open three of them to find the one that is wrong.

export function AnnouncementsTable({ announcements }: { announcements: OperatorAnnouncement[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Notice</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Where</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Window</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {announcements.map((a) => {
          const state = announcementState(a);
          return (
            <TableRow key={a.id}>
              <TableCell>
                <Stack gap={0}>
                  <Link
                    href={`/platform/announcements/${a.id}`}
                    className="text-base-content font-medium hover:underline"
                  >
                    {a.message}
                  </Link>
                  {a.linkLabel ? (
                    <Text size="xs" variant="muted">
                      Button: {a.linkLabel} → {a.linkHref}
                    </Text>
                  ) : null}
                </Stack>
              </TableCell>
              <TableCell>
                <Badge color={a.platformBrand === 'piggles' ? 'primary' : 'info'} variant="soft">
                  {BRAND_LABELS[a.platformBrand] ?? a.platformBrand}
                </Badge>
              </TableCell>
              <TableCell>
                <Stack direction="row" gap={1} className="flex-wrap">
                  {a.surfaces.map((s) => (
                    <Badge key={s} color="module" variant="soft" size="sm">
                      {SURFACE_LABELS[s] ?? s}
                    </Badge>
                  ))}
                </Stack>
              </TableCell>
              <TableCell>
                <Badge color={state.tone} variant="soft">
                  {state.label}
                </Badge>
              </TableCell>
              <TableCell>
                <Text size="sm" variant="muted">
                  {windowLabel(a)}
                </Text>
              </TableCell>
              <TableCell>
                <AnnouncementControls announcement={a} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** The window in words. "Always" is the honest reading of two empty dates — a
 *  dash would read as "not set up yet" on a notice that is running right now. */
function windowLabel(a: OperatorAnnouncement): string {
  const from = formatDateTime(a.startsAt);
  const to = formatDateTime(a.endsAt);
  if (!from && !to) return 'Always, until switched off';
  if (from && !to) return `From ${from}`;
  if (!from && to) return `Until ${to}`;
  return `${from} → ${to}`;
}
