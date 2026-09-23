import { useSyncExternalStore } from 'react';

// A tiny global "toast" message, e.g. "Saved $3.00 · Groceries".

let message: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string) {
  message = text;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => { message = null; emit(); }, 2500);
}

export default function Toast() {
  const msg = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => message,
  );
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
