'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { buildVCard, vCardIsUsable, type VCardInput } from './lib/vcard';
import { encodeQr } from './lib/qr';
import { downloadBlob, safeFilename } from './lib/download';
import { useLocalStorage } from './lib/use-local-storage';
import { Aside, Blank, Panel, TextField, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/**
 * Your details as something a phone can swallow whole.
 *
 * ── THE CODE GETS DENSER AS YOU TYPE, AND THAT MATTERS ──────────────────────
 *
 * A vCard is a lot of text, and a QR code carrying a lot of text is a dense
 * pattern that needs to be printed larger to scan. So the tool shows the size it
 * has reached and says plainly when the card has grown past what fits on a
 * business card — which is the thing nobody discovers until the printing arrives.
 */
export function DigitalCardTool() {
  const [input, setInput] = useLocalStorage<VCardInput>('piggles.tools.vcard', {
    firstName: '',
    lastName: '',
    jobTitle: '',
    company: '',
    email: '',
    phone: '',
    mobile: '',
    website: '',
    street: '',
    city: '',
    region: '',
    postcode: '',
    country: '',
    note: '',
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const set = <K extends keyof VCardInput>(key: K, value: VCardInput[K]) =>
    setInput({ ...input, [key]: value });

  const vcard = useMemo(() => buildVCard(input), [input]);
  const usable = vCardIsUsable(input);

  const qr = useMemo(() => {
    if (!usable) return null;
    try {
      // 'Q' rather than 'M': a contact card gets scanned off a printed card that
      // has been in a wallet, and the extra recovery is worth the density here.
      return encodeQr(vcard, 'Q');
    } catch {
      return null;
    }
  }, [vcard, usable]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qr) return;
    const scale = 10;
    const quiet = 4;
    const total = qr.size + quiet * 2;
    canvas.width = total * scale;
    canvas.height = total * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#202631';
    for (let row = 0; row < qr.size; row++) {
      for (let col = 0; col < qr.size; col++) {
        if (qr.matrix[row]![col]) {
          ctx.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
        }
      }
    }
  }, [qr]);

  const filename = safeFilename(`${input.firstName}-${input.lastName}`, 'contact');
  const dense = qr ? qr.version >= 12 : false;

  // The contact file's line breaks do real work and an email flattens them, so
  // the details go instead — which is what somebody wants to check before this
  // gets printed on a thousand cards. The density warning goes with them.
  useReportToolResult(
    usable
      ? {
          lines: [
            { label: 'Name', value: `${input.firstName} ${input.lastName}`.trim() },
            ...(input.jobTitle ? [{ label: 'What you do', value: input.jobTitle }] : []),
            ...(input.company ? [{ label: 'Business', value: input.company }] : []),
            ...(input.email ? [{ label: 'Email', value: input.email }] : []),
            ...(input.phone ? [{ label: 'Phone', value: input.phone }] : []),
            ...(input.mobile ? [{ label: 'Mobile', value: input.mobile }] : []),
            ...(input.website ? [{ label: 'Website', value: input.website }] : []),
            ...([input.street, input.city, input.region, input.postcode, input.country].some(
              Boolean
            )
              ? [
                  {
                    label: 'Address',
                    value: [input.street, input.city, input.region, input.postcode, input.country]
                      .filter(Boolean)
                      .join(', '),
                  },
                ]
              : []),
          ],
          note: dense
            ? 'These are the details your code hands over. It has grown dense enough that it needs printing larger than a business card usually allows, so test a printed one at the real size before you order any. Open the tool again to download the code and the contact file.'
            : 'These are the details your code hands over. Open the tool again to download the code and the contact file, and scan a printed one before you order a box of them.',
        }
      : null
  );

  return (
    <ToolLayout
      form={
        <>
          <Panel title="You">
            <TextField
              label="First name"
              value={input.firstName}
              onChange={(v) => set('firstName', v)}
            />
            <TextField
              label="Last name"
              value={input.lastName}
              onChange={(v) => set('lastName', v)}
            />
            <TextField
              label="What you do"
              value={input.jobTitle}
              onChange={(v) => set('jobTitle', v)}
            />
            <TextField label="Business" value={input.company} onChange={(v) => set('company', v)} />
          </Panel>

          <Panel
            title="How to reach you"
            description="Include the things that will still be true in eighteen months."
          >
            <TextField
              label="Email"
              value={input.email}
              onChange={(v) => set('email', v)}
              inputMode="email"
              spellCheck={false}
            />
            <TextField
              label="Mobile"
              value={input.mobile}
              onChange={(v) => set('mobile', v)}
              inputMode="tel"
            />
            <TextField
              label="Other phone"
              value={input.phone}
              onChange={(v) => set('phone', v)}
              inputMode="tel"
            />
            <TextField
              label="Website"
              value={input.website}
              onChange={(v) => set('website', v)}
              inputMode="url"
              spellCheck={false}
            />
            <Aside>
              A contact saved today gets looked at in eighteen months, when somebody finally has the
              budget. Be sparing with a job title that might change or an address you might move out
              of — the point is being findable later.
            </Aside>
          </Panel>

          <Panel title="Address (optional)">
            <TextField label="Street" value={input.street} onChange={(v) => set('street', v)} />
            <TextField label="Town or city" value={input.city} onChange={(v) => set('city', v)} />
            <TextField
              label="County, state or region"
              value={input.region}
              onChange={(v) => set('region', v)}
            />
            <TextField
              label="Postcode"
              value={input.postcode}
              onChange={(v) => set('postcode', v)}
            />
            <TextField label="Country" value={input.country} onChange={(v) => set('country', v)} />
          </Panel>

          <Panel title="Anything else">
            <TextField
              label="A note"
              hint="Saved with the contact. Useful for how you met, or what you do for them."
              value={input.note}
              onChange={(v) => set('note', v)}
            />
          </Panel>
        </>
      }
      output={
        usable && qr ? (
          <>
            <Card>
              <CardBody>
                <h3 className="text-lg font-bold">Scan to save</h3>
                <canvas
                  ref={canvasRef}
                  className="rounded-box border-base-300 mx-auto mt-4 block h-auto w-full max-w-xs border"
                  aria-label="A code containing your contact details"
                />
                <p className="mt-3 text-center text-base">
                  Any phone camera reads this and offers to save you to contacts — spelt correctly,
                  first time.
                </p>

                {dense ? (
                  <Aside>
                    <strong>This code has got quite dense.</strong> It will still scan, but print it
                    at least three centimetres square. Taking out the address, or the note, makes a
                    simpler pattern that reads from further away — which matters on a business card.
                  </Aside>
                ) : null}

                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    color="module"
                    size="lg"
                    block
                    onClick={async () => {
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const blob = await new Promise<Blob | null>((r) =>
                        canvas.toBlob(r, 'image/png')
                      );
                      if (blob) downloadBlob(blob, `${filename}-qr.png`);
                    }}
                  >
                    Download the code
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    block
                    onClick={() =>
                      downloadBlob(
                        new Blob([vcard], { type: 'text/vcard;charset=utf-8' }),
                        `${filename}.vcf`
                      )
                    }
                  >
                    Download the contact file
                  </Button>
                </div>
                <p className="mt-3 text-base">
                  The contact file is what you attach to an email. Opening it prompts to add you to
                  contacts, on every phone and every mail app.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-lg font-bold">On a printed card</h3>
                <div className="rounded-box border-base-300 mt-4 flex items-center gap-5 border bg-white p-5">
                  <MiniQr canvasRef={canvasRef} />
                  <div className="min-w-0 text-[#202631]">
                    <p className="truncate text-base font-bold">
                      {[input.firstName, input.lastName].filter(Boolean).join(' ')}
                    </p>
                    {input.jobTitle || input.company ? (
                      <p className="truncate text-sm">
                        {[input.jobTitle, input.company].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {input.mobile || input.phone ? (
                      <p className="mt-1 truncate text-sm">{input.mobile || input.phone}</p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-base">
                  Print the code <em>and</em> the details in readable text. Some people will scan;
                  plenty will simply type it in, and a card with only a code is useless to them.
                </p>
              </CardBody>
            </Card>
          </>
        ) : (
          <Blank
            title="Your card appears here"
            body="Put in a name and at least one way to reach you. It is all worked out in this page — nothing about you is sent anywhere, and closing the tab is the end of it."
            intent="empty"
          />
        )
      }
    />
  );
}

/** The same code at card size, copied from the live canvas so it cannot drift. */
function MiniQr({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const small = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const source = canvasRef.current;
    const target = small.current;
    if (!source || !target) return;
    target.width = 160;
    target.height = 160;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, 160, 160);
  });

  return <canvas ref={small} className="size-20 shrink-0" aria-hidden />;
}
