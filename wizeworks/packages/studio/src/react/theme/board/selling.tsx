'use client';

// The part that takes money.
//
// A price, a rating and one button that has to be the most obvious thing on the
// card. If the theme's main color cannot win that fight here, it will not win it
// on the real product page either.

import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  CardTitle,
  Rating,
} from '@wizeworks/silicaui-react';
import { BoardTile } from './tile';

export function SellingTile() {
  return (
    <BoardTile title="Selling" hint="A product, a price, and the button that has to win.">
      <Card className="bg-base-200">
        <CardBody>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>Saturday market box</CardTitle>
            <Badge color="accent" variant="soft">
              New
            </Badge>
          </div>
          <p className="text-base">
            Two loaves, a dozen rolls, and whatever came out best that morning.
          </p>
          <div className="flex items-center gap-2">
            <Rating color="warning" defaultValue={5} readOnly label="Five stars" />
            <span className="text-base-content text-sm">38 reviews</span>
          </div>
          <p className="text-2xl font-semibold">$24.00</p>
          <CardActions>
            <Button color="primary">Add to basket</Button>
            <Button variant="ghost">Save for later</Button>
          </CardActions>
        </CardBody>
      </Card>
    </BoardTile>
  );
}
