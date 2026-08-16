'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Dropzone,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from '@wizeworks/silicaui-react';
import { averageColour, drawSquare, loadImageFile, type LoadedImage } from './lib/canvas';
import { buildFaviconSet, type FaviconOutput } from './lib/favicon';
import { downloadBlob } from './lib/download';
import { Aside, CodeOut, ColourField, Panel, Problem, TextField, ToolLayout } from './ui-kit';

/**
 * One picture in, the whole set out.
 *
 * ── THE PREVIEW IS AT SIXTEEN PIXELS, ON PURPOSE ────────────────────────────
 *
 * Every favicon generator shows you a 512-pixel version, where any logo looks
 * fine. The size that decides whether a favicon works is sixteen pixels, and the
 * only useful thing this page can do is show it to somebody at that size, in a
 * row of real browser tabs, before they commit.
 *
 * Half the people who see their full logo at sixteen pixels go back and use just
 * the mark. That realisation is worth more than the files.
 */
export function FaviconTool() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [output, setOutput] = useState<FaviconOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [background, setBackground] = useState('#FFFFFF');
  const [appName, setAppName] = useState('My business');
  const [themeColour, setThemeColour] = useState('#FF6F86');

  const accept = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      const loaded = await loadImageFile(file);
      setImage(loaded);
      // Suggest a background from the logo itself. Somebody with a transparent
      // PNG has no idea their Apple icon needs an opaque colour, and offering a
      // sensible one beats leaving the field white and hoping.
      if (loaded.hasTransparency) {
        setBackground(averageColour(drawSquare(loaded, { size: 64, fit: 'contain' })));
      }
    } catch (e) {
      setImage(null);
      setError(e instanceof Error ? e.message : 'That image could not be opened.');
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (!image) {
      setOutput(null);
      return;
    }
    let cancelled = false;
    setWorking(true);
    buildFaviconSet(image, { background, appName, themeColour })
      .then((built) => {
        if (!cancelled) setOutput(built);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The icons could not be made.');
      })
      .finally(() => {
        if (!cancelled) setWorking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [image, background, appName, themeColour]);

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel title="Your picture" description="A square PNG or SVG works best.">
            <Dropzone
              className="border-module"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              multiple={false}
              maxSize={12 * 1024 * 1024}
              onFiles={accept}
              title={image ? 'Drop a different picture' : 'Drop your logo here, or click to choose'}
              hint="PNG, SVG, JPG or WebP. It never leaves your computer."
            />

            {error ? <Problem>{error}</Problem> : null}

            {image ? (
              <Aside>
                {image.isVector
                  ? 'An SVG — the best possible source. It can be drawn perfectly sharp at every size.'
                  : image.width < 512
                    ? `That picture is ${image.width}×${image.height}. Anything under 512 across has to be scaled up for the large icons, which softens them. If you have a bigger version, use that.`
                    : `${image.width}×${image.height} — plenty to work with.`}
              </Aside>
            ) : (
              <Aside>
                <strong>Use the mark, not the whole logo.</strong> At sixteen pixels the words in a
                logo become a grey smudge, and every smudge looks the same. The one distinctive
                shape — the symbol, the first letter, the animal — is what people recognise.
              </Aside>
            )}
          </Panel>

          {image ? (
            <Panel title="The details" description="Used for the phone and home-screen icons.">
              <ColourField
                label="Background for the phone icon"
                hint="iPhones turn transparency black, so the home-screen icon has to be solid. This is the colour behind your logo there."
                value={background}
                onChange={setBackground}
              />
              <TextField
                label="Your business name"
                hint="Shown under the icon when somebody saves your site to their home screen."
                value={appName}
                onChange={setAppName}
              />
              <ColourField
                label="Browser colour"
                hint="Tints the browser's own bar on a phone. Usually your main brand colour."
                value={themeColour}
                onChange={setThemeColour}
              />
            </Panel>
          ) : null}
        </>
      }
      output={
        image ? (
          <>
            <TabPreview image={image} background={background} />

            {output ? (
              <>
                <Card>
                  <CardBody>
                    <h3 className="text-lg font-bold">Every size, ready to go</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {output.files.map((file) => (
                        <div key={file.name} className="border-base-300 rounded-field border p-3">
                          <p className="font-mono text-sm font-bold">{file.name}</p>
                          <p className="mt-1 text-base">{file.note}</p>
                        </div>
                      ))}
                    </div>

                    <Button
                      color="module"
                      size="lg"
                      block
                      className="mt-6"
                      disabled={working}
                      onClick={async () => downloadBlob(await output.zip(), 'favicons.zip')}
                    >
                      {working ? 'Preparing…' : 'Download all of them'}
                    </Button>
                    <p className="mt-3 text-base">
                      A zip with every file, the manifest, the markup to paste, and a plain-English
                      note explaining where each one goes.
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody>
                    <h3 className="text-lg font-bold">The code to paste</h3>
                    <Tabs defaultValue="html" className="mt-4">
                      <TabsList>
                        <TabsTab value="html">Any website</TabsTab>
                        <TabsTab value="next">Next.js</TabsTab>
                        <TabsTab value="manifest">The manifest</TabsTab>
                      </TabsList>
                      <TabsPanel value="html">
                        <CodeOut
                          code={output.html}
                          hint="Goes inside the <head> of every page. Put the files themselves in the root folder of your site."
                        />
                      </TabsPanel>
                      <TabsPanel value="next">
                        <CodeOut code={output.nextjs} />
                      </TabsPanel>
                      <TabsPanel value="manifest">
                        <CodeOut
                          code={output.manifest}
                          hint="Save this as site.webmanifest in your root folder."
                        />
                      </TabsPanel>
                    </Tabs>
                  </CardBody>
                </Card>
              </>
            ) : null}
          </>
        ) : (
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">What you will get</h3>
              <p className="mt-2 text-base">
                Six files and a manifest — the browser tab icon, the one iPhones put on a home
                screen, the two Android reads, a version with room around it for launchers that crop
                to a circle, and the multi-size <span className="font-mono">.ico</span> browsers ask
                for whether you link to it or not.
              </p>
              <p className="mt-3 text-base">
                Plus the exact lines to paste, in plain HTML and in the form modern frameworks
                expect.
              </p>
            </CardBody>
          </Card>
        )
      }
    />
  );
}

/**
 * The honest preview: a strip of browser tabs at real size.
 *
 * Three neighbours are drawn beside it, because a favicon is never seen alone —
 * it is seen in a row of twelve, and the question is whether yours is findable
 * among them. Showing it in isolation is the flattering version and the useless
 * one.
 */
function TabPreview({ image, background }: { image: LoadedImage; background: string }) {
  const small = useRef<HTMLCanvasElement>(null);
  const medium = useRef<HTMLCanvasElement>(null);
  const apple = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const paint = (
      ref: React.RefObject<HTMLCanvasElement | null>,
      size: number,
      bg?: string,
      pad?: number
    ) => {
      const target = ref.current;
      if (!target) return;
      const drawn = drawSquare(image, { size, background: bg, padding: pad, fit: 'contain' });
      target.width = size;
      target.height = size;
      target.getContext('2d')?.drawImage(drawn, 0, 0);
    };
    paint(small, 16);
    paint(medium, 32);
    paint(apple, 180, background);
  }, [image, background]);

  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold">At the size that actually matters</h3>
        <p className="mt-2 text-base">
          Sixteen pixels, in a row of tabs. If you cannot pick yours out at a glance, simplify it —
          that is the whole test.
        </p>

        <div className="rounded-box border-base-300 bg-base-200 mt-4 flex items-end gap-1 overflow-x-auto border p-3">
          <div className="bg-base-100 rounded-t-field flex min-w-[9rem] items-center gap-2 px-3 py-2">
            <canvas
              ref={small}
              width={16}
              height={16}
              className="size-4 shrink-0"
              aria-label="Your favicon at 16 pixels"
            />
            <span className="truncate text-sm font-semibold">Your site</span>
          </div>
          {['Inbox (14)', 'Orders', 'Docs'].map((label) => (
            <div
              key={label}
              className="rounded-t-field flex min-w-[8rem] items-center gap-2 px-3 py-2 opacity-70"
            >
              <span aria-hidden className="bg-base-300 size-4 shrink-0 rounded-sm" />
              <span className="truncate text-sm">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-8">
          <div>
            <canvas
              ref={medium}
              width={32}
              height={32}
              className="size-8"
              aria-label="At 32 pixels"
            />
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
