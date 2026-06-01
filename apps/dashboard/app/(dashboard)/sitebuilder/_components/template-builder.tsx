'use client';

// Template builder for the Section Studio (docs/38 Phase C; Section Studio
// increment 6). Two editors over ONE AST: a visual tree builder and a raw JSON
// view, toggled by [Visual | JSON]. The AST (`value`) is the single source of
// truth, owned by the Studio; the visual editor mutates it structurally, the JSON
// view commits a parse only when it's shape-valid (semantic issues still commit so
// they surface in the issue list — they just block Save).
//
// While the JSON draft is unparseable / shape-invalid it is NOT committed (the AST
// holds the last good tree, so the preview keeps rendering); `onJsonErrorChange`
// lifts that state so the Studio can block Save.

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, Textarea } from '@sparx/ui';
import { AlertTriangle } from 'lucide-react';
import {
  SectionTemplate,
  validateTemplate,
  type SectionField,
  type TemplateIssue,
  type TemplateNode,
} from '@sparx/sitebuilder-schemas';
import { TemplateTreeEditor } from './template-tree-editor';

export interface TemplateBuilderProps {
  value: TemplateNode;
  onChange: (next: TemplateNode) => void;
  fieldSpec: SectionField[];
  binding: 'product' | 'collection' | null;
  /** Lifts "the JSON draft is uncommitted/invalid" so the Studio can block Save. */
  onJsonErrorChange: (hasError: boolean) => void;
}

type Mode = 'visual' | 'json';

export function TemplateBuilder({
  value,
  onChange,
  fieldSpec,
  binding,
  onJsonErrorChange,
}: TemplateBuilderProps) {
  const [mode, setMode] = React.useState<Mode>('visual');
  const [jsonDraft, setJsonDraft] = React.useState('');
  // Non-null while the JSON draft can't be committed (syntax or shape).
  const [jsonErr, setJsonErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    onJsonErrorChange(mode === 'json' && jsonErr !== null);
  }, [mode, jsonErr, onJsonErrorChange]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'json') setJsonDraft(JSON.stringify(value, null, 2));
    setJsonErr(null);
    setMode(next);
  };

  const onJsonChange = (text: string) => {
    setJsonDraft(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setJsonErr('Invalid JSON syntax.');
      return;
    }
    const res = SectionTemplate.safeParse(parsed);
    if (!res.success) {
      setJsonErr('Template shape is invalid.');
      return;
    }
    setJsonErr(null);
    onChange(res.data);
  };

  // Issues to display reflect the EFFECTIVE template: the live AST in visual mode,
  // the parsed draft in JSON mode (so you see the draft's own problems).
  const { issues, syntaxError } = React.useMemo((): {
    issues: TemplateIssue[];
    syntaxError: boolean;
  } => {
    if (mode === 'json') {
      try {
        return {
          issues: validateTemplate(JSON.parse(jsonDraft), { fieldSpec, binding }),
          syntaxError: false,
        };
      } catch {
        return { issues: [], syntaxError: true };
      }
    }
    return { issues: validateTemplate(value, { fieldSpec, binding }), syntaxError: false };
  }, [mode, jsonDraft, value, fieldSpec, binding]);

  const valid = !syntaxError && issues.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
          <TabsList variant="pills" size="sm">
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
        </Tabs>
        {valid ? (
          <span className="text-xs font-medium text-[var(--color-success)]">Valid</span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {syntaxError ? 'Invalid JSON' : 'Has issues'}
          </span>
        )}
      </div>

      {mode === 'visual' ? (
        <TemplateTreeEditor
          value={value}
          onChange={onChange}
          fieldSpec={fieldSpec}
          binding={binding}
        />
      ) : (
        <Textarea
          aria-label="Template JSON"
          value={jsonDraft}
          onChange={(e) => onJsonChange(e.target.value)}
          spellCheck={false}
          rows={18}
          className="font-mono text-xs"
        />
      )}

      <TemplateIssues issues={issues} syntaxError={syntaxError} />
    </div>
  );
}

function TemplateIssues({
  issues,
  syntaxError,
}: {
  issues: TemplateIssue[];
  syntaxError: boolean;
}) {
  if (syntaxError) {
    return <p className="text-xs text-[var(--color-danger)]">Invalid JSON syntax.</p>;
  }
  if (issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue, i) => (
        <li key={i} className="flex gap-1.5 text-xs text-[var(--color-danger)]">
          <span className="font-mono text-[var(--color-text-muted)]">{issue.path}</span>
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
