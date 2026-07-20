// The target document for a torn-off pane.
//
// dockview opens this URL with window.open and then PORTALS the group into it.
// That detail matters more than it looks: the panes keep living in the main
// window's React tree, so a detached pane shares the query cache, the
// controller, and every provider by reference. No state has to be synchronised
// across the boundary, and a pane behaves identically whether it is docked or
// floating on a second monitor.
//
// The trade is that a popout is a CHILD of the main window — close the main tab
// and the popouts go with it. That is the honest limit of doing this in a
// browser rather than a desktop shell, and it is the right trade here: the
// alternative (independent windows, each with its own React root) means
// synchronising cache, auth, and drafts across every window, and gets you a
// second app that can drift from the first.
//
// The page renders nothing on purpose. It exists to be a styled, themed, empty
// document — the root layout supplies globals.css and the pre-paint theme
// script, and dockview clones the parent's stylesheets in on open.

export default function PopoutPage() {
  return <div id="workbench-popout" className="bg-base-100 h-dvh w-full" />;
}
