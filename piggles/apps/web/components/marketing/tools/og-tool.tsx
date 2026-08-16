'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, CardBody, Dropzone } from '@wizeworks/silicaui-react';
import { loadImageFile, canvasToBlob, type LoadedImage } from './lib/canvas';
import { CARD_LAYOUTS, drawShareCard, type CardLayout } from './lib/share-card';
import { downloadBlob, safeFilename } from './lib/download';
import {
  Aside,
  AreaField,
  CodeOut,
  ColourField,
  Panel,
  Problem,
  SelectField,
  TextField,
  ToolLayout,
} from './ui-kit';

/**
 * The picture that shows up when somebody posts your link.
 *
 * ── PUT THE WORDS IN THE PICTURE ────────────────────────────────────────────
 *
 * The counter-intuitive part, and the reason this tool is built around a
 * headline rather than around an image upload: in a feed, the picture is what
 * the eye lands on and the title underneath is small grey text half of people
 * never read. A card with five large words on it does the whole job of the link
 * on its own.
 *
 * So the headline is the first field, it is sized automatically to fill the
 * space, and the logo is optional.
 */
export function OgTool() {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [footer, setFooter] = useState('');
  const [background, setBackground] = useState('#FBF7F8');
  const [accent, setAccent] = useState('#FF6F86');
  const [layout, setLayout] = useState<CardLayout>('left');
  const [logo, setLogo] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawShareCard(canvas, { title, subtitle, footer, background, accent, layout, logo });
  }, [title, subtitle, footer, background, accent, layout, logo]);

  const filename = safeFilename(title || footer, 'share-image');

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel
            title="What it says"
            description="Keep it to a phrase. This is a headline, not a sentence."
          >
            <TextField
              label="Headline"
              hint="Five or six words. It sizes itself to fill the card, so a shorter one comes out bigger — which is usually better."
              value={title}
              onChange={setTitle}
              placeholder="Wood-fired pizza in Ancoats"
            />
            <AreaField
              label="A line underneath (optional)"
              value={subtitle}
              onChange={setSubtitle}
              rows={2}
              placeholder="Open Thursday to Sunday, three minutes from the tram"
            />
            <TextField
              label="Your business name"
              hint="Sits in the corner in your accent colour, like a signature."
              value={footer}
              onChange={setFooter}
              placeholder="Bella Cafe"
            />
          </Panel>

          <Panel title="How it looks">
            <SelectField
              label="Arrangement"
              hint={CARD_LAYOUTS.find((l) => l.value === layout)?.blurb}
              value={layout}
              onChange={(v) => setLayout(v)}
              options={CARD_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))}
            />
            <ColourField label="Background" value={background} onChange={setBackground} />
            <ColourField label="Accent" value={accent} onChange={setAccent} />
            <Aside>
              The text colour is worked out from your background rather than chosen — a pale card
              gets dark text, a dark card gets light. That is why it stays readable whatever you
              pick.
            </Aside>
          </Panel>

          <Panel title="Your logo (optional)">
            <Dropzone
              className="border-module"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              multiple={false}
              onFiles={async (files) => {
                const file = files[0];
                if (!file) return;
                try {
                  setError(null);
                  setLogo(await loadImageFile(file));
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'That image could not be opened.');
                }
              }}
              title={logo ? 'Drop a different logo' : 'Drop a logo here, or click to choose'}
              hint="A PNG with a transparent background works best."
            />
            {error ? <Problem>{error}</Problem> : null}
            {logo ? (
              <button
                type="button"
                className="self-start text-base font-semibold underline underline-offset-4"
                onClick={() => setLogo(null)}
              >
                Take it off again
              </button>
            ) : null}
          </Panel>
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Your card</h3>
              <canvas
                ref={canvasRef}
                className="rounded-box border-base-300 mt-4 block h-auto w-full border"
                aria-label="Your share image"
              />
              <p className="mt-3 text-base">
                1200 × 630 — the shape nearly every messaging app and social network crops to.
              </p>

              <Button
                color="module"
                size="lg"
                block
                className="mt-5"
                onClick={async () => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  downloadBlob(await canvasToBlob(canvas), `${filename}.png`);
                }}
              >
                Download the PNG
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Where it goes</h3>
              <p className="mt-2 text-base">
                Upload the image to your site, then point at it from the {'<head>'} of the page.
              </p>
              <div className="mt-4">
                <CodeOut
                  code={`<meta property="og:image" content="https://yoursite.example/${filename}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`}
                  language="html"
                />
              </div>
              <p className="mt-3 text-base">
                <strong>Still showing the old one?</strong> The platform cached it, sometimes for
                days. Search for the platform&rsquo;s name plus &ldquo;sharing debugger&rdquo; — it
                re-reads your page on demand.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">In a feed</h3>
              <div className="rounded-box border-base-300 mt-4 max-w-md overflow-hidden border">
                <FeedPreview canvasRef={canvasRef} />
                <div className="bg-base-100 p-3">
                  <p className="text-base">yoursite.example</p>
                  <p className="mt-0.5 text-base font-bold">{title || 'Your headline here'}</p>
                </div>
              </div>
              <p className="mt-3 text-base">
                Roughly this size on a phone, which is the size to judge it at — not the large
                version above.
              </p>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}

/** A live copy of the canvas at feed size. Drawn from the same canvas rather
 * than re-rendered, so the two can never disagree. */
function FeedPreview({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const small = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    const copy = () => {
      const source = canvasRef.current;
      const target = small.current;
      if (source && target) {
        target.width = 400;
        target.height = 210;
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(source, 0, 0, 400, 210);
        }
      }
      frame = requestAnimationFrame(copy);
    };
    frame = requestAnimationFrame(copy);
    return () => cancelAnimationFrame(frame);
  }, [canvasRef]);

  return <canvas ref={small} className="block h-auto w-full" aria-hidden />;
}
