import { iconSet } from '../lib/icons';

/** Bottom sheet with a grid of every available icon. */
export default function IconPicker({ value, onPick, onClose, allowInherit }: {
  value?: string; onPick: (key: string | undefined) => void; onClose: () => void;
  /** Subcategories may clear their icon to use their main category's. */
  allowInherit?: boolean;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Choose icon" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Choose an icon</h2>
        <div className="icon-grid">
          {Object.entries(iconSet).map(([key, Icon]) => (
            <button key={key} className={key === value ? 'icon-cell active' : 'icon-cell'} onClick={() => onPick(key)}
              aria-label={key.replace(/-/g, ' ')} aria-pressed={key === value}>
              <Icon size={22} strokeWidth={1.9} />
            </button>
          ))}
        </div>
        {allowInherit && (
          <button className="btn block ghost" onClick={() => onPick(undefined)}>Use the main category's icon</button>
        )}
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
