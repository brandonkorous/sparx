'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import type { MascotIntent } from '@piggles/mascot';
import { PigglesMascot } from '@piggles/mascot/react';
import { copyText } from './lib/download';

/**
 * The pieces every tool is built from.
 *
 * Seventeen tools hand-rolling their own label markup would be seventeen chances
 * to size a control differently, forget a description, or wire a label to
 * nothing. These wrappers are thin — they compose silica's `Field` parts and add
 * no styling of their own — and they exist so a tool component is a list of
 * fields and a result, with no chrome in the way.
 *
 * ── SIZE IS DECIDED HERE, ONCE ──────────────────────────────────────────────
 *
 * Every control is `lg`, which is 58px on the Piggles scale — the size DESIGN.md
 * §5 asks a form for. Deciding it in this file rather than at 200 call sites is
 * the difference between a design decision and a habit: change it here and every
 * tool follows, which is the whole point of the size prop existing.
 */

const CONTROL_SIZE = 'lg' as const;

/**
 * Every control wears the page's app colour.
 *
 * ── IT CONNECTS THE PAGE, AND IT MAKES THE FIELD VISIBLE ────────────────────
 *
 * Two problems, one fix. The page opens drenched in its group hue and then
 * handed the form to default controls, so the colour stopped at the band and
 * everything below it was the same neutral form as every other tool — the hue
 * decorated the top of the page instead of belonging to it. And a default input
 * on this palette is a hairline of `base-300` on white, which on a warm
 * near-white ground is very close to no border at all: the fields were hard to
 * find, which is a real usability fault before it is an aesthetic one.
 *
 * `color="module"` resolves through `data-group` on the page wrapper, so a Sell
 * tool's inputs are burnt orange and a Money tool's are olive, with no tool
 * naming a colour. Silica puts it on the border and the focus ring only — the
 * ink inside stays `base-content`, so nothing about readability is traded for
 * it.
 *
 * Set here rather than at ~200 call sites for the same reason as the size: this
 * is a design decision, and it should live in one place that every tool follows.
 */
const CONTROL_COLOR = 'module' as const;

export function TextField({
  label,
  hint,
  value,
  onChange,
  ...rest
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size' | 'color'>) {
  return (
    <Field>
      <FieldLabel className="text-base font-semibold">{label}</FieldLabel>
      <Input
        color={CONTROL_COLOR}
        size={CONTROL_SIZE}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {hint ? <FieldDescription className="text-base">{hint}</FieldDescription> : null}
    </Field>
  );
}

export function AreaField({
  label,
  hint,
  value,
  onChange,
  rows = 4,
  ...rest
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'color'>) {
  return (
    <Field>
      <FieldLabel className="text-base font-semibold">{label}</FieldLabel>
      <Textarea
        color={CONTROL_COLOR}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        {...rest}
      />
      {hint ? <FieldDescription className="text-base">{hint}</FieldDescription> : null}
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: React.ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Field>
      <FieldLabel className="text-base font-semibold">{label}</FieldLabel>
      {/* NativeSelect rather than the rich Select. A native dropdown opens as
 the operating system's own control on a phone — a full-height wheel
 you can flick — and that is a better experience than any listbox we
 could build. The rich one earns its place when there are groups,
 search or multi-select; none of these have any of that. */}
      <NativeSelect
        color={CONTROL_COLOR}
        size={CONTROL_SIZE}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      {hint ? <FieldDescription className="text-base">{hint}</FieldDescription> : null}
    </Field>
  );
}

/**
 * A colour, as a swatch you can click and a hex box you can paste into.
 *
 * Both halves, always. The native colour input is how somebody browses for a
 * colour they have not chosen yet; the text box is how somebody who already has
 * a brand colour on a piece of paper puts it in. Offering only the picker means
 * a business with a colour has to hunt for it on a wheel.
 */
export function ColourField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel className="text-base font-semibold">{label}</FieldLabel>
      <div className="flex items-center gap-3">
        {/* The colour fills the control. A native swatch carries its own wrapper
            padding on top of any the element has, so both are zeroed and the
            swatch is given the field radius one notch down — it sits a pixel
            inside the border rather than floating as a small square in a box. */}
        <input
          type="color"
          aria-label={`${label} — colour picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#FF6F86'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="rounded-field border-module h-[3.625rem] w-16 shrink-0 cursor-pointer overflow-hidden border bg-transparent p-px [&::-moz-color-swatch]:rounded-[11px] [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-[11px] [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:h-full [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <Input
          color={CONTROL_COLOR}
          size={CONTROL_SIZE}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="font-mono"
          aria-label={`${label} — hex value`}
        />
      </div>
      {hint ? <FieldDescription className="text-base">{hint}</FieldDescription> : null}
    </Field>
  );
}

export function CheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      {/* `checkbox-module`, not `checkbox-primary`. A pink tick on an olive page
 was the one control still reporting to the brand rather than to the
 page it is sitting on. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="checkbox checkbox-module mt-0.5 shrink-0"
      />
      <span>
        <span className="text-base font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-base">{hint}</span> : null}
      </span>
    </label>
  );
}

/** A titled block. The heading wears the page's app colour, so a long form reads
 * as a few named steps rather than as forty controls. */
export function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            {description ? <p className="mt-1 text-base">{description}</p> : null}
          </div>
          {actions}
        </div>
        <div className="mt-2 flex flex-col gap-5">{children}</div>
      </CardBody>
    </Card>
  );
}

/**
 * The two-column shape every tool uses: what you fill in, and what comes out.
 *
 * The output column is STICKY on a wide screen. That is the single most useful
 * thing about this layout — a long form with the result pinned beside it means
 * you watch the thing change as you type, rather than filling in twelve fields
 * and scrolling down to find out. On a narrow screen it stacks, output first,
 * because on a phone the result is what you came for and a form you have already
 * filled in is not worth scrolling past again.
 */
export function ToolLayout({
  form,
  output,
  outputWidth = 'half',
}: {
  form: React.ReactNode;
  output: React.ReactNode;
  outputWidth?: 'half' | 'wide' | 'narrow';
}) {
  const columns =
    outputWidth === 'wide'
      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]'
      : outputWidth === 'narrow'
        ? 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'
        : 'lg:grid-cols-2';

  return (
    <div className={`grid gap-8 ${columns}`}>
      <div className="order-2 flex flex-col gap-6 lg:order-1">{form}</div>
      <div className="order-1 lg:order-2">
        <div className="flex flex-col gap-6 lg:sticky lg:top-24">{output}</div>
      </div>
    </div>
  );
}

/** Copy to the clipboard, and say so. The confirmation is the whole feature —
 * a copy button that looks identical before and after leaves you pressing it
 * twice to be sure. */
export function CopyButton({
  text,
  label = 'Copy',
  color = 'module',
  variant,
  size = 'md',
  block,
}: {
  text: string;
  label?: string;
  color?: string;
  variant?: 'outline' | 'soft' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}) {
  const [done, setDone] = useState(false);

  return (
    <Button
      color={done ? 'success' : color}
      variant={variant}
      size={size}
      block={block}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        }
      }}
    >
      {done ? 'Copied' : label}
    </Button>
  );
}

/** Something to copy, shown as what it is. Monospace because it is code, and a
 * copy button because nobody should be selecting this by hand. */
export function CodeOut({
  title,
  code,
  hint,
  language = 'text',
}: {
  title?: string;
  code: string;
  hint?: React.ReactNode;
  language?: string;
}) {
  return (
    <div>
      {title ? (
        <div className="mb-2 flex items-center justify-between gap-4">
          <h3 className="text-base font-bold">{title}</h3>
          <CopyButton text={code} size="sm" variant="soft" />
        </div>
      ) : null}
      <pre
        className="rounded-box border-base-300 bg-base-200 overflow-x-auto border p-4 text-sm leading-relaxed"
        data-language={language}
      >
        <code className="font-mono">{code}</code>
      </pre>
      {hint ? <p className="mt-2 text-base">{hint}</p> : null}
      {!title ? (
        <div className="mt-3">
          <CopyButton text={code} variant="soft" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Nothing here yet.
 *
 * This is where the mascot earns her keep — DESIGN.md §7 puts her in empty
 * states, onboarding and success moments, which is exactly what an untouched
 * tool is. She is NOT on the invoice or the quote once there are numbers in it:
 * money is plain and calm, and the closed `MascotIntent` union has no member for
 * a bill anyway.
 */
export function Blank({
  title,
  body,
  intent = 'empty',
}: {
  title: string;
  body: string;
  intent?: MascotIntent;
}) {
  return (
    <Card>
      <CardBody className="items-center py-14 text-center">
        <PigglesMascot intent={intent} size="sm" />
        <h3 className="mt-6 text-xl font-bold">{title}</h3>
        <p className="mt-2 max-w-sm text-base">{body}</p>
      </CardBody>
    </Card>
  );
}

/**
 * A short aside — the thing worth knowing at this exact point in the form.
 *
 * ── IT IS A PARAGRAPH. THAT IS THE WHOLE COMPONENT ──────────────────────────
 *
 * This shipped with a 4px coloured rule down its left edge, and that was wrong
 * twice over. It is a divider used as decoration, which root RULE #2 bans
 * outright; and — worse, because it is the kind of thing that spreads — NOTHING
 * ELSE ON THIS SITE DOES IT. Not the homepage, not /apps, not /trust, not the
 * footer. Grep for `border-l` outside this directory and there are no hits.
 *
 * Inventing a visual device for one component is how a design system stops
 * being one. Piggles separates a note from body text the way it separates
 * everything else: scale, weight and colour. A bold lead-in does the whole job,
 * it matches every other page, and it needs no new idea.
 *
 * Not an alert either: nothing has gone wrong, and dressing advice up as a
 * warning is how a page ends up shouting. That is what `Problem` is for.
 *
 * ── AND A TRAP THAT COMES WITH THE BOLD LEAD-IN ─────────────────────────────
 *
 * `<strong>Some point.</strong> The rest of it…` renders as
 *"Some point.The rest of it" whenever the compiler decides that line wraps: the
 * space ends up at the end of a JSX line and is swallowed. Prettier will also
 * collapse an explicit `{' '}` back to a plain space if the result happens to
 * fit on one line, so it can reappear after a format run.
 *
 * Write the space as `{' '}` at the END of the line carrying the closing tag,
 * with the following text starting the next line. That is prettier's own shape
 * for wrapped JSX text, so it survives formatting, and it is explicit enough
 * that the compiler cannot drop it. Two of these shipped before anybody
 * noticed — it looks like a typo rather than a rendering fault, which is exactly
 * why it survives review.
 */
export function Aside({ children }: { children: React.ReactNode }) {
  return <p className="text-base">{children}</p>;
}

/** Something that did go wrong, said in words rather than in a code. */
export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-box border-error/40 bg-error/10 text-base-content border p-4 text-base"
    >
      {children}
    </div>
  );
}
