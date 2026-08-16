'use client';

// The merge tags an author can drop into an email, grouped by where each comes from.
//
// Two things a business owner needs and cannot guess: WHAT they can put in, and
// what it will say. So every row shows the tag beside a real example — "Alex", not
// "customer.firstName" — because the tag is the part the canvas already shows them.
//
// Copy, rather than insert-at-caret: the author may be mid-sentence in any of
// several fields, so the clipboard lets them place it themselves.

import { useMemo, useState } from 'react';
import { Button, Input, useToast } from '@wizeworks/silicaui-react';
import { emailMergeTags, groupMergeTags, type MergeTag } from '../../lib/studio/email-domain';

/** A greeting that still reads properly for someone whose name you don't have. */
const SAFE_GREETING = '{{customer.firstName ?? "there"}}';

function matches(tag: MergeTag, needle: string): boolean {
  if (!needle) return true;
  return `${tag.label} ${tag.token} ${tag.sample ?? ''}`.toLowerCase().includes(needle);
}

function useCopy(): (text: string, said: string) => void {
  const toast = useToast();
  return (text, said) => {
    void navigator.clipboard.writeText(text).then(
      () => toast.add({ title: said, type: 'success' }),
      () => toast.add({ title: 'Could not copy that', type: 'error' })
    );
  };
}

export function EmailTagsPanel() {
  const [query, setQuery] = useState('');
  const copy = useCopy();
  const groups = useMemo(() => groupMergeTags(emailMergeTags()), []);

  const needle = query.trim().toLowerCase();
  const shown = groups
    .map((group) => ({ ...group, tags: group.tags.filter((tag) => matches(tag, needle)) }))
    .filter((group) => group.tags.length > 0);

  return (
    <section className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <p className="text-base-content text-sm font-medium">Things you can drop in</p>
      <p className="text-base-content text-sm">
        Copy one into your words and it becomes the real thing when the email goes out.
      </p>
      <Input
        size="sm"
        value={query}
        placeholder="Search — “name”, “order”, “total”"
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      {shown.map((group) => (
        <TagGroup key={group.source.key} label={group.source.label} tags={group.tags} copy={copy} />
      ))}

      {shown.length === 0 ? (
        <p className="text-base-content text-sm">Nothing matches “{query}”.</p>
      ) : null}

      <Button
        size="sm"
        variant="soft"
        color="primary"
        onClick={() => copy(SAFE_GREETING, 'Copied a greeting that always works')}
      >
        Copy a greeting with a backup
      </Button>
      <p className="text-base-content text-sm">
        A backup matters: without one, someone whose name you don’t have reads “Hi ,”.
      </p>
    </section>
  );
}

function TagGroup({
  label,
  tags,
  copy,
}: {
  label: string;
  tags: MergeTag[];
  copy: (text: string, said: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content text-sm font-medium">{label}</p>
      {tags.map((tag) => (
        <button
          key={tag.token}
          type="button"
          onClick={() => copy(tag.token, `${tag.token} copied`)}
          title={`Copy ${tag.token}`}
          className="hover:bg-base-200 flex w-full items-baseline gap-2 rounded px-2 py-1 text-left"
        >
          <span className="text-base-content min-w-0 flex-1 truncate text-sm">{tag.field}</span>
          {tag.sample ? (
            <span className="text-base-content shrink-0 text-sm">{tag.sample}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
