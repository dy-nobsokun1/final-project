// A tiny "the inbox changed" signal, so the Inbox tab's badge updates when a thread is read or the
// Inbox reloads. Screens call inboxChanged(); the tab bar listens with onInboxChanged().

type Listener = (unread?: number) => void;
const listeners = new Set<Listener>();

/** Tell the tab bar to update its badge. Pass the unread total if you already know it. */
export function inboxChanged(unread?: number) {
  listeners.forEach((listener) => listener(unread));
}

/** Start listening. Returns the function that stops listening. */
export function onInboxChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
