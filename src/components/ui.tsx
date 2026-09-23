import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon } from './icons';

/** Screen title with an optional back link. */
export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      {back && (
        <Link href={back} className="icon-btn" aria-label="Back">
          <ChevronLeftIcon />
        </Link>
      )}
      <h1>{title}</h1>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}

/** Up/down buttons used for reordering lists. */
export function ReorderButtons({ onUp, onDown, first, last }: {
  onUp: () => void; onDown: () => void; first: boolean; last: boolean;
}) {
  return (
    <div className="reorder">
      <button className="icon-btn" onClick={onUp} disabled={first} aria-label="Move up"><ChevronUpIcon /></button>
      <button className="icon-btn" onClick={onDown} disabled={last} aria-label="Move down"><ChevronDownIcon /></button>
    </div>
  );
}

export function Loading() {
  return <p className="muted">Loading…</p>;
}
