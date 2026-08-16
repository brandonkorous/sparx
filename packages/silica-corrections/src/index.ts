// @wizeworks/silica-corrections — the platform's corrections to silicaui.
//
// Everything here fixes a gap or a misreading in silica (or in a tool that
// consumes it) and states NO brand value of its own. That is the whole entry
// condition: a correction both brands need cannot live inside one brand's
// package, or deleting that brand deletes the other brand's fix.
//
// The CSS is imported by path, because a stylesheet has to be:
//
//   @import '@wizeworks/silica-corrections/silica-gaps.css';
//   @import '@wizeworks/silica-corrections/toast.css';
//
// This barrel carries the JavaScript.

export { cn } from './cn';
