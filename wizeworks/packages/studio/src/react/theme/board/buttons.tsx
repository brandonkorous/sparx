'use client';

// Buttons, across all four axes at once.
//
// A theme is judged on its buttons before anything else, and every one of these
// is `color x variant x size x state` resolved by silica rather than painted here
// — which is the point: if a token moves, this tile moves with it.
//
// `neutral` is shown because the theme registers it. On the board a role is a
// specimen, not a design decision.

import { Button } from '@wizeworks/silicaui-react';
import { BoardTile, Specimen } from './tile';

export function ButtonsTile() {
  return (
    <BoardTile title="Buttons" hint="The thing people click, in every color and weight you have.">
      <Specimen label="Solid — the action a page exists for">
        <Button color="primary">Order now</Button>
        <Button color="secondary">See the menu</Button>
        <Button color="accent">Book a table</Button>
        <Button color="neutral">Cancel</Button>
      </Specimen>

      <Specimen label="Softer weights, for everything that is not the point">
        <Button color="primary" variant="soft">
          Soft
        </Button>
        <Button color="primary" variant="outline">
          Outline
        </Button>
        <Button color="primary" variant="ghost">
          Ghost
        </Button>
        <Button color="primary" variant="dash">
          Dashed
        </Button>
        <Button color="primary" variant="link">
          A link
        </Button>
      </Specimen>

      <Specimen label="Sizes">
        <Button color="primary" size="xs">
          Extra small
        </Button>
        <Button color="primary" size="sm">
          Small
        </Button>
        <Button color="primary">Medium</Button>
        <Button color="primary" size="lg">
          Large
        </Button>
      </Specimen>

      <Specimen label="States">
        <Button color="primary" loading>
          Saving
        </Button>
        <Button color="primary" disabled>
          Not available
        </Button>
        <Button color="error">Delete it</Button>
        <Button color="success">Mark as paid</Button>
      </Specimen>
    </BoardTile>
  );
}
