'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
import { tintStyle } from './colors';
import styles from './story.module.css';

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
          <ChevronDown className={styles.chev} size={20} strokeWidth={2.2} />
        </button>
      )}
    >
      {menu}
    </Popover>
  );
}

/** A chosen, recolorable chip (tense / industry / audience). */
export function ChipTok({
  label,
  style,
  icon,
  menu,
}: {
  label: string;
  style?: CSSProperties;
  icon?: ReactNode;
  menu: MenuRender;
}): ReactNode {
  return (
    <Popover
      button={({ onClick, expanded }) => (
        <button
          type="button"
          className={styles.tok}
          style={style}
          onClick={onClick}
          aria-expanded={expanded}
        >
          {icon && <span className={styles.ico}>{icon}</span>}
          <span>{label}</span>
          <ChevronDown className={styles.chev} size={20} strokeWidth={2.2} />
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
        <span className={styles.tok} style={tintStyle(mod)}>
          <button
            type="button"
            className={styles.tokBody}
            onClick={onClick}
            aria-expanded={expanded}
            title="Change this"
          >
            <span>{phrase}</span>
            <ChevronDown className={styles.chev} size={20} strokeWidth={2.2} />
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
            <X size={12} strokeWidth={2.6} />
          </button>
        </span>
      )}
    >
      {menu}
    </Popover>
  );
}

/** The inline "+" — `in` extends a sentence, `next` starts a new one, `more` is the
 *  labeled empty-state pill. One unified look across the first two. */
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
            <Plus size={16} strokeWidth={2.4} /> add to your story
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.addBtn} ${kind === 'in' ? styles.addIn : styles.addNext}`}
            onClick={onClick}
            aria-expanded={expanded}
            aria-label={kind === 'in' ? 'Add to this sentence' : 'Start a new sentence'}
          >
            <Plus size={12} strokeWidth={2.4} />
          </button>
        )
      }
    >
      {menu}
    </Popover>
  );
}

/** An inline input that grows to fit its content (the dropship object slot + the
 *  web-address handle). A hidden span measures the text. */
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
  const measure = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(48);
  useEffect(() => {
    if (measure.current) setWidth(measure.current.offsetWidth + 28);
  }, [value, placeholder]);
  return (
    <span className={styles.autoWrap}>
      <input
        className={mono ? styles.handle : styles.slot}
        style={{ width }}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        ref={measure}
        aria-hidden
        className={styles.measure}
        style={mono ? { fontFamily: 'var(--font-geist-mono, ui-monospace, monospace)' } : undefined}
      >
        {value || placeholder}
      </span>
    </span>
  );
}
