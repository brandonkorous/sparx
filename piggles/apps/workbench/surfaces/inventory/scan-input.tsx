'use client';

// THE SCAN INPUT — the one control every scan-driven screen is built around.
//
// ── A barcode scanner is a keyboard ───────────────────────────────────────
//
// Almost every gun in existence is a USB or Bluetooth keyboard that types the
// code very fast and presses Enter. So the primary input here is a plain text
// field: no driver, no pairing, no permission prompt, and it works with hardware
// the tenant already owns. Submit-on-Enter IS the scan.
//
// The field re-focuses itself after every scan, and that is not a nicety — a
// receiver holding a box in one hand and a gun in the other cannot click back
// into an input, and a screen that loses focus after each item is a screen that
// gets abandoned within an hour.
//
// ── The camera is the second path, not the first ──────────────────────────
//
// `BarcodeDetector` is built into Chromium browsers, so a phone or tablet with a
// camera can scan with no app and no library. Where it is missing (Safari,
// Firefox) the button simply does not appear — a broken camera button is worse
// than no camera button, and the keyboard path always works.
//
// ── Sound, because nobody is looking at the screen ────────────────────────
//
// The person is looking at the box. A rising tone means it went on, a falling
// one means look up. Generated with the Web Audio API rather than shipped as an
// asset: two oscillator beeps are a dozen lines and no network request, and a
// warehouse tablet on a bad connection should not be waiting on an mp3 to tell
// somebody their scan failed.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Input, Kbd, Text } from '@wizeworks/silicaui-react';
import {
  faBarcodeRead,
  faCamera,
  faCameraSlash,
  faWifiSlash,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { scanTone, type ScanActionResult, type ScanOutcome } from './scan-data';

/* ── Sound ──────────────────────────────────────────────────────────────── */

let audioContext: AudioContext | null = null;

function tone(frequency: number, durationMs: number, delayMs = 0): void {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    // Browsers suspend the context until a gesture; a scan IS one, but a page
    // restored from the back/forward cache can arrive suspended.
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    osc.type = 'square';
    // A hard square wave carries across a warehouse; the short ramp stops it
    // clicking, which over eight hours is the difference between a signal and
    // an irritation.
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delayMs / 1000);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + delayMs / 1000 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (delayMs + durationMs) / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + delayMs / 1000);
    osc.stop(ctx.currentTime + (delayMs + durationMs) / 1000 + 0.02);
  } catch {
    // No audio device, or a browser that refuses. Silence is an acceptable
    // degradation; a thrown error in a scan handler is not.
  }
}

/** Rising two-note chirp: it went on. */
function beepOk(): void {
  tone(880, 60);
  tone(1320, 70, 70);
}
/** Falling buzz: stop and look at the screen. */
function beepBad(): void {
  tone(320, 180);
}
/** Flat single note: we already had that one. */
function beepDuplicate(): void {
  tone(660, 120);
}

export function playScanFeedback(outcome: ScanOutcome): void {
  if (outcome === 'applied') beepOk();
  else if (outcome === 'duplicate') beepDuplicate();
  else beepBad();
}

/* ── Camera ─────────────────────────────────────────────────────────────── */

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    // The same code twice in a row is one box held in front of the lens for two
    // seconds, not two boxes. Without this the camera path fires forty times.
    let lastValue = '';
    let lastAt = 0;

    void (async () => {
      const Ctor = detectorCtor();
      if (!Ctor) {
        setError('This browser cannot use the camera to scan. Use a scanner, or type the code.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // The back camera, which is the one pointed at the box.
          video: { facingMode: 'environment' },
        });
      } catch {
        setError('The camera could not be opened. Check the browser has permission.');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detector = new Ctor({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_39', 'qr_code'],
      });
      const tick = async () => {
        if (stopped) return;
        try {
          const hits = await detector.detect(video);
          const value = hits[0]?.rawValue;
          const now = Date.now();
          if (value && (value !== lastValue || now - lastAt > 2000)) {
            lastValue = value;
            lastAt = now;
            onScan(value);
          }
        } catch {
          // A frame that cannot be decoded is the normal case, not an error.
        }
        frame = requestAnimationFrame(() => void tick());
      };
      frame = requestAnimationFrame(() => void tick());
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <Alert color="warning">{error}</Alert>
      ) : (
        <div className="rounded-box relative overflow-hidden">
          <video ref={videoRef} className="h-56 w-full object-cover" playsInline muted />
          {/* The aiming line. Purely to tell somebody where to hold the box —
              the detector reads the whole frame. */}
          <div className="bg-danger pointer-events-none absolute inset-x-6 top-1/2 h-0.5" />
        </div>
      )}
      <Button variant="outline" color="neutral" size="sm" onClick={onClose}>
        <Icon glyph={faCameraSlash} className="size-4" aria-hidden />
        Close camera
      </Button>
    </div>
  );
}

/* ── The control ────────────────────────────────────────────────────────── */

export interface ScanInputProps {
  /** Fired once per trigger pull, with the raw code. */
  onScan: (value: string) => void | Promise<void>;
  /** What the person is scanning INTO, e.g. "Scan a product". */
  placeholder?: string;
  /** The result of the last scan, rendered as the feedback line. */
  result?: ScanActionResult | null;
  /** Disable while a scan is in flight, or when the session is closed. */
  disabled?: boolean;
  busy?: boolean;
  /** Number of scans waiting to sync. Shown as a standing warning when non-zero. */
  queued?: number;
  /** Bigger everything, for warehouse mode on a tablet. */
  large?: boolean;
  /**
   * Take focus on mount. On by default — the gun needs somewhere to type.
   *
   * Not named `autoFocus`: that is the DOM attribute, and this is an imperative
   * `.focus()` after mount, which behaves differently and does not trip the a11y
   * rule that (correctly) bans the attribute.
   */
  focusOnMount?: boolean;
}

export function ScanInput({
  onScan,
  placeholder = 'Scan or type a code',
  result,
  disabled,
  busy,
  queued = 0,
  large,
  focusOnMount = true,
}: ScanInputProps) {
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasCamera = detectorCtor() !== null;

  const submit = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.length === 0) return;
      setValue('');
      await onScan(trimmed);
      // Back to the field, every time. A receiver cannot click.
      inputRef.current?.focus();
    },
    [onScan]
  );

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(value);
        }}
      >
        <Input
          ref={inputRef}
          color="module-inventory"
          size={large ? 'xl' : 'md'}
          className="flex-1 font-mono"
          placeholder={placeholder}
          aria-label={placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          // A scanner sends the code then Enter. Nothing else to configure.
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          // `search` so a phone keyboard shows a submit key rather than a return.
          enterKeyHint="search"
        />
        <Button
          type="submit"
          color="module-inventory"
          size={large ? 'xl' : 'md'}
          disabled={disabled === true || busy === true || value.trim().length === 0}
        >
          <Icon glyph={faBarcodeRead} className="size-4" aria-hidden />
          {busy ? 'Working…' : 'Enter'}
        </Button>
        {hasCamera ? (
          <Button
            type="button"
            variant="outline"
            color="module-inventory"
            size={large ? 'xl' : 'md'}
            aria-label={cameraOpen ? 'Close the camera' : 'Scan with the camera'}
            onClick={() => {
              setCameraOpen((open) => !open);
            }}
          >
            <Icon glyph={faCamera} className="size-4" aria-hidden />
          </Button>
        ) : null}
      </form>

      {cameraOpen ? (
        <CameraScanner
          onScan={(code) => {
            void submit(code);
          }}
          onClose={() => {
            setCameraOpen(false);
          }}
        />
      ) : null}

      {queued > 0 ? (
        <Alert color="warning" size="sm">
          <Icon glyph={faWifiSlash} className="size-4" aria-hidden />
          <span>
            {queued} scan{queued === 1 ? '' : 's'} saved on this device. They will sync by
            themselves when the connection is back — keep going.
          </span>
        </Alert>
      ) : null}

      {result ? <ScanFeedback result={result} /> : null}

      {!result && !cameraOpen ? (
        <Text className="text-sm">
          Point the scanner and pull the trigger, or type a code and press{' '}
          <Kbd size="sm">Enter</Kbd>.
        </Text>
      ) : null}
    </div>
  );
}

/**
 * The feedback line.
 *
 * Big, colored, and one sentence. Everything about a scan result has to be
 * legible from arm's length at a glance, because that is the distance and the
 * duration a person can spare between putting one box down and picking the next
 * one up.
 */
export function ScanFeedback({ result }: { result: ScanActionResult }) {
  const tone = scanTone(result.outcome);
  return (
    <Alert color={tone} variant="soft" className="items-center">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{result.message}</span>
        {result.match?.code ? <span className="truncate text-sm">{result.match.code}</span> : null}
      </span>
      {result.quantity > 0 ? (
        <Badge color={tone} size="lg">
          +{result.quantity}
        </Badge>
      ) : null}
    </Alert>
  );
}
