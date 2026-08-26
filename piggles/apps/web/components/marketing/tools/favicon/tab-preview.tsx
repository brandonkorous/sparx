'use client';

import { useEffect, useRef } from 'react';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { drawSquare, type LoadedImage } from '../lib/canvas';

/**
 * The honest preview: the icon at sixteen pixels, in a row of real tabs — once
 * on a light browser and once on a dark one. Drawing only the page's own theme
 * hid the case a see-through dark logo fails in, which is the whole question.
 */
export function TabPreview({
  image,
  background,
  fillBackground,
}: {
  image: LoadedImage;
  background: string;
  fillBackground: boolean;
}) {
  const medium = useRef<HTMLCanvasElement>(null);
  const apple = useRef<HTMLCanvasElement>(null);

  // The previews carry the same fill the downloaded files do.
  const fill = fillBackground ? background : undefined;

  useEffect(() => {
    paint(medium.current, image, 32, fill);
    paint(apple.current, image, 180, background);
  }, [image, background, fill]);

  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold">At the size that actually matters</h3>
        <p className="mt-2 text-base">
          Sixteen pixels, in a row of tabs — once on a browser set to light, once on one set to
          dark. Your visitors use both. If you cannot pick yours out of <em>both</em> rows at a
          glance, it needs a background behind it, or a simpler shape.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TabStrip theme="light" label="A light browser" image={image} fill={fill} />
          <TabStrip theme="dark" label="A dark browser" image={image} fill={fill} />
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-8">
          <div>
            <canvas ref={medium} width={32} height={32} className="size-8" aria-label="At 32 px" />
            <p className="mt-2 text-base">32px — a sharp screen</p>
          </div>
          <div>
            <canvas
              ref={apple}
              width={180}
              height={180}
              className="border-base-300 size-20 rounded-[22%] border"
              aria-label="The home screen icon"
            />
            <p className="mt-2 text-base">On a home screen</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function paint(
  target: HTMLCanvasElement | null,
  image: LoadedImage,
  size: number,
  background?: string
) {
  if (!target) return;
  const drawn = drawSquare(image, { size, background, fit: 'contain' });
  target.width = size;
  target.height = size;
  target.getContext('2d')?.drawImage(drawn, 0, 0);
}

/**
 * One row of tabs in a fixed theme. `data-theme` is silica's own mechanism for
 * an island resolving against a different palette, so both rows come from real
 * tokens rather than a hardcoded grey that would be wrong in one mode.
 */
function TabStrip({
  theme,
  label,
  image,
  fill,
}: {
  theme: 'light' | 'dark';
  label: string;
  image: LoadedImage;
  fill?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => paint(canvas.current, image, 16, fill), [image, fill]);

  return (
    <div>
      <div
        data-theme={theme}
        className="rounded-box border-base-300 bg-base-200 flex items-end gap-1 overflow-x-auto border p-3"
      >
        <div className="bg-base-100 rounded-t-field flex min-w-[8rem] items-center gap-2 px-3 py-2">
          <canvas
            ref={canvas}
            width={16}
            height={16}
            className="size-4 shrink-0"
            aria-label={`Your favicon at 16 pixels, on ${label.toLowerCase()}`}
          />
          <span className="truncate text-sm font-semibold">Your site</span>
        </div>
        {['Inbox (14)', 'Orders'].map((tab) => (
          <div
            key={tab}
            className="rounded-t-field flex min-w-[6rem] items-center gap-2 px-3 py-2 opacity-70"
          >
            <span aria-hidden className="bg-base-300 size-4 shrink-0 rounded-sm" />
            <span className="truncate text-sm">{tab}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-base">{label}</p>
    </div>
  );
}
