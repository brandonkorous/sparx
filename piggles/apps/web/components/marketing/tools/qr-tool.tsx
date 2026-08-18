'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { downloadBlob, safeFilename } from './lib/download';
import { canvasToBlob } from './lib/canvas';
import { parseHex, contrastRatio } from './lib/color';
import {
  EC_LEVELS,
  emailPayload,
  encodeQr,
  smsPayload,
  telPayload,
  wifiPayload,
  type EcLevel,
  type QrResult,
} from './lib/qr';
import {
  Aside,
  Blank,
  CheckField,
  ColorField,
  Panel,
  Problem,
  SelectField,
  TextField,
  ToolLayout,
} from './ui-kit';

type Kind = 'link' | 'text' | 'wifi' | 'card' | 'email' | 'sms' | 'phone';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'link', label: 'A web address' },
  { value: 'wifi', label: 'Your Wi-Fi' },
  { value: 'text', label: 'A message' },
  { value: 'email', label: 'An email to you' },
  { value: 'sms', label: 'A text message to you' },
  { value: 'phone', label: 'Your phone number' },
  { value: 'card', label: 'Your contact details' },
];

/**
 * The QR maker.
 *
 * ── THE SIZE IS PINNED WHILE YOU TYPE ───────────────────────────────────────
 *
 * A QR code grows a ring of modules every time the content crosses a capacity
 * boundary, so a live preview jumps between sizes on individual keystrokes — the
 * pattern re-flows completely and the eye loses it. `minVersion` holds the
 * symbol at the largest size it has needed this session, so it only ever grows,
 * and only once. It is a one-argument fix for something that otherwise makes the
 * whole preview feel broken.
 */
export function QrTool() {
  const [kind, setKind] = useState<Kind>('link');
  const [link, setLink] = useState('https://');
  const [text, setText] = useState('');
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiSecurity, setWifiSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardPhone, setCardPhone] = useState('');
  const [cardEmail, setCardEmail] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [phone, setPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  const [dark, setDark] = useState('#202631');
  const [light, setLight] = useState('#FFFFFF');
  const [ec, setEc] = useState<EcLevel>('M');
  const [quietZone, setQuietZone] = useState(true);

  const [floor, setFloor] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload = useMemo(() => {
    switch (kind) {
      case 'link':
        return link.trim() === 'https://' ? '' : link.trim();
      case 'text':
        return text;
      case 'wifi':
        return ssid
          ? wifiPayload({
              ssid,
              password: wifiPassword,
              security: wifiSecurity,
              hidden: wifiHidden,
            })
          : '';
      case 'email':
        return emailTo ? emailPayload(emailTo, emailSubject, '') : '';
      case 'sms':
        return phone ? smsPayload(phone, smsMessage) : '';
      case 'phone':
        return phone ? telPayload(phone) : '';
      case 'card':
        // A short vCard rather than the full one — a contact card QR is scanned
        // from a distance, and every extra field makes the pattern denser and
        // harder to read. The digital business card tool does the full version.
        return cardName || cardPhone || cardEmail
          ? `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${cardName}\r\n${cardPhone ? `TEL:${cardPhone}\r\n` : ''}${cardEmail ? `EMAIL:${cardEmail}\r\n` : ''}END:VCARD`
          : '';
    }
  }, [
    kind,
    link,
    text,
    ssid,
    wifiPassword,
    wifiSecurity,
    wifiHidden,
    emailTo,
    emailSubject,
    phone,
    smsMessage,
    cardName,
    cardPhone,
    cardEmail,
  ]);

  let result: QrResult | null = null;
  let error: string | null = null;
  try {
    if (payload) result = encodeQr(payload, ec, floor);
  } catch (e) {
    error = e instanceof Error ? e.message : 'That could not be encoded.';
  }

  // Ratchet the floor upward so the preview never shrinks mid-edit.
  useEffect(() => {
    if (result && result.version > floor) setFloor(result.version);
  }, [result, floor]);

  // Reset it when the KIND changes — a Wi-Fi code and a short link are different
  // documents, and holding a phone number at the size of a vCard wastes half the
  // print area on empty pattern.
  useEffect(() => setFloor(1), [kind]);

  const darkRgb = parseHex(dark);
  const lightRgb = parseHex(light);
  const contrast = darkRgb && lightRgb ? contrastRatio(darkRgb, lightRgb) : 21;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    drawQr(canvas, result, { dark, light, quiet: quietZone ? 4 : 0, scale: 12 });
  }, [result, dark, light, quietZone]);

  const filename = safeFilename(
    kind === 'link' ? link.replace(/^https?:\/\//, '') : kind === 'wifi' ? ssid : kind,
    'qr-code'
  );

  return (
    <ToolLayout
      outputWidth="narrow"
      form={
        <>
          <Panel title="What should it do?" description="What happens when somebody scans it.">
            <SelectField
              label="When scanned, this code…"
              value={kind}
              onChange={setKind}
              options={KINDS}
            />

            {kind === 'link' ? (
              <TextField
                label="Web address"
                hint="A shorter address makes a simpler pattern, and a simpler pattern survives being printed small."
                value={link}
                onChange={setLink}
                inputMode="url"
                spellCheck={false}
                placeholder="https://bellacafe.example/menu"
              />
            ) : null}

            {kind === 'text' ? (
              <TextField
                label="The message"
                hint="Shown on the phone as plain text. Good for an instruction, a table number, or a code."
                value={text}
                onChange={setText}
              />
            ) : null}

            {kind === 'wifi' ? (
              <>
                <TextField
                  label="Network name"
                  hint="Exactly as it appears in the Wi-Fi list, including capitals."
                  value={ssid}
                  onChange={setSsid}
                  spellCheck={false}
                />
                <TextField
                  label="Password"
                  value={wifiPassword}
                  onChange={setWifiPassword}
                  spellCheck={false}
                />
                <SelectField
                  label="Security"
                  value={wifiSecurity}
                  onChange={setWifiSecurity}
                  options={[
                    { value: 'WPA', label: 'WPA / WPA2 / WPA3 — nearly always this' },
                    { value: 'WEP', label: 'WEP — very old equipment' },
                    { value: 'nopass', label: 'No password' },
                  ]}
                />
                <CheckField
                  label="The network is hidden"
                  hint="Only tick this if your network does not appear in the list of nearby ones."
                  checked={wifiHidden}
                  onChange={setWifiHidden}
                />
                <Aside>
                  Printing this puts your Wi-Fi password on the wall. That is usually the point —
                  but put it on the guest network rather than the one the till is on.
                </Aside>
              </>
            ) : null}

            {kind === 'card' ? (
              <>
                <TextField label="Name" value={cardName} onChange={setCardName} />
                <TextField
                  label="Phone"
                  value={cardPhone}
                  onChange={setCardPhone}
                  inputMode="tel"
                />
                <TextField
                  label="Email"
                  value={cardEmail}
                  onChange={setCardEmail}
                  inputMode="email"
                />
              </>
            ) : null}

            {kind === 'email' ? (
              <>
                <TextField
                  label="Your email address"
                  value={emailTo}
                  onChange={setEmailTo}
                  inputMode="email"
                />
                <TextField
                  label="Subject (optional)"
                  hint="Filled in for them. Useful for sorting — “Table booking”, “Quote request”."
                  value={emailSubject}
                  onChange={setEmailSubject}
                />
              </>
            ) : null}

            {kind === 'sms' ? (
              <>
                <TextField label="Your number" value={phone} onChange={setPhone} inputMode="tel" />
                <TextField
                  label="Message to start them off (optional)"
                  value={smsMessage}
                  onChange={setSmsMessage}
                />
              </>
            ) : null}

            {kind === 'phone' ? (
              <TextField
                label="Your number"
                hint="Include the country code if you have customers abroad."
                value={phone}
                onChange={setPhone}
                inputMode="tel"
              />
            ) : null}
          </Panel>

          <Panel title="How it looks">
            <ColorField label="The pattern" value={dark} onChange={setDark} />
            <ColorField label="Behind it" value={light} onChange={setLight} />

            {contrast < 4 ? (
              <Problem>
                These two colors are too close together for a scanner to tell apart. A phone camera
                needs a strong difference — dark pattern, light background. Black on white always
                works.
              </Problem>
            ) : null}

            <SelectField
              label="Damage it can survive"
              hint={EC_LEVELS.find((l) => l.value === ec)?.blurb}
              value={ec}
              onChange={setEc}
              options={EC_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
            />

            <CheckField
              label="Keep a plain margin around it"
              hint="Scanners need clear space to find where the code starts. Leave this on unless you are placing it inside something that already has a margin."
              checked={quietZone}
              onChange={setQuietZone}
            />
          </Panel>
        </>
      }
      output={
        // The empty state is NOT a bordered box with a line of centred text in
        // it. That is what was here, and on a page whose right-hand column is
        // otherwise a large black-and-white square it read as a component that
        // had failed to load. She is the right answer: DESIGN.md §7 puts the
        // mascot in empty states, and this is the emptiest state on the site.
        !result && !error ? (
          <Blank
            title="Your code appears here"
            body="Put a web address in on the left — or pick Wi-Fi, a menu, your phone number. The pattern is worked out on this page and never sent anywhere."
            intent="tip"
          />
        ) : (
          <Card>
            <CardBody>
              {error ? (
                <Problem>{error}</Problem>
              ) : result ? (
                <>
                  <canvas
                    ref={canvasRef}
                    className="rounded-box border-base-300 mx-auto block h-auto w-full max-w-sm border"
                    aria-label="Your QR code"
                  />

                  <p className="mt-4 text-center text-base">
                    {result.size} × {result.size} pattern. Scan it with your phone before you print
                    anything — that advice is worth taking literally.
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    <Button
                      color="module"
                      size="lg"
                      block
                      onClick={async () => {
                        const canvas = document.createElement('canvas');
                        drawQr(canvas, result, {
                          dark,
                          light,
                          quiet: quietZone ? 4 : 0,
                          scale: 24,
                        });
                        downloadBlob(await canvasToBlob(canvas), `${filename}.png`);
                      }}
                    >
                      Download PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      block
                      onClick={() => {
                        const svg = qrSvg(result, { dark, light, quiet: quietZone ? 4 : 0 });
                        downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${filename}.svg`);
                      }}
                    >
                      Download SVG — for printing
                    </Button>
                  </div>

                  <p className="mt-4 text-base">
                    Use the SVG for anything printed. It is drawn from instructions rather than
                    pixels, so it stays perfectly sharp at any size — a business card or a shop
                    window.
                  </p>
                </>
              ) : null}
            </CardBody>
          </Card>
        )
      }
    />
  );
}

/**
 * Draw the matrix.
 *
 * `imageSmoothingEnabled = false` and integer module sizes, both deliberate. A
 * QR code is the one image where anti-aliasing actively hurts: soft edges give a
 * camera a blurrier signal to threshold, and a fractional module size means some
 * rows are one pixel wider than others, which shows up as a visibly uneven
 * pattern.
 *
 * The colors here come from what somebody typed. There is no token for a
 * visitor's brand color and there cannot be — this is the artefact, not our
 * chrome. See the note in contrast-tool.tsx.
 */
function drawQr(
  canvas: HTMLCanvasElement,
  result: QrResult,
  opts: { dark: string; light: string; quiet: number; scale: number }
): void {
  const total = result.size + opts.quiet * 2;
  canvas.width = total * opts.scale;
  canvas.height = total * opts.scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = opts.light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = opts.dark;
  for (let row = 0; row < result.size; row++) {
    for (let col = 0; col < result.size; col++) {
      if (!result.matrix[row]![col]) continue;
      ctx.fillRect(
        (col + opts.quiet) * opts.scale,
        (row + opts.quiet) * opts.scale,
        opts.scale,
        opts.scale
      );
    }
  }
}

/** The same matrix as vector. Rows of adjacent modules are merged into one rect,
 * which cuts the file to a fraction of the naive one-rect-per-module version and
 * makes it something a printer will not choke on. */
function qrSvg(result: QrResult, opts: { dark: string; light: string; quiet: number }): string {
  const total = result.size + opts.quiet * 2;
  const rects: string[] = [];

  for (let row = 0; row < result.size; row++) {
    let run = 0;
    for (let col = 0; col <= result.size; col++) {
      const on = col < result.size && result.matrix[row]![col];
      if (on) {
        run++;
        continue;
      }
      if (run > 0) {
        rects.push(
          `<rect x="${col - run + opts.quiet}" y="${row + opts.quiet}" width="${run}" height="1"/>`
        );
        run = 0;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 8}" height="${total * 8}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${total}" height="${total}" fill="${opts.light}"/><g fill="${opts.dark}">${rects.join('')}</g></svg>`;
}
