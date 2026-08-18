'use client';

import { type ReactNode } from 'react';
import {
  Briefcase,
  Car,
  ChevronDown,
  Cpu,
  Dumbbell,
  Plus,
  Scissors,
  Shirt,
  Sparkles,
  Utensils,
  Warehouse,
  X,
} from 'lucide-react';
import { Popover } from './popover';
import styles from './story.module.css';

// The canvas primitives: the tappable chips, ghost slots, "+" buttons, and inline
// inputs the sentence is assembled from. Each is a scoped-CSS element, not a
// re-skinned control — the composer is a bespoke inline-prose builder.
//
// A chip's module hue is set purely by `data-module="…"`: the @sparx/brand bridge
// maps that attribute to `--color-module`, which the CSS module reads. No inline
// style, no color table — the same mechanism as <ModuleScope>.

type MenuRender = (close: () => void) => ReactNode;

const INDUSTRY_ICONS: Record<string, typeof Sparkles> = {
  shirt: Shirt,
  utensils: Utensils,
  cpu: Cpu,
  car: Car,
  scissors: Scissors,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  warehouse: Warehouse,
  sparkles: Sparkles,
};

export function IndustryIcon({ icon, size }: { icon: string; size?: number }): ReactNode {
  const Cmp = INDUSTRY_ICONS[icon] ?? Sparkles;
  return <Cmp size={size ?? 18} strokeWidth={1.8} />;
}

/** A dashed "ghost" slot that pulses to invite the next choice. */
export function GhostTok({ label, menu }: { label: string; menu: MenuRender }): ReactNode {
  return (
    <Popover
      button={({ onClick, expanded }) => (
        <button type="button" className={styles.ghost} onClick={onClick} aria-expanded={expanded}>
          <span>{label}</span>
          <ChevronDown className={styles.chev} size={20} strokeWidth={2.2} aria-hidden />
        </button>
      )}
    >
      {menu}
    </Popover>
  );
}

/** A chosen, recolorable chip (tense / industry / audience). `module` sets the hue;
 *  the neutral tense chip passes none and reads as a base-tone chip. */
export function ChipTok({
  label,
  module,
  neutral,
  icon,
  menu,
}: {
  label: string;
  module?: string;
  neutral?: boolean;
  icon?: ReactNode;
  menu: MenuRender;
}): ReactNode {
  return (
    <Popover
      button={({ onClick, expanded }) => (
        <button
          type="button"
          className={neutral ? `${styles.tok} ${styles.neutral}` : styles.tok}
          data-module={module}
          onClick={onClick}
          aria-expanded={expanded}
        >
          {icon ? <span className={styles.ico}>{icon}</span> : null}
          <span>{label}</span>
          <ChevronDown className={styles.chev} size={20} strokeWidth={2.2} aria-hidden />
        </button>
      )}
    >
      {menu}
    </Popover>
  );
}

/** A clause chip: click the body to CHANGE it (swap menu); the × removes it. */
export function ClauseChip({
  mod,
  phrase,
  onRemove,
  menu,
}: {
  mod: string;
  phrase: string;
  onRemove: () => void;
  menu: MenuRender;
}): ReactNode {
  return (
    <Popover
      button={({ onClick, expanded }) => (
        <span className={styles.tok} data-module={mod}>
          <button
            type="button"
            className={styles.tokBody}
            onClick={onClick}
            aria-expanded={expanded}
            title="Change this"
          >
            <span>{phrase}</span>
            <ChevronDown className={styles.chev} size={20} strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.x}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove ${phrase}`}
          >
            <X size={12} strokeWidth={2.6} aria-hidden />
          </button>
        </span>
      )}
    >
      {menu}
    </Popover>
  );
}

/** The inline "+" — `in` extends a sentence, `next` starts a new one, `more` is the
 *  labelled empty-state pill. One unified look across the first two. */
export function AddButton({
  kind,
  menu,
}: {
  kind: 'in' | 'next' | 'more';
  menu: MenuRender;
}): ReactNode {
  return (
    <Popover
      button={({ onClick, expanded }) =>
        kind === 'more' ? (
          <button
            type="button"
            className={styles.addMore}
            onClick={onClick}
            aria-expanded={expanded}
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden /> add to your story
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.addBtn} ${kind === 'in' ? styles.addIn : styles.addNext}`}
            onClick={onClick}
            aria-expanded={expanded}
            aria-label={kind === 'in' ? 'Add to this sentence' : 'Start a new sentence'}
          >
            <Plus size={12} strokeWidth={2.4} aria-hidden />
          </button>
        )
      }
    >
      {menu}
    </Popover>
  );
}

/** An inline input that grows to fit its content — the dropship object slot and the
 *  web-address handle. Sizes to content via CSS `field-sizing` where supported, and
 *  falls back to the `size` attribute (character count) everywhere else. No inline
 *  style, no JS measurement. */
export function AutoInput({
  value,
  onChange,
  placeholder,
  mono,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono?: boolean;
  ariaLabel: string;
}): ReactNode {
  const shown = value || placeholder;
  const chars = Math.max(mono ? 9 : 6, shown.length + 1);
  return (
    <span className={styles.autoWrap}>
      <input
        className={mono ? styles.handle : styles.slot}
        size={chars}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
