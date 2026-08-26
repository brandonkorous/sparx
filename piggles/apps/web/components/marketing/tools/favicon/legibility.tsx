'use client';

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import { contrastRatio, parseHex } from '../lib/color';
import { LEGIBLE, sayRatio, type BackdropReading } from '../lib/favicon-backdrop';

/**
 * What the chosen background will actually look like, as a measurement.
 * It reports and never overrules: pick purple and you get purple, on every icon,
 * unmodified. Nothing here writes a value back into a field.
 */

const SCALE =
  'That is how far apart two colors are, on a scale from 1 to 21. Three to one is where a shape stops being hard to make out.';

export function Legibility({
  reading,
  backdrop,
  background,
}: {
  reading: BackdropReading | null;
  backdrop: 'see-through' | 'solid';
  background: string;
}) {
  // Too little drawn to average meaningfully.
  if (!reading || reading.ink.coverage < 0.02) return null;

  if (backdrop === 'solid') {
    return <OnChosenColor reading={reading} background={background} />;
  }
  if (!reading.seeThroughMatters) return null;
  return <OnEitherTab reading={reading} />;
}

function OnChosenColor({ reading, background }: { reading: BackdropReading; background: string }) {
  const bg = parseHex(background);
  if (!bg) return null;
  const ratio = contrastRatio(reading.ink.rgb, bg);
  const ok = ratio >= LEGIBLE;

  return (
    <Alert color={ok ? 'success' : 'warning'} variant="soft" role="status">
      <AlertContent>
        <AlertTitle>
          {ok
            ? 'Your logo reads clearly on that background'
            : 'Your logo will be hard to make out on that background'}
        </AlertTitle>
        <AlertDescription>
          Against {background.toUpperCase()} it measures {sayRatio(ratio)}. {SCALE}
          {ok
            ? ' Every icon in the set will be built on that color.'
            : ` Every icon in the set will still be built on exactly that color — this is your choice, not ours. If you want more separation, ${reading.suggested} would give you ${sayRatio(reading.onSuggested)}.`}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function OnEitherTab({ reading }: { reading: BackdropReading }) {
  const { readsOnLight, readsOnDark, onLight, onDark } = reading;

  if (readsOnLight && readsOnDark) {
    return (
      <Alert color="success" variant="soft" role="status">
        <AlertContent>
          <AlertTitle>See-through works for this logo</AlertTitle>
          <AlertDescription>
            It measures {sayRatio(onLight)} on a white browser tab and {sayRatio(onDark)} on a dark
            one, so it holds up either way. {SCALE}
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  return (
    <Alert color="warning" variant="soft" role="status">
      <AlertContent>
        <AlertTitle>
          This logo will nearly vanish on a {readsOnDark ? 'light' : 'dark'} browser tab
        </AlertTitle>
        <AlertDescription>
          A see-through icon sits straight on the browser&rsquo;s own color, and not everybody uses
          the same one. Yours measures {sayRatio(onLight)} on a white tab and {sayRatio(onDark)} on
          a dark one. {SCALE} Choosing a solid color above is what fixes it — {reading.suggested}{' '}
          would give it {sayRatio(reading.onSuggested)} on every tab, whatever the reader has
          chosen.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
