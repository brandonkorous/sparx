import * as React from 'react';
import { Button, Column, Link, Row, Section, Text } from '@react-email/components';
import type { EmailPalette } from '@wizeworks/brand-core';
import { usePalette } from './brand';
import { signal } from './tokens';

// ────────────────────────────────────────────────────────────────────────
// "Signal" — the structural block components for PLATFORM emails.
//
// The point of the redesign: the LAYOUT carries the message. A receipt gets a
// real itemized table and a total rule; onboarding gets a numbered path; a failed
// payment gets a dated retry timeline. These are the reusable pieces every coded
// template composes inside `PlatformEmailLayout`.
//
// All table-based (React Email `Row`/`Column` project to <table>/<td>, which is
// what survives Outlook and Gmail) and fully inline-styled — mail clients strip
// <style> blocks, so there is no other option. Scale comes from the `signal`
// tokens; money + codes render in the monospace stack for tabular alignment.
// Every text element carries `fontFamily` explicitly because Outlook does not
// inherit it.
//
// ── COLOR COMES FROM THE SEND, NOT FROM THIS FILE ───────────────────────
//
// These used to read the sparx palette directly, with a comment saying so.
// WizeWorks runs two products through one email worker, so "the sparx palette"
// was what a Piggles owner's receipt was painted in. Every color now comes from
// `usePalette()`, which resolves per send from the tenant's `platform_brand`
// (`@wizeworks/brand-core`). There are no hexes in this file and there must not
// be: a literal here is a value that cannot follow the brand.
// ────────────────────────────────────────────────────────────────────────

const FONT = signal.font;

export type Tone = 'success' | 'warn' | 'danger' | 'info' | 'neutral';

/** A tone's foreground + wash. `neutral` is the canvas and the meta ink rather
 *  than a pair of its own — an untyped pill genuinely is the unstyled one, and
 *  two more palette roles to say that would be two more things to configure. */
function toneColors(tone: Tone, p: EmailPalette): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: p.successWash, fg: p.success };
    case 'warn':
      return { bg: p.warnWash, fg: p.warnInk };
    case 'danger':
      return { bg: p.dangerWash, fg: p.danger };
    case 'info':
      return { bg: p.infoWash, fg: p.info };
    case 'neutral':
    default:
      return { bg: p.canvas, fg: p.meta };
  }
}

// ── Typography ──────────────────────────────────────────────────────────

export function EmailDisplayHeading({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const p = usePalette();
  return (
    <Text
      style={{
        ...signal.type.display,
        fontFamily: FONT,
        color: p.heading,
        margin: `0 0 ${signal.space.md}px`,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailLead({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return (
    <Text
      style={{
        ...signal.type.lead,
        fontFamily: FONT,
        color: p.lead,
        margin: `0 0 ${signal.space.md}px`,
      }}
    >
      {children}
    </Text>
  );
}

/** A functional group label above a data block (e.g. "What you paid for"). A
 *  legible mid-ink — not a faded grey and not a decorative kicker over the H1. */
export function EmailSectionLabel({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return (
    <Text
      style={{
        ...signal.type.label,
        fontFamily: FONT,
        textTransform: 'uppercase',
        color: p.label,
        margin: `${signal.space.lg}px 0 ${signal.space.sm}px`,
      }}
    >
      {children}
    </Text>
  );
}

// ── Status pill ─────────────────────────────────────────────────────────

export function EmailStatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors(tone, usePalette());
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: c.bg,
        color: c.fg,
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: '18px',
        padding: '6px 12px',
        borderRadius: signal.radius.pill,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Status list — one row per thing, each with its own state pill ─────────

export interface StatusRow {
  title: string;
  detail?: string;
  status: { label: string; tone: Tone };
}

export function EmailStatusList({ rows }: { rows: StatusRow[] }) {
  const p = usePalette();
  return (
    <Section
      style={{
        border: `1px solid ${p.line}`,
        borderRadius: signal.radius.box,
        margin: `${signal.space.sm}px 0`,
      }}
    >
      {rows.map((r, i) => (
        <Row
          key={i}
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${p.line}` : undefined }}
        >
          <Column style={{ verticalAlign: 'middle', padding: '14px 0 14px 18px' }}>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: 15,
                fontWeight: 650,
                color: p.heading,
                margin: 0,
              }}
            >
              {r.title}
            </Text>
            {r.detail ? (
              <Text
                style={{
                  ...signal.type.meta,
                  fontFamily: FONT,
                  color: p.meta,
                  margin: '2px 0 0',
                }}
              >
                {r.detail}
              </Text>
            ) : null}
          </Column>
          <Column
            style={{ verticalAlign: 'middle', textAlign: 'right', padding: '14px 18px 14px 0' }}
          >
            <EmailStatusPill label={r.status.label} tone={r.status.tone} />
          </Column>
        </Row>
      ))}
    </Section>
  );
}

// ── Amount hero — the one number a transactional email is opened for ──────

export function EmailAmountHero({
  amount,
  caption,
  status,
}: {
  amount: string;
  caption?: string;
  status?: { label: string; tone: Tone };
}) {
  const p = usePalette();
  return (
    <Section style={{ margin: `${signal.space.xs}px 0 ${signal.space.lg}px` }}>
      <Row>
        <Column style={{ verticalAlign: 'middle' }}>
          <Text
            style={{
              ...signal.type.amount,
              fontFamily: signal.mono,
              color: p.ink,
              margin: 0,
            }}
          >
            {amount}
          </Text>
          {caption ? (
            <Text
              style={{
                ...signal.type.meta,
                fontFamily: FONT,
                color: p.meta,
                margin: '8px 0 0',
              }}
            >
              {caption}
            </Text>
          ) : null}
        </Column>
        {status ? (
          <Column style={{ verticalAlign: 'middle', textAlign: 'right' }}>
            <EmailStatusPill label={status.label} tone={status.tone} />
          </Column>
        ) : null}
      </Row>
    </Section>
  );
}

// ── Numbered steps — the onboarding path ──────────────────────────────────

export interface StepItem {
  title: string;
  description: string;
}

export function EmailSteps({ steps }: { steps: StepItem[] }) {
  const p = usePalette();
  // A brand that published no `accentWash` collapses it to `paper` — the chip
  // then needs a hairline to still read as a chip, rather than a floating
  // number. Deliberately not a computed tint of the accent: see email-palette.ts.
  const washed = p.accentWash !== p.paper;
  return (
    <Section
      style={{
        border: `1px solid ${p.line}`,
        borderRadius: signal.radius.box,
        margin: `${signal.space.sm}px 0`,
      }}
    >
      {steps.map((s, i) => (
        <Row
          key={i}
          style={{ borderBottom: i < steps.length - 1 ? `1px solid ${p.line}` : undefined }}
        >
          <Column style={{ width: 64, verticalAlign: 'top', padding: '18px 0 18px 20px' }}>
            <span
              style={{
                display: 'inline-block',
                width: 32,
                height: 32,
                lineHeight: washed ? '32px' : '30px',
                textAlign: 'center',
                backgroundColor: p.accentWash,
                border: washed ? undefined : `1px solid ${p.accent}`,
                color: p.accent,
                fontFamily: signal.mono,
                fontWeight: 800,
                fontSize: 15,
                borderRadius: 8,
              }}
            >
              {i + 1}
            </span>
          </Column>
          <Column style={{ verticalAlign: 'top', padding: '18px 20px 18px 4px' }}>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: p.heading,
                margin: '0 0 3px',
              }}
            >
              {s.title}
            </Text>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: 15,
                lineHeight: '22px',
                color: p.meta,
                margin: 0,
              }}
            >
              {s.description}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

// ── Line items + totals — the receipt anatomy ─────────────────────────────

export interface LineItem {
  title: string;
  subtitle?: string;
  amount: string;
}
export interface SummaryRow {
  label: string;
  value: string;
}

export function EmailLineItems({
  items,
  summary = [],
  total,
}: {
  items: LineItem[];
  summary?: SummaryRow[];
  total?: SummaryRow;
}) {
  const p = usePalette();
  return (
    <Section>
      {items.map((it, i) => (
        <Row key={i} style={{ borderBottom: `1px solid ${p.line}` }}>
          <Column style={{ verticalAlign: 'top', padding: '14px 0' }}>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: 16,
                fontWeight: 650,
                color: p.heading,
                margin: 0,
              }}
            >
              {it.title}
            </Text>
            {it.subtitle ? (
              <Text
                style={{
                  ...signal.type.meta,
                  fontFamily: FONT,
                  color: p.meta,
                  margin: '2px 0 0',
                }}
              >
                {it.subtitle}
              </Text>
            ) : null}
          </Column>
          <Column
            style={{
              verticalAlign: 'top',
              textAlign: 'right',
              padding: '14px 0',
              whiteSpace: 'nowrap',
            }}
          >
            <Text style={{ fontFamily: signal.mono, fontSize: 16, color: p.heading, margin: 0 }}>
              {it.amount}
            </Text>
          </Column>
        </Row>
      ))}

      {summary.length > 0 ? (
        <Section style={{ margin: '8px 0 0' }}>
          {summary.map((s, i) => (
            <Row key={i}>
              <Column style={{ padding: '6px 0' }}>
                <Text style={{ fontFamily: FONT, fontSize: 15, color: p.meta, margin: 0 }}>
                  {s.label}
                </Text>
              </Column>
              <Column style={{ padding: '6px 0', textAlign: 'right' }}>
                <Text style={{ fontFamily: signal.mono, fontSize: 15, color: p.body, margin: 0 }}>
                  {s.value}
                </Text>
              </Column>
            </Row>
          ))}
        </Section>
      ) : null}

      {total ? (
        <Row style={{ borderTop: `2px solid ${p.ink}` }}>
          <Column style={{ padding: '16px 0 4px' }}>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: p.ink,
                margin: 0,
              }}
            >
              {total.label}
            </Text>
          </Column>
          <Column style={{ padding: '16px 0 4px', textAlign: 'right' }}>
            <Text
              style={{
                fontFamily: signal.mono,
                fontSize: 22,
                fontWeight: 700,
                color: p.ink,
                margin: 0,
              }}
            >
              {total.value}
            </Text>
          </Column>
        </Row>
      ) : null}
    </Section>
  );
}

// ── Payment-method card ───────────────────────────────────────────────────

export function EmailPayCard({
  brandLabel,
  title,
  note,
}: {
  brandLabel: string;
  title: string;
  note?: string;
}) {
  const p = usePalette();
  return (
    <Section
      style={{
        border: `1px solid ${p.line}`,
        borderRadius: signal.radius.box,
        margin: `${signal.space.lg}px 0 ${signal.space.xs}px`,
      }}
    >
      <Row>
        <Column style={{ width: 74, verticalAlign: 'middle', padding: '14px 0 14px 16px' }}>
          <span
            style={{
              display: 'inline-block',
              width: 44,
              height: 28,
              lineHeight: '28px',
              textAlign: 'center',
              backgroundColor: p.ink,
              color: p.inkContent,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.03em',
              borderRadius: 5,
            }}
          >
            {brandLabel}
          </span>
        </Column>
        <Column style={{ verticalAlign: 'middle', padding: '14px 16px 14px 0' }}>
          <Text
            style={{
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 650,
              color: p.heading,
              margin: 0,
            }}
          >
            {title}
          </Text>
          {note ? (
            <Text
              style={{
                ...signal.type.meta,
                fontFamily: FONT,
                color: p.meta,
                margin: '2px 0 0',
              }}
            >
              {note}
            </Text>
          ) : null}
        </Column>
      </Row>
    </Section>
  );
}

// ── Dated timeline — "what happens next" ──────────────────────────────────

export interface TimelineRow {
  date: string;
  text: React.ReactNode;
}

export function EmailTimeline({ rows }: { rows: TimelineRow[] }) {
  const p = usePalette();
  return (
    <Section
      style={{
        border: `1px solid ${p.line}`,
        borderRadius: signal.radius.box,
        margin: `${signal.space.xs}px 0 ${signal.space.md}px`,
        padding: '2px 18px',
      }}
    >
      {rows.map((r, i) => (
        <Row
          key={i}
          style={{ borderBottom: i < rows.length - 1 ? `1px solid ${p.line}` : undefined }}
        >
          <Column style={{ width: 104, verticalAlign: 'top', padding: '13px 0' }}>
            <Text
              style={{
                fontFamily: signal.mono,
                fontSize: 13,
                fontWeight: 600,
                color: p.accent,
                margin: 0,
              }}
            >
              {r.date}
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top', padding: '13px 0' }}>
            <Text
              style={{
                fontFamily: FONT,
                fontSize: 15,
                lineHeight: '22px',
                color: p.body,
                margin: 0,
              }}
            >
              {r.text}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

// ── Alert band — an urgent notice, kept calm ──────────────────────────────

export function EmailAlert({
  tone = 'warn',
  title,
  children,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
}) {
  const p = usePalette();
  const c = toneColors(tone, p);
  return (
    <Section
      style={{
        backgroundColor: c.bg,
        border: `1px solid ${c.fg}33`,
        borderRadius: signal.radius.box,
        padding: '16px 18px',
        margin: `${signal.space.xs}px 0 ${signal.space.lg}px`,
      }}
    >
      <Row>
        <Column style={{ width: 44, verticalAlign: 'top' }}>
          <span
            style={{
              display: 'inline-block',
              width: 30,
              height: 30,
              lineHeight: '30px',
              textAlign: 'center',
              backgroundColor: c.fg,
              // The wash IS the light surface in every tone, so it is the
              // readable ink on the tone's own foreground — and unlike a literal
              // white it follows a brand whose washes are not white.
              color: c.bg,
              fontFamily: FONT,
              fontSize: 18,
              fontWeight: 800,
              borderRadius: signal.radius.pill,
            }}
          >
            !
          </span>
        </Column>
        <Column style={{ verticalAlign: 'top' }}>
          <Text
            style={{
              fontFamily: FONT,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: c.fg,
              margin: '0 0 2px',
            }}
          >
            {title}
          </Text>
          {children ? (
            <Text
              style={{ fontFamily: FONT, fontSize: 14, lineHeight: '21px', color: c.fg, margin: 0 }}
            >
              {children}
            </Text>
          ) : null}
        </Column>
      </Row>
    </Section>
  );
}

// ── One-time code block (OTP / 2FA) ──────────────────────────────────────

export function EmailCodeBlock({ code }: { code: string }) {
  const p = usePalette();
  return (
    <Section
      style={{
        backgroundColor: p.infoWash,
        border: `1px solid ${p.info}22`,
        borderRadius: signal.radius.box,
        padding: '22px 18px',
        margin: `${signal.space.md}px 0`,
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: signal.mono,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '0.24em',
          color: p.ink,
          margin: 0,
        }}
      >
        {code}
      </Text>
    </Section>
  );
}

// ── "Button not working? paste this link" fallback ────────────────────────

export function EmailFallbackLink({
  url,
  label = "If the button doesn't work, copy and paste this link into your browser:",
}: {
  url: string;
  label?: string;
}) {
  const p = usePalette();
  return (
    <Section style={{ margin: `${signal.space.lg}px 0 0` }}>
      <Text style={{ ...signal.type.meta, fontFamily: FONT, color: p.meta, margin: '0 0 4px' }}>
        {label}
      </Text>
      <Link
        href={url}
        style={{
          fontFamily: FONT,
          fontSize: 14,
          color: p.accent,
          textDecoration: 'underline',
          wordBreak: 'break-all',
        }}
      >
        {url}
      </Link>
    </Section>
  );
}

// ── Fine print — a genuine "if you didn't do this…" security note ─────────

export function EmailFinePrint({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return (
    <Text
      style={{
        ...signal.type.meta,
        fontFamily: FONT,
        color: p.meta,
        margin: `${signal.space.md}px 0 0`,
      }}
    >
      {children}
    </Text>
  );
}

// ── Big bulletproof action button (platform) ──────────────────────────────

export function EmailActionButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const p = usePalette();
  const primary = variant === 'primary';
  // A brand with no published `accentEdge` collapses it to `accent`, which
  // renders as no edge at all — a flat button, which is a look rather than a
  // defect. Darkening the accent to invent one would be this file choosing a
  // brand's color; see email-palette.ts.
  const edge = primary ? p.accentEdge : p.lineStrong;
  return (
    <Section style={{ margin: `${signal.space.lg}px 0 ${signal.space.xs}px` }}>
      <Button
        href={href}
        style={{
          backgroundColor: primary ? p.accent : p.paper,
          color: primary ? p.accentContent : p.ink,
          border: primary ? 'none' : `1px solid ${p.lineStrong}`,
          borderBottom: `${primary ? 2 : 1}px solid ${edge}`,
          borderRadius: signal.radius.button,
          fontFamily: FONT,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          padding: '15px 26px',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        {children}
      </Button>
    </Section>
  );
}
