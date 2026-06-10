// Live Chat widget — self-contained stylesheet (docs/69 A-4).
//
// Injected once into <head> with a guard id so the widget renders identically on
// any tenant storefront and on sparx.market without depending on the host's
// Tailwind pipeline. All colors flow from `--sxchat-accent` (set inline on the
// root from config.primaryColor / the tenant accent / a default indigo), so
// per-tenant theming needs no rebuild.

export const STYLE_ELEMENT_ID = 'sxchat-styles';

export const WIDGET_CSS = `
.sxchat-root {
  --sxchat-accent: #6366F1;
  --sxchat-accent-fg: #ffffff;
  --sxchat-surface: #ffffff;
  --sxchat-text: #18181b;
  --sxchat-muted: #71717a;
  --sxchat-border: #e4e4e7;
  --sxchat-bubble-customer: var(--sxchat-accent);
  --sxchat-bubble-agent: #f4f4f5;
  position: fixed;
  bottom: 20px;
  z-index: 2147483000;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--sxchat-text);
}
.sxchat-root[data-position="bottom-right"] { right: 20px; }
.sxchat-root[data-position="bottom-left"] { left: 20px; }

.sxchat-bubble {
  width: 56px; height: 56px; border-radius: 9999px; border: none; cursor: pointer;
  background: var(--sxchat-accent); color: var(--sxchat-accent-fg);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18); transition: transform .15s ease, box-shadow .15s ease;
}
.sxchat-bubble:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.22); }
.sxchat-bubble svg { width: 26px; height: 26px; }
.sxchat-unread {
  position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9999px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}

.sxchat-panel {
  width: 360px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 96px);
  background: var(--sxchat-surface); border: 1px solid var(--sxchat-border); border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.22); display: flex; flex-direction: column; overflow: hidden;
}
@media (max-width: 480px) {
  .sxchat-panel { width: calc(100vw - 24px); height: calc(100vh - 88px); }
}

.sxchat-header {
  background: var(--sxchat-accent); color: var(--sxchat-accent-fg);
  padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;
}
.sxchat-header-title { font-weight: 600; font-size: 15px; }
.sxchat-header-status { font-size: 12px; opacity: .85; }
.sxchat-close { background: transparent; border: none; color: inherit; cursor: pointer; padding: 4px; border-radius: 6px; }
.sxchat-close:hover { background: rgba(255,255,255,0.18); }
.sxchat-close svg { width: 18px; height: 18px; display: block; }

.sxchat-thread { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #fafafa; }
.sxchat-row { display: flex; }
.sxchat-row.customer { justify-content: flex-end; }
.sxchat-msg {
  max-width: 78%; padding: 9px 12px; border-radius: 14px; font-size: 14px; line-height: 1.4;
  white-space: pre-wrap; word-break: break-word;
}
.sxchat-row.customer .sxchat-msg { background: var(--sxchat-bubble-customer); color: var(--sxchat-accent-fg); border-bottom-right-radius: 4px; }
.sxchat-row.agent .sxchat-msg { background: var(--sxchat-bubble-agent); color: var(--sxchat-text); border-bottom-left-radius: 4px; }
.sxchat-meta { font-size: 11px; color: var(--sxchat-muted); margin: 2px 4px 0; }
.sxchat-typing { font-size: 12px; color: var(--sxchat-muted); font-style: italic; padding: 0 4px; }

.sxchat-form { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.sxchat-greeting { font-size: 14px; color: var(--sxchat-text); }
.sxchat-input, .sxchat-textarea {
  width: 100%; border: 1px solid var(--sxchat-border); border-radius: 10px; padding: 10px 12px;
  font: inherit; font-size: 14px; color: var(--sxchat-text); background: #fff; outline: none; box-sizing: border-box;
}
.sxchat-input:focus, .sxchat-textarea:focus { border-color: var(--sxchat-accent); }
.sxchat-textarea { resize: none; }

.sxchat-composer { border-top: 1px solid var(--sxchat-border); padding: 10px; display: flex; gap: 8px; align-items: flex-end; background: var(--sxchat-surface); }
.sxchat-composer .sxchat-textarea { flex: 1; max-height: 96px; }
.sxchat-send {
  border: none; border-radius: 10px; background: var(--sxchat-accent); color: var(--sxchat-accent-fg);
  width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
}
.sxchat-send:disabled { opacity: .5; cursor: default; }
.sxchat-send svg { width: 18px; height: 18px; }

.sxchat-btn {
  border: none; border-radius: 10px; background: var(--sxchat-accent); color: var(--sxchat-accent-fg);
  padding: 10px 14px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
}
.sxchat-btn:disabled { opacity: .5; cursor: default; }
.sxchat-away { padding: 12px 16px; font-size: 13px; color: var(--sxchat-muted); border-top: 1px solid var(--sxchat-border); }
`;
