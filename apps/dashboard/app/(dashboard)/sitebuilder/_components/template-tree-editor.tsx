'use client';

// Visual tree builder for the Section Studio (docs/38 Phase C; Section Studio
// increment 6). Edits the template AST structurally — a node tree with selection,
// a palette to add nodes, per-node prop panels, and (for bound props) the
// value-expression + condition editors — over the SAME AST the JSON view shows.
//
// The AST is the single source of truth (the parent owns it); every edit returns
// a new tree via immutable path-addressed updates. Binding scope (which field.* /
// item.* paths are legal) is recomputed at each node's location, mirroring the
// validator's scoping, so the pickers only offer paths that resolve.

import * as React from 'react';
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import { ChevronDown, ChevronUp, CornerDownRight, Trash2 } from 'lucide-react';
import type { SectionField, TemplateNode, ValueExpr } from '@sparx/sitebuilder-schemas';
import { ValueExprField, ConditionEditor, type BindScope } from './value-expr-editor';

// ── Path-addressed tree ops ──────────────────────────────────────────────────
// A node is addressed by a path of {branch, index} segments. Only `children`
// (every container) and `else` (If) hold child arrays.

type Branch = 'children' | 'else';
interface PathSeg {
  branch: Branch;
  index: number;
}
type NodePath = PathSeg[];

const UNSET = '__unset';
const CONTAINER_TYPES = new Set<TemplateNode['type']>(['Stack', 'Grid', 'Box', 'Repeater', 'If']);
const isContainer = (node: TemplateNode) => CONTAINER_TYPES.has(node.type);

function getChildren(node: TemplateNode, branch: Branch): TemplateNode[] | undefined {
  if (branch === 'else') return node.type === 'If' ? node.else : undefined;
  return 'children' in node ? node.children : undefined;
}

function withChildren(node: TemplateNode, branch: Branch, list: TemplateNode[]): TemplateNode {
  if (branch === 'else') return { ...node, else: list } as TemplateNode;
  return { ...node, children: list } as TemplateNode;
}

function nodeAt(root: TemplateNode, path: NodePath): TemplateNode | null {
  let cur: TemplateNode = root;
  for (const seg of path) {
    const next = getChildren(cur, seg.branch)?.[seg.index];
    if (!next) return null;
    cur = next;
  }
  return cur;
}

function setNodeAt(root: TemplateNode, path: NodePath, node: TemplateNode): TemplateNode {
  if (path.length === 0) return node;
  const [seg, ...rest] = path;
  const list = getChildren(root, seg!.branch) ?? [];
  const child = list[seg!.index];
  if (!child) return root;
  const newChild = setNodeAt(child, rest, node);
  return withChildren(
    root,
    seg!.branch,
    list.map((c, i) => (i === seg!.index ? newChild : c))
  );
}

function updateChildList(
  root: TemplateNode,
  parentPath: NodePath,
  branch: Branch,
  fn: (list: TemplateNode[]) => TemplateNode[]
): TemplateNode {
  const parent = nodeAt(root, parentPath);
  if (!parent) return root;
  return setNodeAt(
    root,
    parentPath,
    withChildren(parent, branch, fn(getChildren(parent, branch) ?? []))
  );
}

const pathKey = (path: NodePath) => path.map((s) => `${s.branch}:${s.index}`).join('/');

// Binding scope at a location, mirroring the validator: `field.*` is always the
// top-level spec; `item.*`/`index` resolve the innermost enclosing Repeater; a
// Repeater `each` resolves a list field at the current level.
function scopeAtPath(
  root: TemplateNode,
  path: NodePath,
  fieldSpec: SectionField[],
  binding: 'product' | 'collection' | null
): { scope: BindScope; lists: SectionField[] } {
  let itemFields: SectionField[] | null = null;
  let listSource: SectionField[] = fieldSpec;
  let cur: TemplateNode = root;
  for (const seg of path) {
    const child = getChildren(cur, seg.branch)?.[seg.index];
    if (!child) break;
    if (cur.type === 'Repeater' && seg.branch === 'children') {
      const each = cur.each;
      const lf = listSource.find((f) => f.type === 'list' && f.key === each);
      itemFields = lf?.itemFields ?? [];
      listSource = itemFields;
    }
    cur = child;
  }
  return {
    scope: { fields: fieldSpec, itemFields, inRepeater: itemFields !== null, binding },
    lists: listSource.filter((f) => f.type === 'list'),
  };
}

function makeNode(
  type: TemplateNode['type'],
  lists: SectionField[],
  fields: SectionField[]
): TemplateNode {
  switch (type) {
    case 'Stack':
      return { type: 'Stack', children: [] };
    case 'Grid':
      return { type: 'Grid', children: [] };
    case 'Box':
      return { type: 'Box', pad: 'md', children: [] };
    case 'Heading':
      return { type: 'Heading', text: 'Heading' };
    case 'Text':
      return { type: 'Text', text: 'Text' };
    case 'RichText':
      return { type: 'RichText', html: '' };
    case 'Image':
      return { type: 'Image', src: '' };
    case 'Icon':
      return { type: 'Icon', name: 'star' };
    case 'Button':
      return { type: 'Button', label: 'Button', url: '#' };
    case 'Link':
      return { type: 'Link', label: 'Link', url: '#' };
    case 'Divider':
      return { type: 'Divider' };
    case 'Spacer':
      return { type: 'Spacer' };
    case 'Repeater':
      return {
        type: 'Repeater',
        each: lists[0]?.key ?? '',
        children: [{ type: 'Text', text: '' }],
      };
    case 'If':
      return {
        type: 'If',
        test: { $exists: fields[0] ? `field.${fields[0].key}` : 'field.' },
        children: [{ type: 'Text', text: '' }],
      };
    case 'Embed':
      return { type: 'Embed', url: '' };
  }
}

// Embed is omitted — it always fails validation until the host allowlist lands.
const PALETTE: { type: TemplateNode['type']; label: string }[] = [
  { type: 'Stack', label: 'Stack' },
  { type: 'Grid', label: 'Grid' },
  { type: 'Box', label: 'Box' },
  { type: 'Heading', label: 'Heading' },
  { type: 'Text', label: 'Text' },
  { type: 'RichText', label: 'Rich text' },
  { type: 'Image', label: 'Image' },
  { type: 'Icon', label: 'Icon' },
  { type: 'Button', label: 'Button' },
  { type: 'Link', label: 'Link' },
  { type: 'Divider', label: 'Divider' },
  { type: 'Spacer', label: 'Spacer' },
  { type: 'Repeater', label: 'Repeater' },
  { type: 'If', label: 'Condition' },
];

// ── A glanceable one-line summary for a tree row ─────────────────────────────
function exprText(e: ValueExpr | undefined): string {
  if (e == null) return '';
  if (typeof e === 'string') return e ? `“${e}”` : '';
  if ('$bind' in e) return `{${e.$bind}}`;
  return 'joined';
}

function summaryOf(node: TemplateNode): string {
  switch (node.type) {
    case 'Heading':
    case 'Text':
      return exprText(node.text);
    case 'Button':
    case 'Link':
      return exprText(node.label);
    case 'Icon':
      return exprText(node.name);
    case 'Repeater':
      return `each: ${node.each || '—'}`;
    case 'RichText':
      return 'rich text';
    case 'Image':
      return 'image';
    default:
      return '';
  }
}

// ── The editor ───────────────────────────────────────────────────────────────
export interface TemplateTreeEditorProps {
  value: TemplateNode;
  onChange: (next: TemplateNode) => void;
  fieldSpec: SectionField[];
  binding: 'product' | 'collection' | null;
}

export function TemplateTreeEditor({
  value,
  onChange,
  fieldSpec,
  binding,
}: TemplateTreeEditorProps) {
  const [selected, setSelected] = React.useState<NodePath>([]);
  const [addNonce, setAddNonce] = React.useState(0);

  // A stale selection (after an external JSON edit) falls back to no node.
  const selectedNode = nodeAt(value, selected);
  const selKey = pathKey(selected);

  const move = (path: NodePath, dir: -1 | 1) => {
    if (path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const seg = path[path.length - 1]!;
    const parent = nodeAt(value, parentPath);
    const list = parent ? (getChildren(parent, seg.branch) ?? []) : [];
    const j = seg.index + dir;
    if (j < 0 || j >= list.length) return;
    onChange(
      updateChildList(value, parentPath, seg.branch, (l) => {
        const next = [...l];
        const tmp = next[seg.index]!;
        next[seg.index] = next[j]!;
        next[j] = tmp;
        return next;
      })
    );
    setSelected([...parentPath, { branch: seg.branch, index: j }]);
  };

  const remove = (path: NodePath) => {
    if (path.length === 0) return; // root can't be deleted
    const parentPath = path.slice(0, -1);
    const seg = path[path.length - 1]!;
    onChange(
      updateChildList(value, parentPath, seg.branch, (l) => l.filter((_, i) => i !== seg.index))
    );
    setSelected(parentPath);
  };

  // Where a palette pick lands: inside the selected container, else after the
  // selected leaf (within its parent), else appended to root.
  const target = (() => {
    if (selectedNode && isContainer(selectedNode))
      return { parentPath: selected, branch: 'children' as Branch, append: true };
    if (selected.length > 0) {
      const seg = selected[selected.length - 1]!;
      return {
        parentPath: selected.slice(0, -1),
        branch: seg.branch,
        append: false,
        after: seg.index,
      };
    }
    return { parentPath: [] as NodePath, branch: 'children' as Branch, append: true };
  })();

  const targetNode = nodeAt(value, target.parentPath);
  const canAdd = !!targetNode && isContainer(targetNode);

  const add = (type: TemplateNode['type']) => {
    if (!canAdd) return;
    const { lists, scope } = scopeAtPath(value, target.parentPath, fieldSpec, binding);
    const node = makeNode(type, lists, scope.fields);
    const existing = getChildren(targetNode, target.branch) ?? [];
    const index = target.append ? existing.length : (target.after ?? existing.length - 1) + 1;
    onChange(
      updateChildList(value, target.parentPath, target.branch, (l) => {
        const next = [...l];
        next.splice(index, 0, node);
        return next;
      })
    );
    setSelected([...target.parentPath, { branch: target.branch, index }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Structure */}
      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border-default)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
            Structure
          </h3>
          <Select
            key={addNonce}
            onValueChange={(v) => {
              add(v as TemplateNode['type']);
              setAddNonce((n) => n + 1);
            }}
          >
            <SelectTrigger className="h-8 w-40 text-sm" disabled={!canAdd}>
              <SelectValue placeholder="Add node…" />
            </SelectTrigger>
            <SelectContent>
              {PALETTE.map((p) => (
                <SelectItem key={p.type} value={p.type}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {canAdd
            ? target.append
              ? `Adds inside ${targetNode.type}`
              : `Adds after the selected ${selectedNode?.type}`
            : 'Select a container to add nodes.'}
        </p>
        <div role="tree" className="flex flex-col gap-0.5">
          <NodeRow
            node={value}
            path={[]}
            depth={0}
            index={0}
            siblingCount={1}
            selKey={selKey}
            onSelect={setSelected}
            onMove={move}
            onDelete={remove}
          />
        </div>
      </div>

      {/* Inspector */}
      <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border-default)] p-3">
        {selectedNode ? (
          <NodeInspector
            node={selectedNode}
            scope={scopeAtPath(value, selected, fieldSpec, binding).scope}
            lists={scopeAtPath(value, selected, fieldSpec, binding).lists}
            onChange={(n) => onChange(setNodeAt(value, selected, n))}
          />
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">Select a node to edit it.</p>
        )}
      </div>
    </div>
  );
}

// ── Tree row (recursive) ─────────────────────────────────────────────────────
function NodeRow({
  node,
  path,
  depth,
  index,
  siblingCount,
  selKey,
  onSelect,
  onMove,
  onDelete,
}: {
  node: TemplateNode;
  path: NodePath;
  depth: number;
  index: number;
  siblingCount: number;
  selKey: string;
  onSelect: (p: NodePath) => void;
  onMove: (p: NodePath, dir: -1 | 1) => void;
  onDelete: (p: NodePath) => void;
}) {
  const isRoot = path.length === 0;
  const selected = pathKey(path) === selKey;
  const summary = summaryOf(node);
  const kids = getChildren(node, 'children') ?? [];
  const elseKids = node.type === 'If' ? (node.else ?? []) : [];

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={
          'flex items-center gap-1 rounded-sm pr-1 ' +
          (selected ? 'bg-[var(--module-active-tint)]' : 'hover:bg-[var(--color-bg-subtle)]')
        }
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onSelect(path)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{node.type}</span>
          {summary ? (
            <span className="truncate text-xs text-[var(--color-text-muted)]">{summary}</span>
          ) : null}
        </button>
        {!isRoot ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(path, -1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMove(path, 1)}
              disabled={index === siblingCount - 1}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(path)}
              aria-label="Delete node"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>

      {kids.map((child, i) => (
        <NodeRow
          key={i}
          node={child}
          path={[...path, { branch: 'children', index: i }]}
          depth={depth + 1}
          index={i}
          siblingCount={kids.length}
          selKey={selKey}
          onSelect={onSelect}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}

      {elseKids.length > 0 ? (
        <>
          <div
            className="flex items-center gap-1 py-1 text-xs text-[var(--color-text-muted)]"
            style={{ paddingLeft: depth * 12 + 12 }}
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            Otherwise
          </div>
          {elseKids.map((child, i) => (
            <NodeRow
              key={`else-${i}`}
              node={child}
              path={[...path, { branch: 'else', index: i }]}
              depth={depth + 1}
              index={i}
              siblingCount={elseKids.length}
              selKey={selKey}
              onSelect={onSelect}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

// ── Per-node inspector ───────────────────────────────────────────────────────
const GAP = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];
const PAD = ['none', 'sm', 'md', 'lg', 'xl'];
const opts = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

function NodeInspector({
  node,
  scope,
  lists,
  onChange,
}: {
  node: TemplateNode;
  scope: BindScope;
  lists: SectionField[];
  onChange: (n: TemplateNode) => void;
}) {
  return (
    <>
      <h3 className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
        {node.type}
      </h3>

      {node.type === 'Stack' ? (
        <>
          <EnumField
            label="Direction"
            value={node.dir}
            options={opts(['col', 'row'])}
            onChange={(dir) => onChange({ ...node, dir: dir as 'col' | 'row' | undefined })}
          />
          <EnumField
            label="Gap"
            value={node.gap}
            options={opts(GAP)}
            onChange={(gap) => onChange({ ...node, gap: gap as never })}
          />
          <EnumField
            label="Align"
            value={node.align}
            options={opts(['start', 'center', 'end', 'stretch'])}
            onChange={(align) => onChange({ ...node, align: align as never })}
          />
          <EnumField
            label="Justify"
            value={node.justify}
            options={opts(['start', 'center', 'end', 'between'])}
            onChange={(justify) => onChange({ ...node, justify: justify as never })}
          />
          <BoolField
            label="Wrap"
            value={node.wrap}
            onChange={(wrap) => onChange({ ...node, wrap })}
          />
        </>
      ) : null}

      {node.type === 'Grid' ? (
        <>
          {node.cols && typeof node.cols === 'object' ? (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-[var(--color-text-muted)]">Columns</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">Bound — edit in JSON</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ ...node, cols: undefined })}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : (
            <EnumField
              label="Columns"
              value={node.cols}
              options={opts(['1', '2', '3', '4'])}
              onChange={(cols) => onChange({ ...node, cols: cols as never })}
            />
          )}
          <EnumField
            label="Gap"
            value={node.gap}
            options={opts(GAP)}
            onChange={(gap) => onChange({ ...node, gap: gap as never })}
          />
        </>
      ) : null}

      {node.type === 'Box' ? (
        <>
          <EnumField
            label="Padding"
            value={node.pad}
            options={opts(PAD)}
            onChange={(pad) => onChange({ ...node, pad: pad as never })}
          />
          <EnumField
            label="Tone"
            value={node.tone}
            options={opts(['none', 'surface', 'subtle', 'inverse', 'brand-tint', 'accent-tint'])}
            onChange={(tone) => onChange({ ...node, tone: tone as never })}
          />
          <EnumField
            label="Radius"
            value={node.radius}
            options={opts(['none', 'sm', 'md', 'lg', 'pill'])}
            onChange={(radius) => onChange({ ...node, radius: radius as never })}
          />
          <BoolField
            label="Border"
            value={node.border}
            onChange={(border) => onChange({ ...node, border })}
          />
        </>
      ) : null}

      {node.type === 'Heading' ? (
        <>
          <EnumField
            label="Level"
            value={node.level ? String(node.level) : undefined}
            options={opts(['1', '2', '3'])}
            onChange={(lvl) =>
              onChange({ ...node, level: lvl ? (Number(lvl) as 1 | 2 | 3) : undefined })
            }
          />
          <ValueExprField
            label="Text"
            scope={scope}
            value={node.text}
            onChange={(text) => onChange({ ...node, text })}
          />
        </>
      ) : null}

      {node.type === 'Text' ? (
        <>
          <ValueExprField
            label="Text"
            scope={scope}
            value={node.text}
            onChange={(text) => onChange({ ...node, text })}
          />
          <EnumField
            label="Tone"
            value={node.tone}
            options={opts(['default', 'secondary', 'muted'])}
            onChange={(tone) => onChange({ ...node, tone: tone as never })}
          />
          <EnumField
            label="Size"
            value={node.size}
            options={opts(['sm', 'md', 'lg'])}
            onChange={(size) => onChange({ ...node, size: size as never })}
          />
        </>
      ) : null}

      {node.type === 'RichText' ? (
        <>
          <p className="text-xs text-[var(--color-text-muted)]">Bind to a rich-text field.</p>
          <ValueExprField
            label="HTML"
            scope={scope}
            value={node.html}
            onChange={(html) => onChange({ ...node, html })}
          />
        </>
      ) : null}

      {node.type === 'Image' ? (
        <>
          <ValueExprField
            label="Source"
            scope={scope}
            value={node.src}
            onChange={(src) => onChange({ ...node, src })}
          />
          <ValueExprField
            label="Alt text"
            scope={scope}
            value={node.alt ?? ''}
            onChange={(alt) => onChange({ ...node, alt })}
          />
          <EnumField
            label="Ratio"
            value={node.ratio}
            options={opts(['auto', '1:1', '4:3', '16:9', '21:9'])}
            onChange={(ratio) => onChange({ ...node, ratio: ratio as never })}
          />
          <EnumField
            label="Fit"
            value={node.fit}
            options={opts(['cover', 'contain'])}
            onChange={(fit) => onChange({ ...node, fit: fit as never })}
          />
        </>
      ) : null}

      {node.type === 'Icon' ? (
        <>
          <ValueExprField
            label="Name"
            scope={scope}
            value={node.name}
            onChange={(name) => onChange({ ...node, name })}
          />
          <EnumField
            label="Size"
            value={node.size}
            options={opts(['sm', 'md', 'lg'])}
            onChange={(size) => onChange({ ...node, size: size as never })}
          />
          <EnumField
            label="Tone"
            value={node.tone}
            options={opts(['default', 'muted', 'accent', 'brand'])}
            onChange={(tone) => onChange({ ...node, tone: tone as never })}
          />
        </>
      ) : null}

      {node.type === 'Button' || node.type === 'Link' ? (
        <>
          <ValueExprField
            label="Label"
            scope={scope}
            value={node.label}
            onChange={(label) => onChange({ ...node, label })}
          />
          <ValueExprField
            label="URL"
            scope={scope}
            value={node.url}
            onChange={(url) => onChange({ ...node, url })}
          />
          {node.type === 'Button' ? (
            <EnumField
              label="Variant"
              value={node.variant}
              options={opts(['solid', 'light', 'dark', 'ghost', 'link'])}
              onChange={(variant) => onChange({ ...node, variant: variant as never })}
            />
          ) : null}
        </>
      ) : null}

      {node.type === 'Spacer' ? (
        <EnumField
          label="Size"
          value={node.size}
          options={opts(['sm', 'md', 'lg', 'xl'])}
          onChange={(size) => onChange({ ...node, size: size as never })}
        />
      ) : null}

      {node.type === 'Repeater' ? (
        lists.length > 0 ? (
          <EnumField
            label="Repeat over"
            allowUnset={false}
            value={lists.some((f) => f.key === node.each) ? node.each : undefined}
            options={lists.map((f) => ({ value: f.key, label: f.label || f.key }))}
            onChange={(each) => onChange({ ...node, each: each ?? '' })}
          />
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            Add a “List” field to the field spec to repeat over it.
          </p>
        )
      ) : null}

      {node.type === 'If' ? (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Show when</Label>
          <ConditionEditor
            scope={scope}
            value={node.test}
            onChange={(test) => onChange({ ...node, test })}
          />
        </div>
      ) : null}

      {node.type === 'Divider' ? (
        <p className="text-xs text-[var(--color-text-muted)]">No settings.</p>
      ) : null}
    </>
  );
}

function EnumField({
  label,
  value,
  options,
  allowUnset = true,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  allowUnset?: boolean;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-[var(--color-text-muted)]">{label}</Label>
      <Select value={value ?? UNSET} onValueChange={(v) => onChange(v === UNSET ? undefined : v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowUnset ? <SelectItem value={UNSET}>Auto</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-[var(--color-text-muted)]">{label}</Label>
      <Select
        value={value ? 'on' : 'off'}
        onValueChange={(v) => onChange(v === 'on' ? true : undefined)}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="off">Off</SelectItem>
          <SelectItem value="on">On</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
