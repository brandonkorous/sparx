'use client';

import { useMemo, useState } from 'react';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { contrastRatio, gradeContrast, parseHex, readableInk, toHex } from './lib/color';
import { ColorField, Panel, Problem, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/**
 * The pairings that actually go wrong.
 *
 * Not a swatch library — every one of these is a specific failure somebody has
 * shipped. The pale-grey-on-white one is the most common design mistake on the
 * web; the white-on-mid-yellow one is what happens when a brand color is
 * treated as a button fill without anybody measuring the label on it.
 */
const COMMON_PAIRS: { label: string; note: string; fg: string; bg: string }[] = [
  {
    label: 'Pale grey on white',
    note: 'The classic. Looks refined, vanishes outdoors.',
    fg: '#9CA3AF',
    bg: '#FFFFFF',
  },
  {
    label: 'Mid grey on white',
    note: 'The usual “secondary text” color.',
    fg: '#6B7280',
    bg: '#FFFFFF',
  },
  {
    label: 'White on mid yellow',
    note: 'A brand color used as a button fill.',
    fg: '#FFFFFF',
    bg: '#F3B61F',
  },
  {
    label: 'White on a light green',
    note: 'The same mistake, in a success message.',
    fg: '#FFFFFF',
    bg: '#4ADE80',
  },
  {
    label: 'Pure white on pure black',
    note: 'Passes easily, and smears for many readers.',
    fg: '#FFFFFF',
    bg: '#000000',
  },
  {
    label: 'Off-white on dark grey',
    note: 'What dark mode should use instead.',
    fg: '#F4F5F7',
    bg: '#202631',
  },
];

function contrastOf(fg: string, bg: string): number {
  const a = parseHex(fg);
  const b = parseHex(bg);
  return a && b ? contrastRatio(a, b) : 1;
}

/**
 * Can everybody read that?
 *
 * ── THE ANSWER IS A SENTENCE, NOT A NUMBER ──────────────────────────────────
 *
 * Every contrast checker leads with the ratio —"4.31:1" — in very large type,
 * and a ratio is meaningless to somebody who has not memorised the thresholds.
 * The number is still here, because a designer wants it, but the first thing the
 * page says is whether the colors work and at what size, in words.
 *
 * The second thing it does is offer a fix. A checker that says "fail" and stops
 * has told somebody they have a problem and left them to solve it by nudging a
 * color picker; suggesting the nearest shade of their own color that passes is
 * the difference between a diagnostic and a tool.
 */
export function ContrastTool() {
  const [fg, setFg] = useState('#8B8B8B');
  const [bg, setBg] = useState('#FFFFFF');

  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  const verdict = useMemo(
    () => (fgRgb && bgRgb ? gradeContrast(fgRgb, bgRgb) : null),
    [fgRgb, bgRgb]
  );

  /**
   * The nearest version of the SAME color that passes.
   *
   * Darkening or lightening in a straight line towards black or white keeps the
   * hue somebody chose and changes only how dark it is — so the suggestion is
   * still recognisably their brand color, which is why they will actually take
   * it. Suggesting an unrelated color that happens to pass is advice nobody
   * follows.
   */
  const suggestion = useMemo(() => {
    if (!fgRgb || !bgRgb || !verdict || verdict.aaNormal) return null;

    const target = readableInk(bgRgb); // black or white, whichever direction helps
    for (let step = 0.05; step <= 1; step += 0.05) {
      const mixed = {
        r: Math.round(fgRgb.r + (target.r - fgRgb.r) * step),
        g: Math.round(fgRgb.g + (target.g - fgRgb.g) * step),
        b: Math.round(fgRgb.b + (target.b - fgRgb.b) * step),
      };
      if (gradeContrast(mixed, bgRgb).aaNormal) {
        return { hex: toHex(mixed), direction: target.r === 0 ? 'darker' : 'lighter' };
      }
    }
    return null;
  }, [fgRgb, bgRgb, verdict]);

  // The verdict travels as a sentence, the same way the page says it. And when
  // the pair fails, the suggested shade goes WITH it: an email that says "this
  // does not work" and stops has handed somebody a problem and kept the answer.
  useReportToolResult(
    verdict
      ? {
          lines: [
            { label: 'Text color', value: fg.toUpperCase() },
            { label: 'Background color', value: bg.toUpperCase() },
            { label: 'Contrast', value: `${verdict.ratio.toFixed(2)} to 1` },
            {
              label: 'Smallest size it can be read at',
              value: verdict.smallestUsable ?? 'Not readable at any size',
            },
            ...(suggestion
              ? [
                  {
                    label: 'Nearest shade that works',
                    value: `${suggestion.hex.toUpperCase()} — the same color, ${suggestion.direction}`,
                  },
                ]
              : []),
          ],
          note: 'This is about whether people can read it, not about whether it looks good. Bright sunlight, an old screen and tired eyes all take contrast away, and the person who cannot read it will not tell you.',
        }
      : null
  );

  const swap = () => {
    setFg(bg);
    setBg(fg);
  };

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel
            title="The two colors"
            description="The color of the text, and whatever is behind it."
          >
            <ColorField label="Text color" value={fg} onChange={setFg} />
            <ColorField label="Background color" value={bg} onChange={setBg} />

            <button
              type="button"
              onClick={swap}
              className="self-start text-base font-semibold underline underline-offset-4"
            >
              Swap them round
            </button>

            {!fgRgb || !bgRgb ? (
              <Problem>
                That is not a color we can read. Use a six-digit hex code like{' '}
                <span className="font-mono">#3B2F33</span>, or click the swatch to pick one.
              </Problem>
            ) : null}
          </Panel>

          {/* This form is two fields, and two fields beside a tall result left
 most of this column empty. Rather than pad it, it now carries the
 thing somebody came here to find out and did not know to ask: WHICH
 pairs to check. Every one of these is a real place text goes wrong,
 and each loads in one tap. */}
          <Panel
            title="Pairs worth checking"
            description="The ones that fail on real sites. Tap to load."
          >
            <div className="flex flex-col gap-2">
              {COMMON_PAIRS.map((pair) => {
                const ratio = contrastOf(pair.fg, pair.bg);
                return (
                  <button
                    key={pair.label}
                    type="button"
                    onClick={() => {
                      setFg(pair.fg);
                      setBg(pair.bg);
                    }}
                    className="border-base-300 rounded-field hover:border-module flex items-center gap-3 border p-3 text-left transition-colors"
                  >
                    <span
                      aria-hidden
                      className="rounded-selector border-base-300 grid size-10 shrink-0 place-items-center border text-sm font-bold"
                      style={{ backgroundColor: pair.bg, color: pair.fg }}
                    >
                      Aa
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">{pair.label}</span>
                      <span className="block text-base">{pair.note}</span>
                    </span>
                    <Badge
                      color={ratio >= 4.5 ? 'success' : ratio >= 3 ? 'warning' : 'danger'}
                      variant="soft"
                    >
                      {ratio.toFixed(1)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="The bits people forget">
            <p className="text-base">
              <strong>Text on a photo.</strong> The background changes from one corner to the next,
              so check it against the lightest part, not the average.
            </p>
            <p className="text-base">
              <strong>Placeholder text in a form.</strong> Almost always too faint, and it is
              frequently carrying the instruction for the field.
            </p>
            <p className="text-base">
              <strong>The focus outline.</strong> The ring that shows where you are when moving by
              keyboard. Invisible on most sites, and the only way some people can use them at all.
            </p>
            <p className="text-base">
              <strong>Dark mode.</strong> A different pairing, so it has to be checked separately.
              Passing in light mode says nothing about the other one.
            </p>
          </Panel>
        </>
      }
      output={
        verdict && fgRgb && bgRgb ? (
          <>
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="text-2xl font-extrabold">
                    {verdict.smallestUsable ?? 'These two do not work together'}
                  </h2>
                  <span className="font-mono text-2xl font-bold" title="Contrast ratio">
                    {verdict.ratio.toFixed(2)}:1
                  </span>
                </div>

                <p className="mt-3 text-base">
                  {verdict.aaaNormal
                    ? 'Comfortably readable at any size, and it clears the stricter standard as well — worth having on anything people read at length.'
                    : verdict.aaNormal
                      ? 'Readable at any size. This clears the standard that applies to ordinary body text.'
                      : verdict.aaLarge
                        ? 'This works for headings and large text, but not for anything set small. Body text in this pairing will be hard work on a phone in daylight.'
                        : 'This pairing fails at every size. It may look fine on the screen you are reading it on, and it will disappear on a phone outdoors, or for anybody whose eyes are older than yours.'}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Body text', pass: verdict.aaNormal, note: 'Anything under 24px' },
                    { label: 'Large text', pass: verdict.aaLarge, note: '24px, or 19px bold' },
                    {
                      label: 'Strictest standard',
                      pass: verdict.aaaNormal,
                      note: 'AAA, body text',
                    },
                    {
                      label: 'Icons and borders',
                      pass: verdict.uiComponents,
                      note: 'Buttons, input outlines, chart lines',
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="border-base-300 rounded-field flex items-start justify-between gap-3 border p-3"
                    >
                      <span>
                        <span className="block text-base font-semibold">{row.label}</span>
                        <span className="block text-base">{row.note}</span>
                      </span>
                      {/* A semantic color, not neutral: this badge distinguishes
 a pass from a failure, so the color has to carry it. */}
                      <Badge color={row.pass ? 'success' : 'danger'} variant="soft">
                        {row.pass ? 'Passes' : 'Fails'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {suggestion ? (
              <Card>
                <CardBody>
                  <h3 className="text-lg font-bold">Try this instead</h3>
                  <p className="mt-2 text-base">
                    The same color, a little {suggestion.direction}. It passes at every size and is
                    close enough that nobody will notice it changed.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {/* Painted inline for the same reason as the preview below:
 this is the visitor's color, not one of ours. */}
                    <span
                      aria-hidden
                      className="rounded-field border-base-300 size-12 border"
                      style={{ backgroundColor: suggestion.hex }}
                    />
                    <span className="font-mono text-lg font-bold">{suggestion.hex}</span>
                    <button
                      type="button"
                      onClick={() => setFg(suggestion.hex)}
                      className="text-base font-semibold underline underline-offset-4"
                    >
                      Use it
                    </button>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            <ContrastPreview fg={fg} bg={bg} />
          </>
        ) : null
      }
    />
  );
}

/**
 * The pair at real sizes.
 *
 * ── THE ONE PLACE AN INLINE STYLE IS UNAVOIDABLE ────────────────────────────
 *
 * The colors here are typed by a person, one keystroke at a time. There is no
 * token for them and there cannot be — they are not ours, they are the visitor's
 * brand, and the whole purpose of this tool is to render an arbitrary pair.
 *
 * DESIGN.md §8 bans inline `style` for painting Piggles surfaces, and this is not
 * one: it is the sample under test. Everything AROUND it — the card, the border,
 * the labels — is tokens as usual. Confining the paint to this one component
 * keeps that boundary obvious, which is why the preview lives here rather than
 * being spread through the page above.
 */
function ContrastPreview({ fg, bg }: { fg: string; bg: string }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold">How it actually looks</h3>
        <div
          className="rounded-box border-base-300 mt-4 border p-6"
          style={{ backgroundColor: bg, color: fg }}
        >
          <p className="text-3xl font-extrabold">A heading, set large</p>
          <p className="mt-3 text-lg">
            A line of the sort of text that goes under a heading, at the size most sites use for
            reading.
          </p>
          <p className="mt-3 text-base">
            And this is body text, which is the size that most often fails. If you are squinting at
            this line, that is the answer.
          </p>
          <p className="mt-3 text-sm">
            Small print, a caption, or the line under a form field explaining what to type.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
