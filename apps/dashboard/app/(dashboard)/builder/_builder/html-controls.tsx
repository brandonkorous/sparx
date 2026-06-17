'use client';

// View HTML + Import HTML — the §3.8/§4.2 toolbar controls, mirroring the JSON
// ImportExportControls UX (docs/98). Two affordances on the raw-element foundation:
//
//   · VIEW HTML (read-only) — serialize the CLEAN PUBLISH output (not
//     canvas.innerHTML) of the whole document, and — when a node is selected — of
//     the selected subtree. A Copy button; a note that web output references the
//     compiled tenant.css (pasting elsewhere needs that stylesheet).
//   · IMPORT HTML (one-way) — paste a Tailwind fragment → parse + §4.1/allowlist-
//     validate → insert as Element nodes (fresh ids, via the stamp path) →
//     HONESTLY report what was dropped/changed. Bindings/behaviors are NOT inferred.
//
// All UI uses @sparx/ui components (Modal/Button/Textarea/Code) — no re-skinned
// controls. The serializer (clean publish HTML) lives in @sparx/builder-render; the
// parser bridge (DOMParser + injected allowlist/makeId) in ./html-actions.

import * as React from 'react';
import { Check, ClipboardCopy, Code2, FileCode2 } from 'lucide-react';
import {
  Button,
  Code,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Textarea,
  toast,
} from '@sparx/ui';
import { serializeNodeToHtml, serializeTreeToHtml } from '@sparx/builder-render';
import { reportHasChanges, summarizeReport, type ImportReport } from '@sparx/builder-schemas';

import type { BuilderNode } from './model';
import { importedRoot, parseHtmlFragment } from './html-actions';

export interface HtmlControlsProps {
  /** The active document tree (page or layout) — the whole-document View HTML. */
  tree: BuilderNode;
  /** The currently selected node, if any — enables the per-node "View HTML". */
  selectedNode?: BuilderNode | null;
  /** Insert imported nodes via the editor's stamp/insert path (fresh ids). Mirrors
   *  `onStamp` for catalog entries (docs/98 §4.2). Omit to disable Import. */
  onStamp?: (tree: BuilderNode) => void;
  /** Human label for the insert target (where imported nodes land). */
  targetName?: string;
  disabled?: boolean;
}

export function HtmlControls({
  tree,
  selectedNode,
  onStamp,
  targetName,
  disabled,
}: HtmlControlsProps) {
  const [viewOpen, setViewOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<Code2 className="h-3.5 w-3.5" />}
        disabled={disabled}
        onClick={() => setViewOpen(true)}
      >
        View HTML
      </Button>
      {onStamp ? (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<FileCode2 className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => setImportOpen(true)}
        >
          Import HTML
        </Button>
      ) : null}

      <ViewHtmlDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        tree={tree}
        selectedNode={selectedNode}
      />
      {onStamp ? (
        <ImportHtmlDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          targetName={targetName}
          onInsert={onStamp}
        />
      ) : null}
    </>
  );
}

// ── View HTML (read-only) ─────────────────────────────────────────────────────

type ViewScope = 'document' | 'selection';

function ViewHtmlDialog({
  open,
  onOpenChange,
  tree,
  selectedNode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: BuilderNode;
  selectedNode?: BuilderNode | null;
}) {
  const hasSelection = Boolean(selectedNode);
  const [scope, setScope] = React.useState<ViewScope>('document');
  const [copied, setCopied] = React.useState(false);

  // Default to the selected subtree when one exists and the dialog (re)opens.
  React.useEffect(() => {
    if (open) setScope(hasSelection ? 'selection' : 'document');
  }, [open, hasSelection]);

  // Serialize lazily (only while open) — the clean publish HTML, not canvas chrome.
  const html = React.useMemo(() => {
    if (!open) return '';
    if (scope === 'selection' && selectedNode) return serializeNodeToHtml(selectedNode);
    return serializeTreeToHtml(tree);
  }, [open, scope, selectedNode, tree]);

  const copy = () => {
    void navigator.clipboard.writeText(html).then(
      () => {
        setCopied(true);
        toast.success('HTML copied to clipboard.');
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error('Could not copy — select the text and copy manually.')
    );
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="xl" className="max-w-3xl">
        <ModalHeader>
          <ModalTitle>View HTML</ModalTitle>
          <ModalDescription>
            The clean, published HTML this {scope === 'selection' ? 'block' : 'page'} ships as —
            read-only. Class names reference your compiled site stylesheet, so pasting elsewhere
            needs that CSS to look the same.
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {hasSelection ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={scope === 'selection' ? 'soft' : 'ghost'}
                onClick={() => setScope('selection')}
              >
                Selected block
              </Button>
              <Button
                size="sm"
                variant={scope === 'document' ? 'soft' : 'ghost'}
                onClick={() => setScope('document')}
              >
                Whole page
              </Button>
            </div>
          ) : (
            <span className="text-xs text-[var(--color-text-tertiary)]">Whole page</span>
          )}
          <Button
            size="sm"
            variant="outline"
            leftIcon={
              copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />
            }
            onClick={copy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <Code
          variant="block"
          className="mt-3 max-h-[55vh] overflow-auto whitespace-pre"
          aria-label="Published HTML source"
        >
          {html || '<!-- nothing to show -->'}
        </Code>
      </ModalContent>
    </Modal>
  );
}

// ── Import HTML (one-way) ─────────────────────────────────────────────────────

function ImportHtmlDialog({
  open,
  onOpenChange,
  targetName,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetName?: string;
  onInsert: (tree: BuilderNode) => void;
}) {
  const [text, setText] = React.useState('');
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [pending, setPending] = React.useState<BuilderNode | null>(null);

  // Reset when the dialog opens fresh.
  React.useEffect(() => {
    if (open) {
      setText('');
      setReport(null);
      setPending(null);
    }
  }, [open]);

  const analyze = () => {
    const fragment = text.trim();
    if (!fragment) {
      toast.error('Paste some HTML first.');
      return;
    }
    const result = parseHtmlFragment(fragment);
    const root = importedRoot(result);
    if (!root) {
      setReport(result.report);
      setPending(null);
      toast.error('Nothing importable survived validation.');
      return;
    }
    setReport(result.report);
    setPending(root);
  };

  const insert = () => {
    if (!pending) return;
    onInsert(pending);
    toast.success(report ? summarizeReport(report) : 'Imported — review the canvas, then Publish.');
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="xl" className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>Import HTML</ModalTitle>
          <ModalDescription>
            Paste an HTML + Tailwind fragment to insert it as editable blocks
            {targetName ? ` inside ${targetName}` : ''}. Import is one-way: unsafe tags, attributes,
            and classes are dropped, and data bindings or interactive behaviors are not inferred —
            wire those up afterward in the inspector.
          </ModalDescription>
        </ModalHeader>

        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPending(null);
            setReport(null);
          }}
          rows={10}
          spellCheck={false}
          placeholder={
            '<section class="py-16">\n  <h1 class="text-4xl font-bold">Hello</h1>\n</section>'
          }
          className="font-mono text-xs"
          aria-label="HTML to import"
        />

        {report ? <ImportReportPanel report={report} /> : null}

        <ModalFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {pending ? (
            <Button variant="solid" onClick={insert}>
              Insert{' '}
              {report ? `${report.emitted} block${report.emitted === 1 ? '' : 's'}` : 'blocks'}
            </Button>
          ) : (
            <Button variant="solid" onClick={analyze}>
              Preview import
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/** The honest drop/change report (docs/98 §4.2) — what the validation removed or
 *  rewrote, so the import is never silent. */
function ImportReportPanel({ report }: { report: ImportReport }) {
  const clean = !reportHasChanges(report);
  return (
    <div className="mt-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3 text-xs">
      <p className="font-medium text-[var(--color-text-primary)]">{summarizeReport(report)}</p>
      {clean ? (
        <p className="mt-1 text-[var(--color-text-secondary)]">
          Everything passed validation — nothing was dropped.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-[var(--color-text-secondary)]">
          {report.droppedTags.map((d) => (
            <li key={`tag-${d.tag}`}>
              Dropped {d.count}× unsupported tag <code>&lt;{d.tag}&gt;</code>
            </li>
          ))}
          {report.droppedAttrs.map((d) => (
            <li key={`attr-${d.tag}-${d.attr}`}>
              Stripped {d.count}× attribute <code>{d.attr}</code> on <code>&lt;{d.tag}&gt;</code>
            </li>
          ))}
          {report.droppedClasses.map((d) => (
            <li key={`class-${d.token}`}>
              Removed {d.count}× class <code>{d.token}</code>
            </li>
          ))}
          {report.forcedRel > 0 ? (
            <li>
              Secured {report.forcedRel}× new-tab link with{' '}
              <code>rel=&quot;noopener noreferrer&quot;</code>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
