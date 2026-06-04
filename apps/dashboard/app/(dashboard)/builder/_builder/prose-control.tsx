'use client';

// The inspector's rich-text control (docs/52 §9) — the `richtext` PropSpec.
// Wraps @sparx/cms-editor's ContentBlockEditor so a node's authored body (a
// TipTap / CMS document) is edited inline in the inspector, with the same editor
// CMS pages use. The doc lives on the node's prop (e.g. Prose → `doc`); the email
// and site renderers serialize it to sanitised, inline-safe HTML on render. This
// is the free-form authoring surface the retired authored-template editor owned.

import * as React from 'react';
import { ContentBlockEditor, type CmsDoc } from '@sparx/cms-editor';

const EMPTY_DOC: CmsDoc = { type: 'doc', content: [] };

function isDoc(value: unknown): value is CmsDoc {
  return (
    typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'doc'
  );
}

export interface ProseControlProps {
  value: unknown;
  onChange: (doc: CmsDoc) => void;
  placeholder?: string;
}

export function ProseControl({ value, onChange, placeholder }: ProseControlProps) {
  // Tolerate any stored shape (legacy/empty props) — a non-doc value seeds blank.
  const doc = isDoc(value) ? value : EMPTY_DOC;
  return (
    <div className="bx-prose-control">
      <ContentBlockEditor value={doc} onChange={onChange} placeholder={placeholder ?? 'Write…'} />
    </div>
  );
}
