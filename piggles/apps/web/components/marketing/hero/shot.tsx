'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Carousel,
  CarouselItem,
  Lightbox,
  MockupBrowser,
  MockupPhone,
  type LightboxItem,
} from '@wizeworks/silicaui-react';
import { faUpRightAndDownLeftFromCenter } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { PigglesAppId } from '@piggles/config';
import { shotSrc, SHOT_SIZE, type ProductShot, type ShotViewport } from '@/content/shots';

// The product screenshots on an app page — a carousel of real surfaces, framed
// as the devices they were taken on, each opening full-viewport.
//
// ── FOUR DECISIONS, AND WHY EACH IS NOT THE OBVIOUS ONE ─────────────────────
//
// 1. SLIDES ARE SURFACES, NOT RENDERINGS. Stock is not one screen — it is stock
//    levels, a count in progress, batches with dates on them. Three different
//    screens is something worth flipping through; the same table in four skins
//    is not.
//
// 2. THEME IS SERVED, NOT SLID. Both files exist for every shot, and CSS picks
//    the one matching the visitor's theme (`.shot-light`/`.shot-dark` in
//    globals.css). A theme is a preference the page already knows; making
//    somebody click to the dark version of a screen they are already viewing in
//    dark mode is the site asking them to do its job.
//
// 3. THE PHONE IS A SLIDE, BECAUSE IT IS A CLAIM. "Everything has to work on a
//    phone, standing up, with one hand" is what /who-its-for says about a market
//    stall. A phone-framed capture is that sentence evidenced, which a theme
//    variant never is.
//
// 4. THE ZOOM BADGE IS ALWAYS VISIBLE. `cursor-zoom-in` is invisible until hover
//    and absent entirely on touch — which is exactly where the image is smallest
//    and most needs to advertise that a bigger one exists.
//
// NO AUTOPLAY. A hero that moves on its own competes with the headline somebody
// is still reading, and every other piece of motion on this site is opt-in
// behind `prefers-reduced-motion`.

/** One capture, in both themes, wrapped in its device frame. */
function Framed({
  app,
  shot,
  viewport,
}: {
  app: PigglesAppId;
  shot: ProductShot;
  viewport: ShotViewport;
}) {
  // Both themes render; CSS shows one. Reading the theme in JS instead would be
  // impossible during server render, so the first paint would show the wrong
  // image and swap after hydration.
  // From the registry, never spelled here: these declare the ASPECT the browser
  // reserves before the file arrives, so a number that disagrees with the file
  // is a layout shift on a hero — and, inside the phone's fixed 9:19 box, a
  // band of dead frame under the screen.
  const size = SHOT_SIZE[viewport];
  const common = {
    alt: shot.alt,
    width: size.width,
    height: size.height,
    sizes: '(min-width: 1024px) 46vw, 100vw',
    priority: true,
  };
  const pair = (
    <>
      <Image
        className="shot-light block h-auto w-full"
        src={shotSrc(app, shot, viewport, 'light')}
        {...common}
      />
      <Image
        className="shot-dark h-auto w-full"
        src={shotSrc(app, shot, viewport, 'dark')}
        {...common}
      />
    </>
  );

  // The DESKTOP capture already contains the console's own chrome — the rail,
  // the dock, the open tabs — so the browser frame adds only the thing it does
  // not have: an address bar that says this is a website you go to. The MOBILE
  // capture is a bare screen, so the phone frame is doing real work.
  return viewport === 'mobile' ? (
    <MockupPhone className="mx-auto">{pair}</MockupPhone>
  ) : (
    <MockupBrowser className="border-base-300 bg-base-100 border">{pair}</MockupBrowser>
  );
}

export function Shot({ app, shots }: { app: PigglesAppId; shots: ProductShot[] }) {
  const [index, setIndex] = useState<number | null>(null);

  // Every viewport of every shot, flattened — the carousel's slide order and the
  // lightbox's item order are THE SAME LIST, so slide n opens item n. Two lists
  // built separately is how a lightbox ends up opening the wrong picture.
  const slides = shots.flatMap((shot) => shot.viewports.map((viewport) => ({ shot, viewport })));

  // Resolved on CLICK, not at render: `document` is unavailable server-side, but
  // by the time somebody has clicked, the theme is knowable and correct. This is
  // why the lightbox can read the theme when the <Image> pair cannot.
  function open(at: number): void {
    setIndex(at);
  }

  const theme = typeof document === 'undefined' ? 'light' : document.documentElement.dataset.theme;
  const items: LightboxItem[] = slides.map(({ shot, viewport }) => ({
    src: shotSrc(app, shot, viewport, theme === 'dark' ? 'dark' : 'light'),
    caption: shot.caption,
  }));

  return (
    <>
      <Carousel indicators="dots" controls={slides.length > 1} className="rounded-section gap-4">
        {slides.map(({ shot, viewport }, i) => (
          <CarouselItem key={`${shot.surface}-${viewport}`} className="w-full shrink-0">
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`Open a full-size view: ${shot.alt}`}
              className="focus-visible:outline-primary relative block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Framed app={app} shot={shot} viewport={viewport} />

              {/* The affordance, always on. Sits on the frame rather than on the
                  screenshot, so it never covers a row of real data. */}
              <span
                aria-hidden
                className="bg-base-100 text-base-content border-base-300 absolute right-3 bottom-3 grid size-8 place-items-center rounded-full border shadow-md"
              >
                <Icon glyph={faUpRightAndDownLeftFromCenter} className="size-3.5" />
              </span>
            </button>

            {/* The label names the SURFACE, which is what makes a carousel worth
                flipping: "Stock levels" then "Batches and dates" tells you there
                is something new on the next slide. */}
            <p className="mt-3 text-center text-base font-semibold">{shot.label}</p>
          </CarouselItem>
        ))}
      </Carousel>

      <Lightbox items={items} index={index} onIndexChange={setIndex} />
    </>
  );
}
