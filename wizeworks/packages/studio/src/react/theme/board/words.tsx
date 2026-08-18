'use client';

// Words, at every size the site will actually set them.
//
// The typeface, the ink and the line height all arrive from the theme, so this is
// the one tile that answers "can my customers read this" — which is a different
// question from "do I like the color".

import { Blockquote, Kbd, Link } from '@wizeworks/silicaui-react';
import { BoardTile } from './tile';

export function WordsTile() {
  return (
    <BoardTile title="Words" hint="Your typeface and your ink, at the sizes a page really uses.">
      <div>
        <p className="text-4xl leading-tight font-bold">Fresh from the oven</p>
        <p className="text-2xl font-semibold">A heading that carries a section</p>
        <p className="text-xl font-semibold">A smaller heading</p>
      </div>

      <p className="text-lg">
        A lead paragraph introduces the page with a little more size, and sets up what follows.
      </p>

      <p className="text-base">
        Body copy sits at the sixteen-pixel floor — the size the rest of the world reads at — with
        room between the lines. Inside it a{' '}
        <Link color="primary" href="#board-sample">
          link
        </Link>{' '}
        has to be findable without being shouted, and <strong>bold</strong> has to be heavier than
        its neighbours without turning into a headline.
      </p>

      <ul className="list-disc pl-5 text-base">
        <li>A list item, because sites are mostly lists.</li>
        <li>Another, to show the spacing between them.</li>
      </ul>

      <Blockquote>Every part of this repaints the moment you change a color.</Blockquote>

      <p className="text-base-content text-sm">
        Small print, receipts and captions. Press <Kbd size="sm">Esc</Kbd> to close.
      </p>
    </BoardTile>
  );
}
