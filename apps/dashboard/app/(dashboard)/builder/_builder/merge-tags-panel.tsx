'use client';

// The "Merge tags" reference panel (docs/52 §7) — a searchable catalog of every
// `{{token}}` an email can use, grouped by source, with a friendly label + a sample
// value. Clicking a tag copies it to the clipboard. It's the discovery half of the
// merge-tag UX; the inline `{{` autocomplete (token-field.tsx) is the in-flow half.
// Both read the same `MergeTag[]` from @sparx/builder-schemas, so they never drift.

import * as React from 'react';
import { Check, Copy, Search } from 'lucide-react';
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle, toast } from '@sparx/ui';
import { filterMergeTags, groupMergeTags, type MergeTag } from '@sparx/builder-schemas';

export interface MergeTagsPanelProps {
  tags: MergeTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MergeTagsPanel({ tags, open, onOpenChange }: MergeTagsPanelProps) {
  const [query, setQuery] = React.useState('');
  const [copied, setCopied] = React.useState<string | null>(null);
  const groups = React.useMemo(() => groupMergeTags(filterMergeTags(tags, query)), [tags, query]);

  // Reset the search each time the panel closes so it reopens fresh.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setCopied(null);
    }
  }, [open]);

  const copy = (tag: MergeTag) => {
    void navigator.clipboard?.writeText(tag.token).then(
      () => {
        setCopied(tag.path);
        toast.success(`Copied ${tag.token}`);
        window.setTimeout(() => setCopied((c) => (c === tag.path ? null : c)), 1500);
      },
      () => toast.error('Could not copy to the clipboard.')
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Merge tags</ModalTitle>
          <ModalDescription>
            Drop any of these into a subject, heading, button, or text block — each fills in with
            the recipient&apos;s real details when the email sends. Type <code>{'{{'}</code> in any
            field to insert one inline, or copy it from here.
          </ModalDescription>
        </ModalHeader>

        <div className="bx-tagref">
          <div className="bx-tagref__search">
            <Search aria-hidden />
            <input
              className="bx-tagref__searchinput"
              value={query}
              placeholder="Search merge tags…"
              aria-label="Search merge tags"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="bx-tagref__scroll">
            {groups.length === 0 ? (
              <p className="bx-tagref__empty">No merge tags match “{query}”.</p>
            ) : (
              groups.map((group) => (
                <section key={group.source.key} className="bx-tagref__group">
                  <header className="bx-tagref__grouphead">
                    <span>{group.source.label}</span>
                    <span className="bx-tagref__scope" data-scope={group.tags[0]?.scope}>
                      {group.tags[0]?.scope === 'per-recipient' ? 'Per recipient' : 'Same for all'}
                    </span>
                  </header>
                  {group.tags.map((tag) => (
                    <button
                      key={tag.path}
                      type="button"
                      className="bx-tagref__row"
                      onClick={() => copy(tag)}
                      title={`Copy ${tag.token}`}
                    >
                      <span className="bx-tagref__token">{tag.token}</span>
                      <span className="bx-tagref__rowmeta">
                        <span className="bx-tagref__field">{tag.field}</span>
                        {tag.sample ? (
                          <span className="bx-tagref__sample">e.g. {tag.sample}</span>
                        ) : null}
                      </span>
                      <span className="bx-tagref__copy" aria-hidden>
                        {copied === tag.path ? <Check /> : <Copy />}
                      </span>
                    </button>
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
