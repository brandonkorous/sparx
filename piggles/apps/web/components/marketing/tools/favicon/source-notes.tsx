'use client';

import type { LoadedImage } from '../lib/canvas';
import { Aside } from '../ui-kit';

/** What the dropped picture is, and the two reasons an icon comes out
 *  see-through — neither of which is anything being removed from it. */
export function SourceNotes({ image }: { image: LoadedImage | null }) {
  if (!image) {
    return (
      <Aside>
        <strong>Use the mark, not the whole logo.</strong> At sixteen pixels the words in a logo
        become a grey smudge, and every smudge looks the same. The one distinctive shape — the
        symbol, the first letter, the animal — is what people recognise.
      </Aside>
    );
  }

  return (
    <>
      <Aside>{describe(image)}</Aside>

      {image.hasTransparency ? (
        <Aside>
          <strong>This picture is already see-through behind your logo.</strong> Nothing was taken
          off it — a picture that looks white in a photo viewer is often see-through, because the
          viewer puts it on white. Pick a solid color below and it is filled in on every icon.
        </Aside>
      ) : null}

      {!image.isVector && image.width !== image.height ? (
        <Aside>
          <strong>That picture is a rectangle, and an icon is always a square.</strong> Your logo is
          fitted inside whole, which leaves an empty strip on two sides. That strip is see-through
          unless you pick a solid color below. Trimming the picture square yourself first gives your
          logo more room in the same icon.
        </Aside>
      ) : null}
    </>
  );
}

function describe(image: LoadedImage): string {
  if (image.isVector) {
    return 'An SVG — the best possible source. It can be drawn perfectly sharp at every size.';
  }
  if (image.width < 512) {
    return `That picture is ${image.width}×${image.height}. Anything under 512 across has to be scaled up for the large icons, which softens them. If you have a bigger version, use that.`;
  }
  return `${image.width}×${image.height} — plenty to work with.`;
}
