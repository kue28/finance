import type { Category, ID } from '../db/types';
import { useCategories } from '../db/hooks';
import { PageHeader } from './ui';

/** Full-screen list of every main category with its subcategories as chips. */
export default function CategoryPicker({ selectedId, onPick, onClose }: {
  selectedId?: ID; onPick: (id: ID) => void; onClose: () => void;
}) {
  const cats = useCategories('expense');
  if (!cats) return null;

  const mains = cats.filter((c) => c.parentId === null && !c.archived);
  const subsOf = (m: Category) => cats.filter((c) => c.parentId === m.id && (!c.archived || c.id === selectedId));

  return (
    <div className="overlay" role="dialog" aria-label="Choose category">
      <div className="overlay-inner">
        <PageHeader title="Category" action={<button className="btn small ghost" onClick={onClose}>Close</button>} />
        {mains.map((m) => (
          <section key={m.id} className="picker-group">
            <h2>{m.name}</h2>
            <div className="chips">
              {subsOf(m).map((s) => (
                <button key={s.id} className={s.id === selectedId ? 'chip active' : 'chip'} onClick={() => onPick(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
