'use client';

// State on a thing — the smallest place color has to carry a meaning on its own.
//
// Every badge here says something different, so if two of them look the same the
// theme has a real problem: on a real order list the words are read second.

import { Avatar, AvatarGroup, Badge, Status } from '@wizeworks/silicaui-react';
import { BoardTile, Specimen } from './tile';

export function BadgesTile() {
  return (
    <BoardTile
      title="Labels and status"
      hint="What a thing is, at a glance — on orders, stock, invoices and bookings."
    >
      <Specimen label="Softened, which is how a list mostly wears them">
        <Badge color="success" variant="soft">
          Paid
        </Badge>
        <Badge color="info" variant="soft">
          Sent
        </Badge>
        <Badge color="warning" variant="soft">
          Awaiting stock
        </Badge>
        <Badge color="error" variant="soft">
          Refunded
        </Badge>
        <Badge color="primary" variant="soft">
          New customer
        </Badge>
      </Specimen>

      <Specimen label="Full weight, for the one that has to be seen">
        <Badge color="success">Paid</Badge>
        <Badge color="warning">Awaiting stock</Badge>
        <Badge color="error">Refunded</Badge>
        <Badge color="neutral">Draft</Badge>
      </Specimen>

      <Specimen label="Sizes">
        <Badge color="primary" size="sm">
          Small
        </Badge>
        <Badge color="primary">Medium</Badge>
        <Badge color="primary" size="lg">
          Large
        </Badge>
      </Specimen>

      <Specimen label="Presence and people">
        <Status color="success" label="Open" ping />
        <Status color="warning" label="Closing soon" />
        <Status color="error" label="Closed" />
        <AvatarGroup>
          <Avatar color="primary" size="sm">
            CC
          </Avatar>
          <Avatar color="secondary" size="sm">
            HH
          </Avatar>
          <Avatar color="accent" size="sm">
            FF
          </Avatar>
          <Avatar size="sm">+3</Avatar>
        </AvatarGroup>
      </Specimen>
    </BoardTile>
  );
}
