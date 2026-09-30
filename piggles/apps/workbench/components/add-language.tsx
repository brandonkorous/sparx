'use client';

// Adding a language, by name.
//
// ── One control, because the last one only reached one pane ─────────────────
//
// Four panes in this console ask "which language?": a product's own wording, a
// product's wording from the Content side, and the two editors behind them.
// One of them got a named picker (issue 402) and the other three kept the text
// box labelled "Language code" whose help read "es, pt-BR, zh-Hans". Devi typed
// "French" into the product pane and was told it was not a language code, on a
// screen that had just named French for her one card above (issue 793).
//
// So the control is here, where every pane can see it, rather than beside one
// of them. [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// The code box stays, behind "Another language…". The shortlist covers what a
// small shop sells in and is not a ceiling: anything outside it is still
// reachable by typing the tag (RULE #1 — simplification never removes
// capability).

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
} from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from './form-section';
import {
  canonicalLocale,
  isValidLocale,
  languageOptions,
  localeName,
  OTHER_LANGUAGE,
} from '@/lib/languages';

export function AddLanguage({
  existing,
  description,
  onAdd,
}: {
  /** Languages already here, so the list cannot offer one twice. */
  existing: string[];
  /** What adding one does on THIS screen, in that screen's own words. */
  description: string;
  onAdd: (locale: string) => void;
}) {
  const [picked, setPicked] = useState('');
  const [raw, setRaw] = useState('');
  const typing = picked === OTHER_LANGUAGE;

  const canonical = canonicalLocale(raw);
  const duplicate = typing ? existing.includes(canonical) : existing.includes(picked);
  const valid = typing
    ? raw.trim() !== '' && isValidLocale(raw) && !duplicate
    : picked !== '' && !duplicate;

  const commit = () => {
    if (!valid) return;
    onAdd(typing ? canonical : picked);
    setPicked('');
    setRaw('');
  };

  return (
    <FormSection title="Add a language" description={description}>
      <Field>
        <FieldLabel>Language</FieldLabel>
        <FieldControl
          render={
            <Select
              color="module"
              value={picked}
              items={languageOptions(existing)}
              placeholder="Choose a language"
              aria-label="Language"
              onValueChange={(next) => {
                setPicked(String(next));
              }}
            />
          }
        />
        <FieldDescription>
          Start typing to jump down the list. Not there? Choose “Another language…”.
        </FieldDescription>
      </Field>

      {typing ? (
        <OtherLanguage raw={raw} duplicate={duplicate} onChange={setRaw} onEnter={commit} />
      ) : null}

      <div className="flex justify-end">
        <Button size="sm" color="module" disabled={!valid} onClick={commit}>
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add this language
        </Button>
      </div>
    </FormSection>
  );
}

/** The escape hatch for a language the list leaves out. Kept so the shortlist
 *  never becomes a ceiling. */
function OtherLanguage({
  raw,
  duplicate,
  onChange,
  onEnter,
}: {
  raw: string;
  duplicate: boolean;
  onChange: (next: string) => void;
  onEnter: () => void;
}) {
  const canonical = canonicalLocale(raw);
  return (
    <Field>
      <FieldLabel>Language code</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={raw}
            spellCheck={false}
            autoComplete="off"
            placeholder="es"
            onChange={(event) => {
              onChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onEnter();
              }
            }}
          />
        }
      />
      <FieldDescription>
        {raw.trim() === ''
          ? 'The short code for the language: two letters, optionally with a country. “es” is Spanish, “fr-CA” Canadian French.'
          : duplicate
            ? `You already have ${localeName(canonical)} here.`
            : isValidLocale(raw)
              ? `Adds ${localeName(canonical)} (${canonical}).`
              : 'That is not a language code. Try two letters, like “es”, optionally with a country: “es-MX”.'}
      </FieldDescription>
    </Field>
  );
}
