import { useState } from 'react';
import { Link } from 'wouter';
import type { Category, CategoryKind } from '../../db/types';
import { useCategories } from '../../db/hooks';
import { addCategory, move } from '../../db/ops';
import { nameTaken } from '../../lib/labels';
import { Loading, PageHeader, ReorderButtons } from '../../components/ui';
import AddInline from '../../components/AddInline';

// Remember which tab was open when coming back from editing a category.
let lastKind: CategoryKind = 'expense';

export default function CategoriesList() {
  const [kind, setKindState] = useState<CategoryKind>(lastKind);
  const setKind = (k: CategoryKind) => { lastKind = k; setKindState(k); };
  const all = useCategories(kind);
  const [showArchived, setShowArchived] = useState(false);

  const mains = all?.filter((c) => c.parentId === null) ?? [];
  const active = mains.filter((c) => !c.archived);
  const archived = mains.filter((c) => c.archived);

  /** Active subcategory names for the one-line summary under each main category. */
  const subSummary = (main: Category) =>
    (all ?? []).filter((c) => c.parentId === main.id && !c.archived).map((c) => c.name).join(' · ');

  return (
    <>
      <PageHeader title="Categories" back="/more" />

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button className={kind === 'expense' ? 'seg active' : 'seg'} onClick={() => setKind('expense')}>Expense</button>
        <button className={kind === 'income' ? 'seg active' : 'seg'} onClick={() => setKind('income')}>Income</button>
      </div>

      {!all ? <Loading /> : (
        <>
          <ul className="list card flush">
            {active.map((c, i) => (
              <li key={c.id} className="row">
                <Link href={`/more/categories/${c.id}`} className="row-main">
                  <div className="row-title">{c.name}</div>
                  {kind === 'expense' && <div className="muted small clamp">{subSummary(c)}</div>}
                </Link>
                <ReorderButtons first={i === 0} last={i === active.length - 1}
                  onUp={() => move('categories', active, c.id, -1)}
                  onDown={() => move('categories', active, c.id, 1)} />
              </li>
            ))}
          </ul>

          <AddInline
            placeholder={kind === 'expense' ? 'New main category' : 'New income category'}
            onAdd={async (name) => {
              if (nameTaken(mains, name)) return 'That category already exists.';
              await addCategory(name, kind, null);
            }} />
          {kind === 'expense' && (
            <p className="muted small">New main categories get an "Other" subcategory. Tap a category to add more.</p>
          )}

          {archived.length > 0 && (
            <>
              <button className="link-btn" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </button>
              {showArchived && (
                <ul className="list card flush">
                  {archived.map((c) => (
                    <li key={c.id} className="row">
                      <Link href={`/more/categories/${c.id}`} className="row-main">
                        <div className="row-title muted">{c.name}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
