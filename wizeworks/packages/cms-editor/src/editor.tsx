'use client';

// JSON-mode block editor.
//
// Mirrors the @wizeworks/ui RichTextEditor's toolbar shape but persists the
// TipTap doc as JSON (the on-the-wire shape api-rest stores in
// `content_entries.body`). The dashboard's CMS edit form embeds this; the
// HTML-emitting RichTextEditor in @wizeworks/ui stays available for places
// where HTML output is convenient (email composer, support replies).
//
// Block coverage matches `extensions.ts`: paragraph, headings, lists,
// blockquote, code-with-language, table, image (with focal-point + caption),
// callout (info/success/warning/danger), embed (video: YouTube/Vimeo/Loom;
// audio/podcast: Spotify/SoundCloud/Apple Music/Apple Podcasts),
// and @-reference autocomplete. Insertion happens via the inline toolbar
// for the common cases and the "More blocks" overflow for the rest.

import * as React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  Bold,
  Code as CodeIcon,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Tv,
  Undo2,
} from 'lucide-react';
import { cn } from '@wizeworks/silica-corrections';
import { cmsEditorExtensions, emptyDoc } from './extensions';
import { detectProvider } from './nodes';
import type { ReferenceSearchFn } from './nodes';
import type { CalloutVariant } from './nodes';
import { ALLOWED_CODE_LANGUAGES } from './serialize';
import type { JSONContent } from '@tiptap/react';

export type CmsDoc = Record<string, unknown>;

export interface ContentBlockEditorProps {
  value?: CmsDoc;
  onChange?: (doc: CmsDoc) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /**
   * Minimum height of the editing surface as any CSS length (e.g. `'28rem'`,
   * `'50vh'`). Sets the `--cms-editor-min-h` custom property consumed by
   * `editor.css`; defaults to 18rem. Use a larger value where the body is the
   * primary field (e.g. an article's content in the creation wizard).
   */
  minHeight?: string;
  /**
   * DOM id forwarded to the contenteditable surface. Lets a sibling
   * <Label htmlFor> click-focus into the editor and screen-readers walk
   * aria-labelledby/describedby references back to a visible label.
   */
  id?: string;
  /**
   * Search callback for the @-mention popover. The dashboard supplies one
   * that hits /v1/content/entries; consumers without a reference index can
   * omit it and the popover stays empty.
   */
  referenceSearch?: ReferenceSearchFn;
  /**
   * Open a media picker and resolve to an upload result. The dashboard
   * supplies one that opens the asset library overlay; without it the
   * "Insert image" button falls back to a URL prompt.
   */
  pickImage?: () => Promise<{
    src: string;
    alt?: string;
    caption?: string;
    assetId?: string;
  } | null>;
}

interface ToolButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}

function ToolButton({ onClick, active, disabled, label, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150',
        'focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-module bg-soft text-module'
          : 'text-base-content hover:bg-base-200 hover:text-base-content'
      )}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <span aria-hidden className="bg-base-300 mx-1 h-4 w-px" />;
}

// Small floating overlay used by the "More blocks" button.
function BlockMenu({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'bg-base-100 absolute z-50 mt-1 min-w-[14rem] rounded-md border p-1 shadow-lg',
        'border-base-300'
      )}
    >
      {children}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
        'text-base-content hover:bg-base-200',
        'focus-visible:bg-base-200 focus-visible:outline-none'
      )}
    >
      {icon ? <span className="text-base-content">{icon}</span> : null}
      {label}
    </button>
  );
}

export function ContentBlockEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  ariaLabel = 'Content editor',
  minHeight,
  id,
  referenceSearch,
  pickImage,
}: ContentBlockEditorProps) {
  const extensions = React.useMemo(
    () => cmsEditorExtensions({ placeholder, referenceSearch }),
    [placeholder, referenceSearch]
  );

  const editor = useEditor({
    extensions,
    content: (value ?? emptyDoc()) as JSONContent,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange?.(e.getJSON());
    },
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        ...(id ? { id } : {}),
        // Appearance lives in editor.css (`.sparx-content-editor`) so it ships
        // with the package and never depends on the consuming app's Tailwind
        // `@source` scanning. Min-height is driven by the --cms-editor-min-h
        // custom property set on the wrapper below.
        class: 'sparx-content-editor',
      },
    },
  });

  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!editor || !value) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const setLink = () => {
    const previous = (editor.getAttributes('link') as { href?: string }).href ?? '';
    const next = window.prompt('Link URL', previous);
    if (next === null) return;
    if (next === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run();
  };

  const insertImage = async () => {
    if (pickImage) {
      const picked = await pickImage();
      if (!picked) return;
      editor
        .chain()
        .focus()
        .setSparxImage({
          src: picked.src,
          alt: picked.alt,
          caption: picked.caption,
          assetId: picked.assetId,
        })
        .run();
      return;
    }
    const url = window.prompt('Image URL');
    if (!url) return;
    const alt = window.prompt('Alt text (required for accessibility)') ?? '';
    editor.chain().focus().setSparxImage({ src: url, alt }).run();
  };

  const insertEmbed = () => {
    const url = window.prompt(
      'Embed URL — a video (YouTube, Vimeo, Loom) or a track, album or podcast (Spotify, ' +
        'SoundCloud, Apple Music, Apple Podcasts). Pasted as-is; the storefront re-validates ' +
        'before rendering.'
    );
    if (!url) return;
    // The SAME provider detection the serializer and the storefront use, so the editor
    // never accepts a link the render path would drop (nor rejects one it would frame).
    editor
      .chain()
      .focus()
      .setEmbed({ provider: detectProvider(url), url })
      .run();
  };

  const insertCallout = (variant: CalloutVariant) => {
    editor.chain().focus().setCallout(variant).run();
    setMenuOpen(false);
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    setMenuOpen(false);
  };

  const insertHorizontalRule = () => {
    editor.chain().focus().setHorizontalRule().run();
    setMenuOpen(false);
  };

  const toggleCodeBlock = () => {
    const lang =
      window.prompt(
        `Code language (one of: ${[...ALLOWED_CODE_LANGUAGES].slice(0, 12).join(', ')}…)`
      ) ?? '';
    editor
      .chain()
      .focus()
      .toggleCodeBlock(lang ? { language: lang } : undefined)
      .run();
    setMenuOpen(false);
  };

  return (
    <div
      className={cn(
        'bg-base-100 relative rounded-md border',
        'border-base-300 focus-within:border-primary',
        'focus-within:ring-primary focus-within:ring-2 focus-within:ring-offset-2',
        'transition-colors duration-150',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      style={minHeight ? ({ '--cms-editor-min-h': minHeight } as React.CSSProperties) : undefined}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-base-300 flex flex-wrap items-center gap-0.5 border-b p-1"
      >
        <ToolButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Inline code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolDivider />

        <ToolButton
          label="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolDivider />

        <ToolButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Ordered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          label="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolDivider />

        <ToolButton label="Link" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton label="Insert image" onClick={() => void insertImage()}>
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton label="Insert embed" onClick={insertEmbed}>
          <Tv className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolDivider />

        <span className="relative">
          <ToolButton label="More blocks" onClick={() => setMenuOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
          </ToolButton>
          <BlockMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
            <MenuItem
              icon={<Info className="h-3.5 w-3.5" />}
              label="Callout — info"
              onClick={() => insertCallout('info')}
            />
            <MenuItem
              icon={<Info className="h-3.5 w-3.5" />}
              label="Callout — success"
              onClick={() => insertCallout('success')}
            />
            <MenuItem
              icon={<Info className="h-3.5 w-3.5" />}
              label="Callout — warning"
              onClick={() => insertCallout('warning')}
            />
            <MenuItem
              icon={<Info className="h-3.5 w-3.5" />}
              label="Callout — danger"
              onClick={() => insertCallout('danger')}
            />
            <MenuItem
              icon={<TableIcon className="h-3.5 w-3.5" />}
              label="Insert 3×3 table"
              onClick={insertTable}
            />
            <MenuItem
              icon={<CodeIcon className="h-3.5 w-3.5" />}
              label="Code block (with language)"
              onClick={toggleCodeBlock}
            />
            <MenuItem
              icon={<Minus className="h-3.5 w-3.5" />}
              label="Horizontal rule"
              onClick={insertHorizontalRule}
            />
          </BlockMenu>
        </span>

        <span className="ml-auto flex items-center gap-0.5">
          <ToolButton
            label="Undo"
            disabled={!editor.can().chain().focus().undo().run()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton
            label="Redo"
            disabled={!editor.can().chain().focus().redo().run()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </ToolButton>
        </span>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
ContentBlockEditor.displayName = 'ContentBlockEditor';
