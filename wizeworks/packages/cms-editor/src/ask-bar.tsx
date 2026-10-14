'use client';

// The editor's ask bar: the one question a toolbar button needs answered, asked in
// the page under the toolbar instead of in a browser prompt.
//
// It replaced five `window.prompt` calls ("Link URL", "Image URL", "Alt text",
// "Embed URL", "Code language"). A prompt is a grey box outside the design that
// blocks the whole window, cannot list the writer's own pages and cannot say what is
// wrong with an answer (persona P09). Styling is silica's own classes (`btn`, `input`,
// `select`), which the consoles already compile for this package.

import * as React from 'react';
import { cn } from '@wizeworks/silica-corrections';
import { readHref, searchesPages, type LinkSuggestFn, type LinkSuggestion } from './ask';
import { detectProvider } from './nodes';

export type Ask =
  | { kind: 'link'; current: string }
  | { kind: 'embed' }
  | { kind: 'code'; languages: readonly string[] }
  | { kind: 'image' };

export interface AskBarProps {
  ask: Ask;
  suggest?: LinkSuggestFn;
  onLink: (href: string | null, label?: string) => void;
  onEmbed: (url: string) => void;
  onCode: (language: string | null) => void;
  onImage: (src: string, alt: string) => void;
  onCancel: () => void;
}

const EMBEDS = 'YouTube, Vimeo, Loom, Spotify, SoundCloud, Apple Music or Apple Podcasts';

export function AskBar({ ask, suggest, onLink, onEmbed, onCode, onImage, onCancel }: AskBarProps) {
  const [text, setText] = React.useState(ask.kind === 'link' ? ask.current : '');
  const [alt, setAlt] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<LinkSuggestion[]>([]);
  const id = React.useId();
  const form = React.useRef<HTMLFormElement>(null);
  const cancel = React.useRef(onCancel);
  cancel.current = onCancel;

  // A button asked a question, so the answer box takes the focus; Escape anywhere in
  // the box backs out to where she was writing.
  React.useEffect(() => {
    const box = form.current;
    if (!box) return;
    box.querySelector<HTMLElement>('input, select')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancel.current();
    };
    box.addEventListener('keydown', onKey);
    return () => box.removeEventListener('keydown', onKey);
  }, []);

  // Her pages, as she types a title. A pasted address is not searched.
  React.useEffect(() => {
    if (ask.kind !== 'link' || !suggest || !searchesPages(text)) {
      setFound([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      suggest(text.trim())
        .then((rows) => live && setFound(rows.slice(0, 6)))
        .catch(() => live && setFound([]));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [ask.kind, suggest, text]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (ask.kind === 'link') {
      const read = readHref(text);
      if ('error' in read) {
        // A title she typed that matches exactly one page means that page.
        if (found.length === 1 && found[0]) return onLink(found[0].href, found[0].label);
        if (suggest && searchesPages(text)) {
          return setError(
            found.length > 1
              ? 'More than one page matches. Pick the one you mean from the list.'
              : 'No published page on your site matches that. Check the title, or paste a full address, such as https://example.com.'
          );
        }
        return setError(read.error);
      }
      return onLink(read.href);
    }
    if (ask.kind === 'embed') {
      const url = text.trim();
      if (url === '') return onCancel();
      if (detectProvider(url) === 'unknown') {
        return setError(`That is not a link we can play here. Paste one from ${EMBEDS}.`);
      }
      return onEmbed(url);
    }
    if (ask.kind === 'code') return onCode(text === '' ? null : text);
    const read = readHref(text);
    if ('error' in read || read.href === null) {
      return setError('Paste the full address of the picture, starting https://.');
    }
    return onImage(read.href, alt.trim());
  };

  const question =
    ask.kind === 'link'
      ? 'Link to'
      : ask.kind === 'embed'
        ? 'Video or audio to show here'
        : ask.kind === 'code'
          ? 'Which language is this code in?'
          : 'Address of the picture';
  const hint =
    ask.kind === 'link'
      ? suggest
        ? 'Start typing a title from your site, or paste a full web address.'
        : 'Paste a full web address, such as https://example.com.'
      : ask.kind === 'embed'
        ? `Paste a link from ${EMBEDS}.`
        : ask.kind === 'code'
          ? 'It colors the code to match. Leave it on Plain text if you are not sure.'
          : null;
  const action =
    ask.kind === 'link'
      ? ask.current
        ? 'Change link'
        : 'Add link'
      : ask.kind === 'embed'
        ? 'Add it'
        : ask.kind === 'code'
          ? 'Add code block'
          : 'Add picture';

  return (
    <form
      ref={form}
      onSubmit={submit}
      aria-label={question}
      className="border-base-300 flex flex-col gap-2 border-b p-3"
    >
      <label htmlFor={`${id}-text`} className="font-medium">
        {question}
      </label>
      {ask.kind === 'code' ? (
        <select
          id={`${id}-text`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="select select-sm w-full"
        >
          <option value="">Plain text</option>
          {ask.languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`${id}-text`}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          aria-describedby={`${id}-hint`}
          aria-invalid={error !== null}
          className={cn('input input-sm w-full', error !== null && 'input-error')}
        />
      )}
      {hint !== null ? (
        <p id={`${id}-hint`} className="text-sm">
          {hint}
        </p>
      ) : null}

      {ask.kind === 'image' ? (
        <>
          <label htmlFor={`${id}-alt`} className="font-medium">
            Describe the picture
          </label>
          <input
            id={`${id}-alt`}
            type="text"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            aria-describedby={`${id}-alt-hint`}
            className="input input-sm w-full"
          />
          <p id={`${id}-alt-hint`} className="text-sm">
            Read aloud to people who cannot see it, and shown if it does not load.
          </p>
        </>
      ) : null}

      {found.length > 0 ? (
        <ul aria-label="Your pages" className="flex flex-col gap-1">
          {found.map((page) => (
            <li key={page.href}>
              <button
                type="button"
                onClick={() => onLink(page.href, page.label)}
                className="btn btn-ghost btn-sm h-auto w-full justify-start py-1.5 text-left"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{page.label}</span>
                  <span className="truncate text-sm font-normal">
                    {page.hint ? `${page.hint} · ${page.href}` : page.href}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error !== null ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          {action}
        </button>
        {ask.kind === 'link' && ask.current ? (
          <button
            type="button"
            onClick={() => onLink(null)}
            className="btn btn-error btn-outline btn-sm"
          >
            Remove link
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
