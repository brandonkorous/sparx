'use client';

import { useMemo, useState } from 'react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import {
    buildSignature,
    SIGNATURE_LAYOUTS,
    signaturePlainText,
    signatureWarnings,
    type SignatureInput,
} from './lib/signature';
import { copyRichHtml } from './lib/download';
import { useLocalStorage } from './lib/use-local-storage';
import {
    Aside,
    CodeOut,
    ColorField,
    Panel,
    Problem,
    SelectField,
    TextField,
    ToolLayout,
} from './ui-kit';

/**
 * The few tidy lines under everything you send.
 *
 * ── COPY THE RENDERED THING, NOT THE CODE ───────────────────────────────────
 *
 * The single most common complaint about every signature generator is that
 * pasting into Gmail shows the markup instead of the signature. That happens
 * because the tool copied `text/plain` and Gmail pasted exactly what it was
 * given.
 *
 * The main button here writes BOTH `text/html` and `text/plain` to the
 * clipboard, so Gmail, Outlook and Apple Mail all take the formatted version and
 * anything else gets readable text. The markup is still available underneath for
 * anybody who wants to paste it into a settings box that expects code.
 */
export function SignatureTool() {
    const [input, setInput] = useLocalStorage<SignatureInput>('piggles.tools.signature', {
        name: '',
        jobTitle: '',
        company: '',
        email: '',
        phone: '',
        website: '',
        imageUrl: '',
        accent: '#FF6F86',
        layout: 'stacked',
        tagline: '',
    });
    const [copied, setCopied] = useState(false);

    const set = <K extends keyof SignatureInput>(key: K, value: SignatureInput[K]) =>
        setInput({ ...input, [key]: value });

    const html = useMemo(() => buildSignature(input), [input]);
    const plain = useMemo(() => signaturePlainText(input), [input]);
    const warnings = useMemo(() => signatureWarnings(input), [input]);
    const empty = !input.name && !input.email && !input.phone;

    return (
        <ToolLayout
            form={
                <>
                    <Panel title="Who you are">
                        <TextField label="Name" value={input.name} onChange={(v) => set('name', v)} />
                        <TextField
                            label="What you do"
                            hint="Plain words beat a job title nobody outside your company understands."
                            value={input.jobTitle}
                            onChange={(v) => set('jobTitle', v)}
                            placeholder="Owner"
                        />
                        <TextField label="Business" value={input.company} onChange={(v) => set('company', v)} />
                    </Panel>

                    <Panel
                        title="How to reach you"
                        description="One phone number and one address. More than that and people stop reading."
                    >
                        <TextField
                            label="Email"
                            value={input.email}
                            onChange={(v) => set('email', v)}
                            inputMode="email"
                            spellCheck={false}
                        />
                        <TextField
                            label="Phone"
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
                        <TextField
                            label="One closing line (optional)"
                            hint="Something useful rather than a slogan — “Open Tuesday to Saturday”, “Booking for March now”."
                            value={input.tagline}
                            onChange={(v) => set('tagline', v)}
                        />
                    </Panel>

                    <Panel title="How it looks">
                        <SelectField
                            label="Arrangement"
                            hint={SIGNATURE_LAYOUTS.find((l) => l.value === input.layout)?.blurb}
                            value={input.layout}
                            onChange={(v) => set('layout', v)}
                            options={SIGNATURE_LAYOUTS.map((l) => ({ value: l.value, label: l.label }))}
                        />
                        <ColorField
                            label="Accent color"
                            value={input.accent}
                            onChange={(v) => set('accent', v)}
                        />
                        <TextField
                            label="Photo or logo (a web address)"
                            hint="It has to live on the internet. A file on your computer disappears the moment the email leaves it — upload it to your site first and use the address it gets."
                            value={input.imageUrl}
                            onChange={(v) => set('imageUrl', v)}
                            inputMode="url"
                            spellCheck={false}
                            placeholder="https://bellacafe.example/logo.png"
                        />
                    </Panel>
                </>
            }
            output={
                <>
                    <Card>
                        <CardBody>
                            <h3 className="text-lg font-bold">How it will look</h3>

                            {empty ? (
                                <p className="mt-3 text-base">
                                    Fill in your name on the left and it appears here, exactly as it will arrive.
                                </p>
                            ) : (
                                <>
                                    {/* Rendered as real markup so what you see is literally what
 gets copied. It is our own generated HTML from fields that
 are escaped in buildSignature — no user markup survives. */}
                                    <div
                                        className="rounded-box border-base-300 mt-4 border bg-white p-6"
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />

                                    <Button
                                        color={copied ? 'success' : 'module'}
                                        size="lg"
                                        block
                                        className="mt-5"
                                        onClick={async () => {
                                            if (await copyRichHtml(html, plain)) {
                                                setCopied(true);
                                                window.setTimeout(() => setCopied(false), 2500);
                                            }
                                        }}
                                    >
                                        {copied ? 'Copied — now paste it into your mail app' : 'Copy the signature'}
                                    </Button>

                                    <p className="mt-3 text-base">
                                        In Gmail: Settings, then Signature, then paste. In Outlook: File, Options, Mail,
                                        Signatures. In Apple Mail: Settings, then Signatures.
                                    </p>
                                </>
                            )}

                            {/* Nothing is wrong with an empty form — somebody has just
 arrived. Showing"there is no way to reach you in this
 signature" before a single field has been touched is telling
 a visitor off for not having typed yet, which is both rude and
 useless: they know. Warnings start once there is something to
 warn about. */}
                            {!empty && warnings.length > 0 ? (
                                <div className="mt-5 flex flex-col gap-3">
                                    {warnings.map((w) => (
                                        <Problem key={w}>{w}</Problem>
                                    ))}
                                </div>
                            ) : null}
                        </CardBody>
                    </Card>

                    {!empty ? (
                        <Card>
                            <CardBody>
                                <h3 className="text-lg font-bold">The code, if you need it</h3>
                                <p className="mt-2 text-base">
                                    Some mail systems ask for the markup rather than a paste. This is it.
                                </p>
                                <div className="mt-4">
                                    <CodeOut code={html} language="html" />
                                </div>
                                <Aside>
                                    Built with tables and styling written on every element, which looks thoroughly
                                    old-fashioned and is the only thing that survives Outlook — it renders email using
                                    Microsoft Word&rsquo;s engine, which ignores most modern layout.
                                </Aside>
                            </CardBody>
                        </Card>
                    ) : null}
                </>
            }
        />
    );
}
