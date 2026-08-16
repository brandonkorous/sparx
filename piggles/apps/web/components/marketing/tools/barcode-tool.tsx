'use client';

import { useMemo, useState } from 'react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { barcodeSvg, encodeBarcode, SYMBOLOGIES, type Symbology } from './lib/barcode';
import { downloadBlob, safeFilename } from './lib/download';
import { Aside, CheckField, Panel, Problem, SelectField, TextField, ToolLayout } from './ui-kit';

/**
 * Barcodes for products, shelves and stock takes.
 *
 * ── THE ERROR MESSAGES ARE THE FEATURE ──────────────────────────────────────
 *
 * Every other generator responds to a wrong-length UPC with "invalid input". The
 * person typing it does not know whether they have too many digits, the wrong
 * symbology, or a number that was never a barcode. Each message here says what
 * is wrong, what the right shape is, and what to do — because the most common
 * reason somebody arrives at this page is that a number they were given does not
 * work, and "invalid" is not an answer to that.
 */
export function BarcodeTool() {
    const [symbology, setSymbology] = useState<Symbology>('code128');
    const [value, setValue] = useState('PIGGLES-001');
    const [showText, setShowText] = useState(true);
    const [height, setHeight] = useState('80');
    const [moduleWidth, setModuleWidth] = useState('2');

    const spec = SYMBOLOGIES.find((s) => s.value === symbology)!;

    const { result, error } = useMemo(() => {
        try {
            return { result: encodeBarcode(value, symbology), error: null };
        } catch (e) {
            return { result: null, error: e instanceof Error ? e.message : 'That could not be encoded.' };
        }
    }, [value, symbology]);

    const svg = result
        ? barcodeSvg(result, {
            moduleWidth: Math.max(1, Number(moduleWidth) || 2),
            height: Math.max(20, Number(height) || 80),
            showText,
        })
        : null;

    const isRetail = symbology !== 'code128' && symbology !== 'code39';

    return (
        <ToolLayout
            form={
                <>
                    <Panel title="Which kind" description="Two questions decide this, and only two.">
                        <SelectField
                            label="Type of barcode"
                            hint={spec.blurb}
                            value={symbology}
                            onChange={(v) => setSymbology(v)}
                            options={SYMBOLOGIES.map((s) => ({ value: s.value, label: s.label }))}
                        />

                        <TextField
                            label={isRetail ? 'The number' : 'What it should say'}
                            hint={spec.hint}
                            value={value}
                            onChange={setValue}
                            spellCheck={false}
                            inputMode={isRetail ? 'numeric' : 'text'}
                        />

                        {error ? <Problem>{error}</Problem> : null}

                        {isRetail ? (
                            <Aside>
                                <strong>Selling through shops or a marketplace?</strong> These numbers have to be
                                bought from GS1 — the whole system depends on no two products anywhere sharing a
                                code. For your own shelves, bins and stock counts, Code 128 needs no registration
                                and holds more.
                            </Aside>
                        ) : null}
                    </Panel>

                    <Panel title="Size" description="What matters is the proportions, not the pixels.">
                        <TextField
                            label="Bar height"
                            hint="80 is a good default. Taller is easier to scan at an angle, which matters on a shelf edge."
                            value={height}
                            onChange={setHeight}
                            inputMode="numeric"
                        />
                        <TextField
                            label="Narrowest bar"
                            hint="2 or 3 for a label; more for something scanned from a distance. Under 2 risks a printer smudging two bars together."
                            value={moduleWidth}
                            onChange={setModuleWidth}
                            inputMode="numeric"
                        />
                        <CheckField
                            label="Print the number underneath"
                            hint="Leave this on. When a scanner fails, somebody types it in — and if it is not printed, they cannot."
                            checked={showText}
                            onChange={setShowText}
                        />
                    </Panel>
                </>
            }
            output={
                <>
                    <Card>
                        <CardBody>
                            {svg && result ? (
                                <>
                                    {/* The SVG is trusted markup: it is built by our own encoder
 from a value that has already been through the symbology's
 character check, and both the label and the aria-label have
 their angle brackets stripped in barcodeSvg. */}
                                    <div
                                        className="rounded-box border-base-300 overflow-x-auto border bg-white p-6"
                                        dangerouslySetInnerHTML={{ __html: svg }}
                                    />

                                    <p className="mt-4 text-base">
                                        {isRetail ? (
                                            <>
                                                Check digit worked out and added — the full number is{' '}
                                                <span className="font-mono font-bold">{result.text}</span>.
                                            </>
                                        ) : (
                                            <>
                                                {result.modules} modules wide, including the plain margin either side that
                                                scanners need to find it.
                                            </>
                                        )}
                                    </p>

                                    <div className="mt-6 flex flex-col gap-3">
                                        <Button
                                            color="module"
                                            size="lg"
                                            block
                                            onClick={() =>
                                                downloadBlob(
                                                    new Blob([svg], { type: 'image/svg+xml' }),
                                                    `${safeFilename(result.text, 'barcode')}.svg`
                                                )
                                            }
                                        >
                                            Download SVG — use this for printing
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            block
                                            onClick={async () => {
                                                const png = await svgToPng(svg);
                                                downloadBlob(png, `${safeFilename(result.text, 'barcode')}.png`);
                                            }}
                                        >
                                            Download PNG
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p className="py-10 text-center text-base">
                                    Your barcode appears here as you type.
                                </p>
                            )}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <h3 className="text-lg font-bold">Before you print a thousand</h3>
                            <ul className="mt-3 flex flex-col gap-3 text-base">
                                <li>
                                    <strong>Do not squash it sideways.</strong> The bar widths carry the meaning, so
                                    stretching one axis and not the other stops it scanning. Scale both together.
                                </li>
                                <li>
                                    <strong>Leave the margins alone.</strong> The blank space at each end is how a
                                    scanner finds where the code begins. Cropping to the bars is the most common way a
                                    printed barcode fails.
                                </li>
                                <li>
                                    <strong>Black on white.</strong> Not on a colored background, not in your brand
                                    color, not on a dark label. Red is effectively invisible to some older scanners.
                                </li>
                                <li>
                                    <strong>Test the printed one</strong>, not the one on screen. The screen is not
                                    where it will fail.
                                </li>
                            </ul>
                        </CardBody>
                    </Card>
                </>
            }
        />
    );
}

/** Rasterise the SVG through an image and a canvas. At 3× so the PNG is usable
 * on a label printer rather than only on screen. */
async function svgToPng(svg: string): Promise<Blob> {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error('The barcode could not be turned into a picture.'));
            element.src = url;
        });

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('This browser would not give us a canvas to draw on.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed.'))), 'image/png')
        );
    } finally {
        URL.revokeObjectURL(url);
    }
}
