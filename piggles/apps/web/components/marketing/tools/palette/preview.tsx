'use client';

import { useState, type CSSProperties } from 'react';
import {
  MockupBrowser,
  MockupPhone,
  ToggleGroup,
  ToggleGroupItem,
} from '@wizeworks/silicaui-react';
import { type Assignment } from './roles';
import { seenAs, type Vision } from './vision';
import { ShopScene } from './scenes/shop';
import { PhoneScene } from './scenes/phone';
import { InvoiceScene } from './scenes/invoice';

type SceneId = 'shop' | 'phone' | 'invoice';

const SCENES: { id: SceneId; label: string }[] = [
  { id: 'shop', label: 'Your website' },
  { id: 'phone', label: 'On a phone' },
  { id: 'invoice', label: 'An invoice' },
];

/**
 * The palette, doing the job it was chosen for.
 *
 * Five rectangles cannot tell you whether a set of colors works. The same five
 * on a shopfront, a booking confirmation and an invoice tell you in a second —
 * which one is too pale to put a price on, which two vanish into each other at
 * small sizes, which one was carrying the whole thing.
 *
 * The scenes paint from `--pal-*` variables named after the silica roles they
 * carry, so the shop's main button is `--pal-primary` and the code underneath
 * says `--color-primary`. One vocabulary from the swatch to the stylesheet.
 */
export function Preview({ roles, vision }: { roles: Assignment; vision: Vision }) {
  const [scene, setScene] = useState<SceneId>('shop');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-2xl font-extrabold">Your business, wearing it</h3>
        <ToggleGroup
          color="module"
          value={[scene]}
          onValueChange={(value: string[]) => value[0] && setScene(value[0] as SceneId)}
        >
          {SCENES.map((s) => (
            <ToggleGroupItem key={s.id} value={s.id}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Scene id={scene} roles={roles} vision={vision} />
    </div>
  );
}

/**
 * The mock, painted from the role variables and wearing the frame it belongs in.
 *
 * An invoice inside browser chrome addressed to the bakery was three different
 * businesses claiming to be one — a sheet is what an invoice actually looks like.
 *
 * The one inline style on the wrapper is the visitor's own colors: there is no
 * token for them and there never will be, and setting them once here is what
 * lets every element below paint with an ordinary class.
 */
function Scene({ id, roles, vision }: { id: SceneId; roles: Assignment; vision: Vision }) {
  const paint = (hex: string) => seenAs(hex, vision);
  const style = {
    '--pal-base-100': paint(roles['base-100']),
    '--pal-base-content': paint(roles['base-content']),
    '--pal-primary': paint(roles.primary),
    '--pal-primary-content': paint(roles.primaryContent),
    '--pal-secondary': paint(roles.secondary),
    '--pal-secondary-content': paint(roles.secondaryContent),
    '--pal-accent': paint(roles.accent),
    '--pal-accent-content': paint(roles.accentContent),
    '--pal-line': paint(roles.line),
    '--pal-quiet': paint(roles.quiet),
  } as CSSProperties;

  return (
    <div style={style}>
      {id === 'shop' ? (
        <MockupBrowser url="hearthandcrumb.com" className="border-base-300 border shadow-lg">
          <ShopScene />
        </MockupBrowser>
      ) : id === 'phone' ? (
        <div className="flex justify-center">
          <MockupPhone>
            <PhoneScene />
          </MockupPhone>
        </div>
      ) : (
        <div className="rounded-section overflow-hidden shadow-lg">
          <InvoiceScene />
        </div>
      )}
    </div>
  );
}
