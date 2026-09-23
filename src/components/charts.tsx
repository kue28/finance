import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Cents } from '../db/types';
import { formatCents } from '../lib/money';

// Hand-drawn SVG/HTML charts: no chart library, so nothing extra to download.
// Styling follows one rule set: a single series colour (--series-1), thin
// marks with a 4px rounded data end, hairline solid grid, text in text colours.

export interface BarRow {
  id: string;
  label: string;
  value: Cents;
  icon?: LucideIcon;
}

/**
 * Horizontal bars sorted by the caller. Every row shows its amount and share
 * as text, so the list is also the table view. Rows are tappable when
 * `onPick` is given (e.g. to drill into subcategories).
 */
export function BarList({ rows, total, onPick }: { rows: BarRow[]; total: Cents; onPick?: (id: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted small">Nothing in this period.</p>;
  return (
    <ul className="barlist">
      {rows.map((r) => {
        const raw = total > 0 ? (r.value / total) * 100 : 0;
        const pct = raw > 0 && raw < 1 ? '<1' : String(Math.round(raw));
        const inner = (
          <>
            <div className="barlist-top">
              <span className="barlist-label">{r.icon && <r.icon size={16} strokeWidth={2} aria-hidden="true" />}{r.label}</span>
              <span className="barlist-value">{formatCents(r.value)} <span className="muted">{pct}%</span></span>
            </div>
            <div className="barlist-track">
              <div className="barlist-fill" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </>
        );
        return (
          <li key={r.id}>
            {onPick ? (
              <button className="barlist-row" onClick={() => onPick(r.id)} aria-label={`${r.label}: ${formatCents(r.value)}, see breakdown`}>
                {inner}<span className="barlist-chev" aria-hidden="true">›</span>
              </button>
            ) : <div className="barlist-row">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Round up to a "nice" axis maximum: 1, 2, 2.5 or 5 × a power of ten (in dollars). */
function niceMax(cents: Cents): Cents {
  const dollars = Math.max(1, cents / 100);
  const pow = 10 ** Math.floor(Math.log10(dollars));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= dollars)!;
  return step * pow * 100;
}

const shortMoney = (c: Cents) => {
  const d = c / 100;
  return d >= 1000 ? `$${(d / 1000).toFixed(d % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(d)}`;
};

/**
 * Month-by-month columns for one series. Tap (or focus) a column to read its
 * exact value in the readout above the chart; "Show table" lists every value.
 */
export function ColumnChart({ labels, fullLabels, values, title }: {
  labels: string[]; fullLabels: string[]; values: Cents[]; title: string;
}) {
  const [sel, setSel] = useState(values.length - 1);
  const [table, setTable] = useState(false);
  const W = 340, H = 180, padL = 40, padB = 22, padT = 8;
  const plotW = W - padL, plotH = H - padB - padT;
  const top = niceMax(Math.max(...values, 0));
  const band = plotW / values.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: Cents) => padT + plotH - (v / top) * plotH;
  const base = padT + plotH;
  const i = Math.min(sel, values.length - 1);

  // Column with a 4px rounded top, square at the baseline.
  const column = (x: number, v: Cents) => {
    const h = base - y(v);
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const t = base - h;
    return `M${x},${base}V${t + r}Q${x},${t} ${x + r},${t}H${x + barW - r}Q${x + barW},${t} ${x + barW},${t + r}V${base}Z`;
  };

  return (
    <figure className="chart" aria-label={title}>
      <div className="chart-readout" aria-live="polite">
        <span className="muted">{fullLabels[i]}</span> <b>{formatCents(values[i])}</b>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`${title}, column chart`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W} y1={y(top * f)} y2={y(top * f)} className="chart-grid" />
            <text x={padL - 6} y={y(top * f) + 4} className="chart-axis" textAnchor="end">{shortMoney(top * f)}</text>
          </g>
        ))}
        {values.map((v, k) => {
          const x = padL + k * band + (band - barW) / 2;
          return (
            <g key={k}>
              <path d={column(x, v)} className={k === i ? 'chart-col active' : 'chart-col'} />
              <text x={padL + k * band + band / 2} y={H - 6} className="chart-axis" textAnchor="middle">{labels[k]}</text>
              {/* Hit target: the whole band, taller and wider than the column. */}
              <rect x={padL + k * band} y={padT} width={band} height={plotH + padB} className="chart-hit"
                tabIndex={0} role="button" aria-label={`${fullLabels[k]}: ${formatCents(v)}`}
                onPointerEnter={() => setSel(k)} onClick={() => setSel(k)} onFocus={() => setSel(k)} />
            </g>
          );
        })}
      </svg>
      <button className="link-btn small" onClick={() => setTable(!table)}>{table ? 'Hide table' : 'Show table'}</button>
      {table && (
        <table className="chart-table">
          <tbody>
            {values.map((v, k) => (
              <tr key={k}><td>{fullLabels[k]}</td><td>{formatCents(v)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
