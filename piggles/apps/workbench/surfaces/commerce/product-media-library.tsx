'use client';

// "Choose from your pictures" — the way into the media library from a product.
//
// The gap this closes: the Photos tab offered exactly one way in, a file input.
// A business that had already uploaded its photographs — through the site
// builder, a journal post, a social post, or this very tab last week — had to
// find the original files on disk again, and got a second copy in the library
// if it did. Every other picture field in the console reaches the shared picker;
// the one place a shop puts its photographs did not (issue 272).
//
// Its own component so the hook is called INSIDE the provider, which lets the
// gallery stay what its header says it is: no draft, no data, reports what was
// chosen.

import { Button } from '@wizeworks/silicaui-react';
import { faImages } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useMediaMultiPicker, type PickedAsset } from '../cms/media-picker';

export function ChooseFromLibrary({
  disabled,
  onChosen,
}: {
  disabled: boolean;
  onChosen: (assets: PickedAsset[]) => void;
}) {
  const pickMany = useMediaMultiPicker();
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onClick={() => {
        void pickMany().then((assets) => {
          if (assets && assets.length > 0) onChosen(assets);
        });
      }}
    >
      <Icon glyph={faImages} className="size-4" aria-hidden />
      Choose from your pictures
    </Button>
  );
}
