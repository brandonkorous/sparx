'use client';

// Settings — what this thing IS, rather than how it looks.
//
// Content, the link it points at, the picture it shows, whether it is locked. The
// split from Design is not cosmetic: an author changing the words in a heading and
// an author changing its size are doing different jobs, and one panel holding both
// makes the common one (the words) the harder one to find.
//
// The image field opens the app's own media library through `host.pickAsset`.
// Without that hook it degrades to a URL box — which asks a business owner to know
// what a URL is in order to put their own photograph on their own site, so an app
// that can supply the picker should.

import { useCallback } from 'react';
import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import type { StudioDoc } from '../../documents/types';
import { refOf } from '../../documents/types';
import type { AddressableNode } from '../../tree/walk';
import { idOf, isNodeChild } from '../../tree/walk';
import { useApply, useDoc, useStudioHost } from '../context';

/** A document's own root id — a theme has no tree, so it has none. */
function rootId(doc: StudioDoc): string | undefined {
  return doc.kind === 'theme' || doc.kind === 'email' ? undefined : idOf(doc.root);
}

const HEADING_TAGS = [
  { value: 'h1', label: 'Biggest heading' },
  { value: 'h2', label: 'Big heading' },
  { value: 'h3', label: 'Medium heading' },
  { value: 'h4', label: 'Small heading' },
  { value: 'p', label: 'Paragraph' },
];

/** The words this node holds, when it holds words rather than more blocks. */
function ownText(node: AddressableNode): string | undefined {
  const children = node.children ?? [];
  if (children.some(isNodeChild)) return undefined;
  return children.filter((child): child is string => typeof child === 'string').join('');
}

export function SettingsTab({ node }: { node: AddressableNode }) {
  const apply = useApply();
  const host = useStudioHost();
  const doc = useDoc<StudioDoc>();
  const id = node.id ?? '';
  const tag = node.kind === 'element' ? node.tag.toLowerCase() : '';
  const text = ownText(node);

  const setAttr = useCallback(
    (key: string, value: string) => {
      apply(`Set ${key}`, [{ kind: 'node.setAttr', id, key, value: value || undefined }]);
    },
    [apply, id]
  );

  const choosePicture = useCallback(async () => {
    const picked = await host.pickAsset?.();
    if (!picked) return;
    apply('Choose a picture', [
      { kind: 'node.setAttr', id, key: 'src', value: picked.url },
      ...(picked.alt ? [{ kind: 'node.setAttr' as const, id, key: 'alt', value: picked.alt }] : []),
    ]);
  }, [apply, host, id]);

  return (
    <div className="flex flex-col gap-4 p-3">
      {text !== undefined ? (
        <Field>
          <FieldLabel>Words</FieldLabel>
          <Textarea
            key={`${id}:text`}
            defaultValue={text}
            rows={3}
            onBlur={(event) => {
              const value = event.currentTarget.value;
              if (value === text) return;
              apply('Edit words', [{ kind: 'node.setText', id, value }]);
            }}
          />
        </Field>
      ) : null}

      {['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tag) ? (
        <Field>
          <FieldLabel>Kind of text</FieldLabel>
          <NativeSelect
            key={`${id}:tag`}
            defaultValue={tag}
            onChange={(event) =>
              apply('Change kind of text', [
                { kind: 'node.setTag', id, value: event.currentTarget.value },
              ])
            }
          >
            {HEADING_TAGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            Search engines and screen readers use this to understand your page, so keep the biggest
            heading for the page’s real title.
          </FieldDescription>
        </Field>
      ) : null}

      {tag === 'a' ? (
        <Field>
          <FieldLabel>Goes to</FieldLabel>
          <Input
            key={`${id}:href`}
            defaultValue={String(node.kind === 'element' ? (node.attrs?.href ?? '') : '')}
            placeholder="/contact"
            onBlur={(event) => setAttr('href', event.currentTarget.value.trim())}
          />
          <FieldDescription>
            A page on your own site starts with a slash, like <code>/contact</code>.
          </FieldDescription>
        </Field>
      ) : null}

      {tag === 'img' ? (
        <>
          <Field>
            <FieldLabel>Picture</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                key={`${id}:src`}
                defaultValue={String(node.kind === 'element' ? (node.attrs?.src ?? '') : '')}
                onBlur={(event) => setAttr('src', event.currentTarget.value.trim())}
              />
              {host.pickAsset ? (
                <Button size="sm" color="primary" onClick={() => void choosePicture()}>
                  Choose
                </Button>
              ) : null}
            </div>
          </Field>
          <Field>
            <FieldLabel>Describe the picture</FieldLabel>
            <Input
              key={`${id}:alt`}
              defaultValue={String(node.kind === 'element' ? (node.attrs?.alt ?? '') : '')}
              onBlur={(event) => setAttr('alt', event.currentTarget.value.trim())}
            />
            <FieldDescription>
              Read aloud to anyone using a screen reader, and shown if the picture can’t load.
            </FieldDescription>
          </Field>
        </>
      ) : null}

      <Field>
        <FieldLabel>Name this layer</FieldLabel>
        <Input
          key={`${id}:label`}
          defaultValue={node.label ?? ''}
          placeholder="Hero, Prices, Opening hours…"
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (value === (node.label ?? '')) return;
            apply('Rename layer', [{ kind: 'node.setLabel', id, value: value || undefined }]);
          }}
        />
        <FieldDescription>Only you see this — it makes the Layers list readable.</FieldDescription>
      </Field>

      {/* A host lock has no unlock here on purpose: the platform pinned it, and an
          author who could clear it would break the thing it was pinning. */}
      {node.locked !== 'host' ? (
        <Field>
          <FieldLabel>Lock in place</FieldLabel>
          <Switch
            checked={node.locked === 'author'}
            onCheckedChange={(checked: boolean) =>
              apply(checked ? 'Lock' : 'Unlock', [
                { kind: 'node.setLocked', id, value: checked ? 'author' : undefined },
              ])
            }
          />
          <FieldDescription>Stops this being moved or deleted by accident.</FieldDescription>
        </Field>
      ) : (
        <p className="text-base-content text-sm">
          This part is kept in place by Piggles so the page keeps working.
        </p>
      )}

      {host.inspectorPanels?.(node, { doc: refOf(doc), isRoot: rootId(doc) === id })}
    </div>
  );
}
