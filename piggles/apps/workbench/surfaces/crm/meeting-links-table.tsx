'use client';

// One row per booking link: what it is called, where it lives, how many people
// have used it, and the four things you can do to it.

import { Badge, Button, Card, Text } from '@wizeworks/silicaui-react';
import { faCopy, faLink, faPencil } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import type { MeetingLink } from './workspace-data';

export function MeetingLinksTable({
  rows,
  onCopy,
  onEdit,
  onTogglePaused,
  onRetire,
}: {
  rows: MeetingLink[];
  onCopy: (link: MeetingLink) => void;
  onEdit: (link: MeetingLink) => void;
  onTogglePaused: (link: MeetingLink) => void;
  onRetire: (link: MeetingLink) => void;
}) {
  return (
    <Card className="p-0">
      <Table>
        <thead>
          <tr>
            <th>Link</th>
            <th className="hidden @md:table-cell">Address</th>
            <th className="hidden @lg:table-cell">Booked</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((link) => (
            <tr key={link.id}>
              <td>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Text as="span" className="font-medium">
                      {link.name}
                    </Text>
                    {link.archivedAt ? (
                      <Badge color="neutral" variant="soft" size="sm">
                        Retired
                      </Badge>
                    ) : link.isActive ? (
                      <Badge color="success" variant="soft" size="sm">
                        Taking bookings
                      </Badge>
                    ) : (
                      <Badge color="warning" variant="soft" size="sm">
                        Paused
                      </Badge>
                    )}
                  </div>
                  {link.description ? <Text>{link.description}</Text> : null}
                </div>
              </td>
              <td className="hidden @md:table-cell">
                <Text as="span" className="text-sm">
                  /meet/{link.slug}
                </Text>
              </td>
              <td className="hidden @lg:table-cell">
                <Text as="span">{link.bookingCount}</Text>
              </td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    color="module"
                    variant="ghost"
                    size="sm"
                    aria-label={`Copy the link for ${link.name}`}
                    title="Copy this link"
                    onClick={() => {
                      onCopy(link);
                    }}
                  >
                    <Icon glyph={faCopy} className="size-4" aria-hidden />
                  </Button>
                  {link.archivedAt ? null : (
                    <>
                      <Button
                        color="module"
                        variant="ghost"
                        size="sm"
                        aria-label={`Change ${link.name}`}
                        title="Change it"
                        onClick={() => {
                          onEdit(link);
                        }}
                      >
                        <Icon glyph={faPencil} className="size-4" aria-hidden />
                      </Button>
                      <Button
                        color="module"
                        variant="ghost"
                        size="sm"
                        aria-label={
                          link.isActive
                            ? `Pause ${link.name}`
                            : `Start taking bookings on ${link.name}`
                        }
                        title={link.isActive ? 'Pause it' : 'Start taking bookings'}
                        onClick={() => {
                          onTogglePaused(link);
                        }}
                      >
                        <Icon glyph={faLink} className="size-4" aria-hidden />
                      </Button>
                      <Button
                        color="danger"
                        variant="ghost"
                        size="sm"
                        aria-label={`Stop using ${link.name}`}
                        title="Stop using it"
                        onClick={() => {
                          onRetire(link);
                        }}
                      >
                        <Text as="span" className="text-sm">
                          Retire
                        </Text>
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
