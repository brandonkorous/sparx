// Live Chat inbox landing — shown at /chat before a conversation is selected.

export default function ChatIndexPage(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--color-text-secondary)]">
      Select a conversation from the list to start replying.
    </div>
  );
}
