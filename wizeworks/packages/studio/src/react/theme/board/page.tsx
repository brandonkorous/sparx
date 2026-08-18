'use client';

// The theme as a PAGE, before it is a parts bin.
//
// Every other tile answers "what does this component look like". This one answers
// the only question the person paying for the site is actually asking: does this
// look like my business. It goes first for that reason, and it carries NO caption —
// a heading over it turns a site into an exhibit of one.

import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  CardTitle,
  Input,
  Navbar,
  NavbarEnd,
  NavbarStart,
} from '@wizeworks/silicaui-react';
import { useStudioHost } from '../../context';
import { BoardTile } from './tile';

const SHELF = [
  { name: 'Your best seller', price: '$7.00', note: 'The one people come back for.' },
  { name: 'New this week', price: '$3.50', note: 'Just added to the shelf.' },
  { name: 'The gift box', price: '$24.00', note: 'Whatever came out best.' },
];

export function PageTile() {
  const site = useStudioHost().siteName?.trim();
  const business = site && site.length > 0 ? site : 'Your business';

  return (
    <BoardTile wide>
      <Navbar className="bg-base-100 rounded-box">
        <NavbarStart>
          <span className="text-lg font-semibold">{business}</span>
        </NavbarStart>
        <NavbarEnd className="gap-2">
          <Button variant="ghost" size="sm">
            Menu
          </Button>
          <Button variant="ghost" size="sm">
            Find us
          </Button>
          <Button color="primary" size="sm">
            Order online
          </Button>
        </NavbarEnd>
      </Navbar>

      <div className="bg-base-100 rounded-box flex flex-col gap-4 p-8">
        <Badge color="success" variant="soft" className="self-start">
          Open now
        </Badge>
        <h2 className="text-4xl leading-tight font-bold">Worth the trip</h2>
        <p className="max-w-prose text-lg">
          This is a headline at the size your visitors will meet it, with a paragraph underneath at
          the size they will read it. Both are wearing your typeface and your ink.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button color="primary" size="lg">
            Order for collection
          </Button>
          <Button variant="outline" size="lg">
            See what is new
          </Button>
        </div>
      </div>

      <div className="grid gap-4 @3xl:grid-cols-3">
        {SHELF.map((item) => (
          <Card key={item.name} className="bg-base-100">
            <CardBody>
              <CardTitle>{item.name}</CardTitle>
              <p className="text-base">{item.note}</p>
              <p className="text-xl font-semibold">{item.price}</p>
              <CardActions>
                <Button color="primary" size="sm">
                  Add
                </Button>
              </CardActions>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="bg-base-300 rounded-box flex flex-wrap items-center gap-3 p-6">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">Keep in touch with {business}</p>
          <p className="text-base">One note a week. Nothing else, ever.</p>
        </div>
        <Input className="w-56" placeholder="you@example.com" aria-label="Email address" />
        <Button color="primary">Sign me up</Button>
      </div>
    </BoardTile>
  );
}
