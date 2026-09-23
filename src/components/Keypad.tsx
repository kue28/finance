import { useEffect } from 'react';
import type { Key } from '../lib/keypad';

const keys: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/**
 * On-screen number pad. Faster and more predictable than the phone keyboard,
 * and it leaves the category chips visible while typing.
 * Also accepts a physical keyboard (handy when testing on a computer).
 */
export default function Keypad({ onKey }: { onKey: (k: Key) => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return;
      if (/^[0-9]$/.test(e.key)) onKey(e.key as Key);
      else if (e.key === '.' || e.key === ',') onKey('.');
      else if (e.key === 'Backspace') onKey('back');
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKey]);

  return (
    <div className="keypad">
      {keys.map((k) => (
        <button key={k} type="button" className="key" onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Delete' : k}>
          {k === 'back' ? '⌫' : k}
        </button>
      ))}
    </div>
  );
}
